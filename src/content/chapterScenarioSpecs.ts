import type { KafkaReferenceId } from './kafkaReferences'

export interface ChapterExperimentSpec {
  id: string
  title: string
  failureOrQuestion: string
  repairOrConclusion: string
}

export interface ChapterScenarioSpec {
  chapterId: 2 | 3 | 4 | 5 | 6 | 7 | 8
  topic: string
  misconception: string
  experiments: readonly ChapterExperimentSpec[]
  references: readonly KafkaReferenceId[]
  accuracyNotes: readonly string[]
}

export const chapterScenarioSpecs: readonly ChapterScenarioSpec[] = [
  {
    chapterId: 2,
    topic: 'key, partition 선택, partition 내부 ordering',
    misconception: 'Kafka topic 전체에 하나의 전역 순서가 보장된다고 생각한다.',
    experiments: [
      {
        id: 'same-key-same-partition',
        title: '같은 고객의 주문 경로',
        failureOrQuestion: '같은 key를 가진 이벤트들이 어느 partition으로 가는지 예측한다.',
        repairOrConclusion: '같은 key는 같은 partition으로 라우팅되고 그 partition 안에서 기록 순서가 유지된다.',
      },
      {
        id: 'keyless-distribution',
        title: 'key 없는 주문의 분산',
        failureOrQuestion: 'key를 제거해도 동일한 ordering 단위가 유지될 것이라고 예측한다.',
        repairOrConclusion: 'key 없는 배치는 partition 선택이 달라질 수 있으므로 업무 ordering key를 명시한다.',
      },
      {
        id: 'cross-partition-order',
        title: '도시 전체 순서의 착시',
        failureOrQuestion: '서로 다른 partition의 이벤트를 하나의 전역 순서로 해석한다.',
        repairOrConclusion: '보장 범위를 topic이 아니라 topic-partition 단위로 설명한다.',
      },
    ],
    references: ['kafka-introduction', 'producer-configs'],
    accuracyNotes: ['custom partitioner가 있으면 기본 key 기반 선택 규칙이 달라질 수 있음을 표시한다.'],
  },
  {
    chapterId: 3,
    topic: 'acks, retry, delivery timeout, idempotence',
    misconception: 'retry를 켜면 손실·중복·순서 문제가 모두 자동으로 해결된다고 생각한다.',
    experiments: [
      {
        id: 'acks-leader-loss',
        title: 'ACK 직후 leader 장애',
        failureOrQuestion: 'acks=1과 acks=all의 성공 조건을 비교한다.',
        repairOrConclusion: 'ACK 강도가 latency와 durability 사이의 선택임을 증거로 설명한다.',
      },
      {
        id: 'retry-duplicate-order',
        title: '응답을 잃어버린 재시도',
        failureOrQuestion: 'idempotence가 꺼진 상태에서 retriable failure와 동시 요청을 만든다.',
        repairOrConclusion: '중복 및 재정렬 위험을 관찰하고 delivery timeout의 역할을 구분한다.',
      },
      {
        id: 'idempotent-repair',
        title: 'idempotent producer 복구',
        failureOrQuestion: '서로 충돌하는 acks/retries/max-in-flight 설정을 조사한다.',
        repairOrConclusion: 'enable.idempotence의 요구 조건을 만족시켜 같은 장애를 안전하게 재실행한다.',
      },
    ],
    references: ['producer-configs', 'kafka-producer-api'],
    accuracyNotes: ['Kafka 4.3에서 enable.idempotence 기본값은 충돌 설정이 없을 때 true다.', 'retries 직접 조정보다 delivery.timeout.ms 중심 설명을 우선한다.'],
  },
  {
    chapterId: 4,
    topic: 'broker, replica, ISR, leader 장애',
    misconception: 'replication factor만 높이면 어떤 상태에서도 acks=all 쓰기가 성공한다고 생각한다.',
    experiments: [
      {
        id: 'replica-lag',
        title: '느려진 follower와 ISR',
        failureOrQuestion: 'replica 한 대의 lag로 ISR 구성이 바뀌는 장면을 조사한다.',
        repairOrConclusion: 'replica 수와 현재 ISR 수가 다른 상태값임을 구분한다.',
      },
      {
        id: 'min-isr-write-failure',
        title: 'acks=all 쓰기 거부',
        failureOrQuestion: '현재 ISR이 min.insync.replicas보다 작을 때 produce를 시도한다.',
        repairOrConclusion: 'NotEnoughReplicas 계열 실패를 durability 보호 장치로 해석한다.',
      },
      {
        id: 'leader-failover',
        title: 'leader 교체 후 복구',
        failureOrQuestion: 'leader 장애 전후의 append/ACK/가시성 증거를 비교한다.',
        repairOrConclusion: '새 leader와 ISR 상태를 확인한 뒤 동일 입력을 재실행한다.',
      },
    ],
    references: ['kafka-introduction', 'topic-configs', 'producer-configs'],
    accuracyNotes: ['acks=all은 모든 현재 ISR의 ACK를 기다리며 min.insync.replicas는 성공 가능한 최소 ISR 크기를 제한한다.'],
  },
  {
    chapterId: 5,
    topic: 'consumer poll, 처리, offset commit',
    misconception: 'record를 poll한 순간 업무 처리가 완료되고 재시작 위치도 자동으로 안전해진다고 생각한다.',
    experiments: [
      {
        id: 'poll-versus-process',
        title: '가져오기와 처리 완료의 간격',
        failureOrQuestion: 'poll 이후 업무 처리 전에 장애를 발생시킨다.',
        repairOrConclusion: 'consumer position, 처리 완료, committed offset을 서로 다른 증거로 본다.',
      },
      {
        id: 'early-commit-loss',
        title: '너무 이른 commit',
        failureOrQuestion: '처리 전에 offset을 commit한 뒤 consumer를 재시작한다.',
        repairOrConclusion: '재시작 시 건너뛴 업무를 관찰하고 commit 시점을 처리 경계 뒤로 옮긴다.',
      },
      {
        id: 'late-commit-replay',
        title: '늦은 commit과 재처리',
        failureOrQuestion: '처리 후 commit 전에 장애를 발생시킨다.',
        repairOrConclusion: '재처리 가능성을 인정하고 idempotent 업무 처리와 commit 전략을 비교한다.',
      },
    ],
    references: ['consumer-configs', 'consumer-offset-tracking'],
    accuracyNotes: ['committed offset은 다음에 읽을 위치를 뜻하도록 표현한다.', 'enable.auto.commit은 poll한 record가 실제 업무 처리됐음을 검증하지 않는다.'],
  },
  {
    chapterId: 6,
    topic: 'consumer group, partition ownership, rebalance',
    misconception: 'consumer를 추가하면 항상 처리량이 늘고 partition 이동 중에도 소유권이 고정된다고 생각한다.',
    experiments: [
      {
        id: 'assignment-capacity',
        title: 'partition보다 많은 consumer',
        failureOrQuestion: 'partition 수보다 많은 consumer를 같은 group에 배치한다.',
        repairOrConclusion: '동일 group에서 동시에 일할 수 있는 consumer 수의 상한을 partition 수와 연결한다.',
      },
      {
        id: 'join-leave-rebalance',
        title: '멤버 변경과 소유권 이동',
        failureOrQuestion: 'consumer가 join/leave할 때 처리 중인 partition ownership 변화를 관찰한다.',
        repairOrConclusion: 'revocation/assignment 경계에서 처리와 commit 책임을 명시한다.',
      },
      {
        id: 'poll-timeout',
        title: '느린 처리와 max.poll.interval.ms',
        failureOrQuestion: 'poll 간격이 제한을 넘도록 처리 시간을 늘린다.',
        repairOrConclusion: '실패로 간주된 멤버의 partition이 재할당되는 이유를 진단한다.',
      },
    ],
    references: ['consumer-configs', 'consumer-rebalance-protocol'],
    accuracyNotes: ['classic과 consumer group protocol의 설정 차이를 UI에서 명시한다.', 'Kafka 4.3의 consumer protocol은 지원되지만 기본값은 classic이다.'],
  },
  {
    chapterId: 7,
    topic: 'retry topic, backoff, dead-letter topic',
    misconception: 'Kafka broker가 실패 record를 자동으로 retry topic이나 DLT로 이동시킨다고 생각한다.',
    experiments: [
      {
        id: 'blocking-retry',
        title: '같은 partition을 막는 즉시 재시도',
        failureOrQuestion: 'poison record를 consumer 내부에서 반복 처리한다.',
        repairOrConclusion: 'ordering 보존과 partition 처리 정지 사이의 trade-off를 설명한다.',
      },
      {
        id: 'staged-backoff',
        title: '단계별 retry topic',
        failureOrQuestion: 'retry-1m, retry-10m 흐름에서 지연과 순서 변화를 추적한다.',
        repairOrConclusion: 'application/framework가 만드는 새 produce/consume 흐름으로 이해한다.',
      },
      {
        id: 'dead-letter-evidence',
        title: 'DLT로 보내기 전 증거 보존',
        failureOrQuestion: '재시도 횟수만 소진하고 원본 context를 잃는 구성을 만든다.',
        repairOrConclusion: '원본 topic/partition/offset, 오류, 시도 횟수를 보존해 DLT로 발행한다.',
      },
    ],
    references: ['consumer-offset-tracking', 'producer-configs'],
    accuracyNotes: ['일반 consumer의 retry topic과 DLT는 Kafka core의 자동 기능이 아니라 애플리케이션 또는 프레임워크 패턴으로 표시한다.'],
  },
  {
    chapterId: 8,
    topic: 'transaction, consume-transform-produce, isolation level',
    misconception: 'idempotent producer만 켜면 consume-process-produce 전체가 원자적으로 처리된다고 생각한다.',
    experiments: [
      {
        id: 'partial-transform',
        title: '출력은 쓰고 offset은 잃은 처리',
        failureOrQuestion: '출력 produce 후 offset commit 전에 장애를 발생시킨다.',
        repairOrConclusion: '재시작 중 중복 출력이 생기는 원인을 두 개의 독립 commit으로 설명한다.',
      },
      {
        id: 'transactional-repair',
        title: '출력과 offset의 단일 transaction',
        failureOrQuestion: 'beginTransaction부터 sendOffsetsToTransaction까지의 경계를 구성한다.',
        repairOrConclusion: '출력 record와 다음 consumer offset을 같은 commit/abort 결과에 묶는다.',
      },
      {
        id: 'isolation-visibility',
        title: 'read_committed의 가시성',
        failureOrQuestion: '진행 중·abort·commit transaction을 두 isolation level에서 읽는다.',
        repairOrConclusion: 'read_committed가 committed transactional record만 반환하고 LSO까지 읽는 이유를 설명한다.',
      },
    ],
    references: ['kafka-producer-api', 'consumer-configs', 'topic-configs'],
    accuracyNotes: ['transactional.id가 idempotence를 내포하지만 consumer isolation 설정은 별도다.', 'sendOffsetsToTransaction의 offset은 다음에 처리할 record 위치다.'],
  },
] as const

export function getChapterScenarioSpec(chapterId: ChapterScenarioSpec['chapterId']): ChapterScenarioSpec {
  const scenario = chapterScenarioSpecs.find((candidate) => candidate.chapterId === chapterId)

  if (!scenario) {
    throw new Error(`Unknown chapter scenario: ${chapterId}`)
  }

  return scenario
}
