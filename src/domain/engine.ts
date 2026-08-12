import type {
  ComponentId,
  ComponentState,
  SimulationEvent,
  SimulationEventKind,
  SimulationInput,
  SimulationRun,
} from './simulation'
import { simulationInputSchema } from './schemas'

interface EventDraft {
  atMs: number
  kind: SimulationEventKind
  component: ComponentId
  state: ComponentState
  title: string
  detail: string
  log: string
  setting?: 'serializer' | 'acks' | 'topic'
}

function materializeEvents(runId: string, drafts: EventDraft[]): SimulationEvent[] {
  return drafts.map((draft, sequence) => ({
    ...draft,
    id: `${runId}:${sequence}`,
    sequence,
  }))
}

function baseEvents(messageId: string): EventDraft[] {
  return [
    {
      atMs: 0,
      kind: 'command.accepted',
      component: 'producer',
      state: 'active',
      title: '발송 명령 접수',
      detail: `${messageId} 메시지가 Producer 대기열에 들어왔습니다.`,
      log: `[producer] send(${messageId}) accepted`,
    },
    {
      atMs: 160,
      kind: 'producer.preparing',
      component: 'producer',
      state: 'active',
      title: 'ProducerRecord 준비',
      detail: 'topic, key, value와 Producer 설정을 조합합니다.',
      log: '[producer] building ProducerRecord(topic=orders.v1)',
    },
    {
      atMs: 340,
      kind: 'serializer.inspecting',
      component: 'serializer',
      state: 'active',
      title: 'Serializer 호환성 검사',
      detail: 'value 객체를 Kafka가 전송할 byte[]로 바꿀 수 있는지 검사합니다.',
      log: '[serializer] encode value type=OrderEvent',
      setting: 'serializer',
    },
  ]
}

export function simulateProducerSend(candidate: SimulationInput): SimulationRun {
  const input = simulationInputSchema.parse(candidate)
  const drafts = baseEvents(input.message.messageId)

  if (input.config.serializer === 'string') {
    drafts.push({
      atMs: 520,
      kind: 'serializer.rejected',
      component: 'serializer',
      state: 'failed',
      title: '발송 전 직렬화 실패',
      detail: 'StringSerializer는 OrderEvent 객체를 문자열로 자동 변환하지 않습니다.',
      log: '[error] SerializationException: cannot serialize OrderEvent with StringSerializer',
      setting: 'serializer',
    })

    return {
      runId: input.runId,
      seed: input.seed,
      messageId: input.message.messageId,
      status: 'failed',
      config: input.config,
      events: materializeEvents(input.runId, drafts),
      diagnosis: {
        symptom: '메시지가 Broker에 도착하지 않았습니다.',
        rootCause: 'value의 실제 타입과 value.serializer 설정이 호환되지 않습니다.',
        evidence: [
          '실패 이벤트가 network 단계보다 앞선 serializer 단계에 있습니다.',
          '로그에 SerializationException과 StringSerializer가 함께 나타납니다.',
          'Broker 수신 이벤트와 ACK 이벤트가 생성되지 않았습니다.',
        ],
        setting: 'serializer',
        currentValue: 'StringSerializer',
        recommendedValue: 'JsonSerializer',
        tradeOff: 'JSON은 구조를 보존하지만 문자열보다 payload와 스키마 관리 비용이 늘어납니다.',
      },
      summary: 'Producer 내부에서 실패했습니다. 네트워크와 Broker는 아직 관여하지 않았습니다.',
    }
  }

  drafts.push(
    {
      atMs: 520,
      kind: 'serializer.completed',
      component: 'serializer',
      state: 'complete',
      title: 'JSON 직렬화 완료',
      detail: 'OrderEvent가 UTF-8 JSON byte[]로 변환됐습니다.',
      log: '[serializer] encoded OrderEvent as JSON (82 bytes)',
      setting: 'serializer',
    },
    {
      atMs: 760,
      kind: 'network.dispatched',
      component: 'rail',
      state: 'active',
      title: 'ProduceRequest 출발',
      detail: '직렬화된 메시지가 Broker leader로 이동합니다.',
      log: '[network] ProduceRequest dispatched to broker-1',
    },
    {
      atMs: 980,
      kind: 'broker.received',
      component: 'broker',
      state: 'active',
      title: 'Leader Broker 수신',
      detail: 'orders.v1 파티션 leader가 요청을 검사합니다.',
      log: '[broker-1] received ProduceRequest topic=orders.v1 partition=0',
    },
    {
      atMs: 1180,
      kind: 'broker.appended',
      component: 'broker',
      state: 'complete',
      title: '로그 append 완료',
      detail: '메시지가 partition log의 offset 42에 기록됐습니다.',
      log: '[broker-1] appended offset=42',
    },
    {
      atMs: 1380,
      kind: 'ack.returned',
      component: 'ack',
      state: 'complete',
      title: 'ACK 도착',
      detail: 'acks=all 조건을 충족한 성공 응답이 Producer로 돌아왔습니다.',
      log: '[producer] ProduceResponse success offset=42',
      setting: 'acks',
    },
    {
      atMs: 1500,
      kind: 'run.completed',
      component: 'producer',
      state: 'complete',
      title: '실험 성공',
      detail: '같은 메시지가 직렬화, 전송, append, ACK 단계를 모두 통과했습니다.',
      log: '[lab] run completed successfully',
    },
  )

  return {
    runId: input.runId,
    seed: input.seed,
    messageId: input.message.messageId,
    status: 'succeeded',
    config: input.config,
    events: materializeEvents(input.runId, drafts),
    diagnosis: null,
    summary: '메시지가 Broker leader log에 기록되고 ACK가 Producer로 돌아왔습니다.',
  }
}
