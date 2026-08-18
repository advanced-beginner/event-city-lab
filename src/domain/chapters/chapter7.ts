import type {
  ChapterDiagnosis,
  ChapterEventTemplate,
  ChapterRuleModule,
} from '../chapterSimulation'

function event(
  atMs: number,
  kind: ChapterEventTemplate['kind'],
  component: ChapterEventTemplate['component'],
  state: ChapterEventTemplate['state'],
  title: string,
  detail: string,
  log: string,
): ChapterEventTemplate {
  return { atMs, kind, component, state, title, detail, log }
}

function diagnosis(
  symptom: string,
  rootCause: string,
  evidence: readonly string[],
  recommendedChoiceId: string,
  tradeOff: string,
): ChapterDiagnosis {
  return { symptom, rootCause, evidence, recommendedChoiceId, tradeOff }
}

export const chapter7Rule: ChapterRuleModule = {
  chapterId: 7,
  experiments: [
    {
      id: 'blocking-retry',
      title: '같은 partition을 막는 즉시 재시도',
      mission: 'poison record 재시도가 같은 partition의 후속 record에 주는 영향을 확인합니다.',
      predictionPrompt: '실패 record를 성공할 때까지 같은 consumer에서 재시도하면 ordering과 처리량은 어떻게 될까요?',
      successCriteria: 'blocking retry의 순서 보존 이점과 partition 정지 비용을 함께 설명합니다.',
      recommendedChoiceId: 'bound-blocking-retry',
      referenceIds: ['consumer-offset-tracking'],
      choices: [
        {
          id: 'retry-in-place-unbounded',
          label: '성공할 때까지 무제한 재시도',
          description: 'offset 17을 같은 poll 처리 경로에서 제한 없이 다시 실행합니다.',
          outcome: {
            status: 'failed',
            summary: 'offset 17이 poison record라서 같은 partition의 후속 record가 모두 멈췄습니다.',
            events: [
              event(0, 'record.dispatched', 'consumer', 'active', 'Record 처리 시작', 'p0의 offset 17을 애플리케이션이 받습니다.', 'topic=orders partition=0 offset=17'),
              event(120, 'state.changed', 'application', 'failed', '업무 처리 실패', '검증할 수 없는 payload로 예외가 발생합니다.', 'error=InvalidOrderPayload attempt=1'),
              event(260, 'state.changed', 'retry', 'blocked', '즉시 재시도 반복', '같은 record를 backoff와 상한 없이 다시 처리합니다.', 'attempt=42 next-offset=18 blocked=true'),
              event(400, 'evidence.observed', 'partition', 'blocked', 'Partition 진행 정지', 'offset 18 이후 record가 대기합니다.', 'partition=0 lag=213 head-offset=17'),
              event(520, 'experiment.failed', 'consumer', 'failed', '처리량 고갈', '순서는 지켰지만 poison record 하나가 partition을 무기한 막았습니다.', 'blocking-retry=unbounded'),
            ],
            diagnosis: diagnosis(
              '하나의 poison record가 같은 partition의 모든 후속 처리를 막았습니다.',
              '애플리케이션이 실패 record를 현재 consume 경로에서 무제한 재시도했습니다.',
              ['attempt=42', 'head-offset=17', 'next-offset=18 blocked', 'lag=213'],
              'bound-blocking-retry',
              'blocking retry는 partition 내부 순서를 보존하기 쉽지만 backoff 동안 해당 partition 처리량을 포기합니다.',
            ),
          },
        },
        {
          id: 'bound-blocking-retry',
          label: '짧고 제한된 blocking retry',
          description: '일시 오류에만 횟수와 backoff가 제한된 즉시 재시도를 사용합니다.',
          outcome: {
            status: 'succeeded',
            summary: '일시 오류를 제한된 횟수 안에서 복구하고 partition 순서대로 처리를 재개했습니다.',
            events: [
              event(0, 'configuration.applied', 'application', 'active', '재시도 예산 적용', '애플리케이션 처리기에 최대 3회와 짧은 backoff를 설정합니다.', 'pattern=application-blocking-retry max-attempts=3 backoff-ms=200'),
              event(100, 'record.dispatched', 'consumer', 'active', 'Record 처리 시작', 'p0 offset 17 처리를 시작합니다.', 'partition=0 offset=17 attempt=1'),
              event(220, 'state.changed', 'retry', 'blocked', '일시 오류 재시도', '외부 서비스 오류 후 정해진 backoff를 기다립니다.', 'error=ServiceUnavailable attempt=2 backoff-ms=200'),
              event(460, 'evidence.observed', 'application', 'active', '세 번째 시도 성공', 'offset 17의 업무 처리가 완료됩니다.', 'partition=0 offset=17 attempt=3 result=success'),
              event(580, 'experiment.succeeded', 'consumer', 'complete', 'Partition 처리 재개', 'offset 18부터 순서대로 처리를 이어갑니다.', 'partition=0 next-offset=18'),
            ],
            diagnosis: diagnosis(
              '제한된 지연 뒤 같은 partition의 처리가 재개됐습니다.',
              '애플리케이션이 일시 오류에만 유한한 blocking retry 예산을 적용했습니다.',
              ['max-attempts=3', 'attempt=3 success', 'next-offset=18'],
              'bound-blocking-retry',
              '짧은 blocking retry도 backoff 동안 partition을 멈추므로 긴 장애에는 retry topic 같은 비차단 패턴이 더 적합합니다.',
            ),
          },
        },
      ],
    },
    {
      id: 'staged-backoff',
      title: '단계별 retry topic',
      mission: 'retry topic과 지연 소비가 누가 만드는 흐름인지 구분하고 backoff 단계를 추적합니다.',
      predictionPrompt: 'Kafka broker가 실패 record를 retry-1m과 retry-10m topic으로 자동 이동시킬까요?',
      successCriteria: '애플리케이션 또는 프레임워크의 새 produce/consume 흐름과 ordering 변화를 설명합니다.',
      recommendedChoiceId: 'application-publishes-retry-topics',
      referenceIds: ['producer-configs', 'consumer-offset-tracking'],
      choices: [
        {
          id: 'assume-broker-auto-retry-topics',
          label: 'Broker 자동 이동을 가정',
          description: '실패만 throw하고 broker가 retry topic과 backoff를 관리할 것으로 기대합니다.',
          outcome: {
            status: 'failed',
            summary: 'Kafka core에는 일반 consumer 실패를 retry topic으로 자동 이동시키는 동작이 없어 record가 원래 경로에 남았습니다.',
            events: [
              event(0, 'record.dispatched', 'consumer', 'active', '원본 topic 소비', '애플리케이션이 orders p1 offset 8을 받습니다.', 'topic=orders partition=1 offset=8'),
              event(130, 'state.changed', 'application', 'failed', '처리 예외 발생', '애플리케이션 처리기가 예외를 반환합니다.', 'error=InventoryUnavailable'),
              event(260, 'evidence.observed', 'broker', 'blocked', '자동 retry record 없음', 'broker에는 retry-1m으로의 produce 요청이 없었습니다.', 'produce-request retry-1m count=0'),
              event(390, 'evidence.observed', 'offset', 'failed', '진행 정책 부재', '원본 offset을 commit할지 다시 읽을지 결정되지 않았습니다.', 'topic=orders partition=1 committed-offset=8'),
              event(510, 'experiment.failed', 'retry', 'failed', 'Retry 흐름 미구성', 'broker 자동 기능으로 오해해 재시도 경로가 만들어지지 않았습니다.', 'retry-pattern=missing'),
            ],
            diagnosis: diagnosis(
              '처리 실패 뒤 retry topic에 아무 record도 생성되지 않았습니다.',
              '일반 consumer의 retry topic, backoff, DLT는 Kafka broker 자동 기능이 아니라 애플리케이션 또는 프레임워크 패턴입니다.',
              ['retry-1m produce requests=0', 'original offset unresolved', 'application exception observed'],
              'application-publishes-retry-topics',
              'retry topic 패턴은 원본 partition을 풀어 주지만 별도 publish 실패 처리와 원본 대비 순서 변화가 생깁니다.',
            ),
          },
        },
        {
          id: 'application-publishes-retry-topics',
          label: '애플리케이션이 retry 단계를 발행',
          description: '프레임워크 처리기가 실패 context와 예정 시각을 담아 retry topic으로 새 record를 발행합니다.',
          outcome: {
            status: 'succeeded',
            summary: '애플리케이션이 1분·10분 단계의 새 publish/consume 흐름을 만들고 원본 partition을 계속 처리했습니다.',
            events: [
              event(0, 'record.dispatched', 'consumer', 'active', '원본 처리 실패', 'orders p1 offset 8에서 일시 오류가 발생합니다.', 'topic=orders partition=1 offset=8 error=InventoryUnavailable'),
              event(120, 'configuration.applied', 'application', 'active', 'Retry envelope 생성', '원본 위치, 시도 횟수, 다음 처리 시각을 새 record에 보존합니다.', 'pattern=framework-retry original=orders-1@8 attempt=1 delay=1m'),
              event(250, 'record.dispatched', 'retry', 'active', 'retry-1m 발행', '애플리케이션 producer가 retry-1m topic에 record를 씁니다.', 'produce topic=orders.retry-1m key=order-42'),
              event(60000, 'state.changed', 'retry', 'active', '1분 후 재처리', 'retry consumer가 record를 읽고 다음 단계가 필요함을 판단합니다.', 'consume topic=orders.retry-1m attempt=2 result=failed'),
              event(60140, 'record.dispatched', 'retry', 'active', 'retry-10m 발행', '애플리케이션이 다음 backoff topic으로 새 record를 씁니다.', 'produce topic=orders.retry-10m attempt=2 delay=10m'),
              event(660200, 'experiment.succeeded', 'application', 'complete', '지연 재처리 성공', '10분 단계에서 업무 처리가 완료됩니다.', 'consume topic=orders.retry-10m attempt=3 result=success'),
            ],
            diagnosis: diagnosis(
              '원본 partition은 진행하고 실패 record는 단계별 지연 뒤 복구됐습니다.',
              '애플리케이션 또는 프레임워크가 retry topic으로 새 record를 produce하고 별도 consumer가 backoff 이후 consume했습니다.',
              ['original=orders-1@8', 'retry-1m produced', 'retry-10m produced', 'attempt=3 success'],
              'application-publishes-retry-topics',
              '비차단 retry는 처리량 격리를 얻는 대신 원본 topic의 엄격한 처리 순서를 유지하지 못할 수 있습니다.',
            ),
          },
        },
      ],
    },
    {
      id: 'dead-letter-evidence',
      title: 'DLT로 보내기 전 증거 보존',
      mission: '복구할 수 없는 record를 나중에 조사하고 재처리할 수 있는 형태로 격리합니다.',
      predictionPrompt: 'payload와 마지막 오류만 DLT에 남기면 원본 소비 위치와 실패 과정을 복원할 수 있을까요?',
      successCriteria: '원본 위치, key, 오류, 시도 횟수와 correlation 정보를 보존해 애플리케이션이 DLT로 발행합니다.',
      recommendedChoiceId: 'publish-dlt-with-context',
      referenceIds: ['producer-configs', 'consumer-offset-tracking'],
      choices: [
        {
          id: 'publish-payload-only',
          label: 'payload만 DLT에 저장',
          description: '재시도 소진 후 원본 context 없이 payload만 별도 topic에 씁니다.',
          outcome: {
            status: 'failed',
            summary: 'DLT record는 남았지만 어느 소비 위치에서 왜 실패했는지 증명할 수 없습니다.',
            events: [
              event(0, 'state.changed', 'retry', 'failed', '재시도 소진', '세 번의 애플리케이션 재시도가 모두 실패합니다.', 'attempt=3 result=failed error=InvalidAddress'),
              event(140, 'record.dispatched', 'application', 'active', 'Payload-only 발행', '애플리케이션이 payload만 orders.dlt에 씁니다.', 'produce topic=orders.dlt headers=none'),
              event(280, 'evidence.observed', 'retry', 'blocked', '원본 위치 누락', '원본 topic, partition, offset을 찾을 수 없습니다.', 'original-location=missing'),
              event(410, 'experiment.failed', 'application', 'failed', '재처리 판단 불가', '운영자가 실패 이력과 중복 여부를 확인할 수 없습니다.', 'replay-evidence=incomplete'),
            ],
            diagnosis: diagnosis(
              'DLT record와 원본 소비·재시도 이력을 연결할 수 없습니다.',
              '애플리케이션이 payload만 새 topic에 발행하고 진단 context를 버렸습니다.',
              ['original topic missing', 'partition/offset missing', 'attempt history missing'],
              'publish-dlt-with-context',
              '풍부한 실패 context는 조사성을 높이지만 민감 정보 노출과 header 크기, 보존 정책을 관리해야 합니다.',
            ),
          },
        },
        {
          id: 'publish-dlt-with-context',
          label: '실패 증거와 함께 DLT 발행',
          description: '애플리케이션이 원본 위치와 오류 이력을 header에 보존해 DLT record를 만듭니다.',
          outcome: {
            status: 'succeeded',
            summary: 'DLT record가 원본 위치와 전체 실패 이력을 보존해 안전한 조사·선별 재처리가 가능해졌습니다.',
            events: [
              event(0, 'state.changed', 'retry', 'failed', '재시도 정책 소진', '정해진 세 번의 시도가 모두 실패합니다.', 'attempt=3 error=InvalidAddress'),
              event(130, 'configuration.applied', 'application', 'active', 'DLT envelope 구성', '원본 위치, key, 오류, 시도 횟수, correlation id를 보존합니다.', 'original=orders-2@91 key=order-77 attempts=3 correlation=evt-204'),
              event(260, 'record.dispatched', 'application', 'active', 'DLT 발행', '애플리케이션 producer가 orders.dlt에 새 record를 씁니다.', 'pattern=application-dlt produce topic=orders.dlt'),
              event(390, 'evidence.observed', 'offset', 'active', '원본 처리 결정 기록', 'DLT publish 성공을 확인한 뒤 원본 offset 진행 정책을 적용합니다.', 'original-next-offset=92 dlt-produce=acknowledged'),
              event(510, 'experiment.succeeded', 'retry', 'complete', '격리 증거 확인', '운영자가 DLT record에서 원본과 오류 이력을 복원합니다.', 'replay-ready=true original=orders-2@91'),
            ],
            diagnosis: diagnosis(
              '실패 record를 원본과 연결해 조사하고 선별 재처리할 수 있습니다.',
              '애플리케이션 또는 프레임워크가 진단 context를 보존한 새 DLT record를 명시적으로 produce했습니다.',
              ['original=orders-2@91', 'attempts=3', 'error=InvalidAddress', 'correlation=evt-204'],
              'publish-dlt-with-context',
              'DLT는 실패를 해결하지 않고 격리하므로 소유자, 알림, 보존, 재처리와 중복 방지 절차가 별도로 필요합니다.',
            ),
          },
        },
      ],
    },
  ],
}

