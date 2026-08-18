export const CHAPTER_IDS = [1, 2, 3, 4, 5, 6, 7, 8] as const

export type ChapterId = (typeof CHAPTER_IDS)[number]
export type ChapterImplementationStatus = 'implemented' | 'planned'

export interface ChapterMetadata {
  id: ChapterId
  numberLabel: string
  title: string
  shortTitle: string
  topic: string
  learningGoal: string
  implementationStatus: ChapterImplementationStatus
}

export const CHAPTERS: readonly ChapterMetadata[] = [
  {
    id: 1,
    numberLabel: '01',
    title: '첫 메시지는 왜 출발하지 못했을까?',
    shortTitle: 'Serializer',
    topic: '첫 Producer 발송과 Serializer 타입 불일치',
    learningGoal: 'Serializer 실패를 증거로 찾고 Broker append와 ACK까지 경로를 복구합니다.',
    implementationStatus: 'implemented',
  },
  {
    id: 2,
    numberLabel: '02',
    title: '메시지는 어느 파티션으로 갈까?',
    shortTitle: '파티션 선택',
    topic: 'key, partition 선택, partition 내부 ordering',
    learningGoal: 'key와 partitioner가 메시지의 배치와 순서 보장 범위를 어떻게 결정하는지 실험합니다.',
    implementationStatus: 'planned',
  },
  {
    id: 3,
    numberLabel: '03',
    title: '재시도는 왜 중복을 남길까?',
    shortTitle: 'ACK와 재시도',
    topic: 'acknowledgements, retry, idempotence',
    learningGoal: 'ACK 유실과 재시도의 관계를 추적하고 idempotence가 줄이는 중복 위험을 비교합니다.',
    implementationStatus: 'planned',
  },
  {
    id: 4,
    numberLabel: '04',
    title: 'Leader가 중단되면 기록은 안전할까?',
    shortTitle: '복제와 ISR',
    topic: 'broker, replica, ISR, leader 장애',
    learningGoal: 'replica와 ISR 상태를 관찰하며 acks=all의 실제 성공 조건을 설명합니다.',
    implementationStatus: 'planned',
  },
  {
    id: 5,
    numberLabel: '05',
    title: 'Consumer는 어디까지 읽었을까?',
    shortTitle: 'Poll과 Offset',
    topic: 'consumer, poll, offset commit',
    learningGoal: 'poll과 offset commit 시점이 재처리와 메시지 유실 위험에 주는 영향을 비교합니다.',
    implementationStatus: 'planned',
  },
  {
    id: 6,
    numberLabel: '06',
    title: '파티션의 담당자는 어떻게 바뀐까?',
    shortTitle: 'Consumer Group',
    topic: 'consumer group, partition ownership, rebalance',
    learningGoal: 'group 구성원이 바뀔 때 partition ownership과 처리 중단 구간을 추적합니다.',
    implementationStatus: 'planned',
  },
  {
    id: 7,
    numberLabel: '07',
    title: '실패한 메시지는 어디로 보내야 할까?',
    shortTitle: 'Retry와 DLT',
    topic: 'retry topic, backoff, dead-letter topic',
    learningGoal: '재시도 주기와 격리 전략을 조정하며 독성 메시지를 안전하게 다루는 방법을 설계합니다.',
    implementationStatus: 'planned',
  },
  {
    id: 8,
    numberLabel: '08',
    title: '읽고 바꿔 쓰는 전체를 하나로 묶을 수 있을까?',
    shortTitle: 'Transaction',
    topic: 'transaction, consume-transform-produce, isolation level',
    learningGoal: 'transaction과 isolation level로 consume-transform-produce 흐름의 원자성을 검증합니다.',
    implementationStatus: 'planned',
  },
]

export function isChapterId(value: number): value is ChapterId {
  return CHAPTER_IDS.some((chapterId) => chapterId === value)
}

export function getChapter(chapterId: ChapterId): ChapterMetadata {
  const chapter = CHAPTERS.find((candidate) => candidate.id === chapterId)
  if (!chapter) throw new Error(`Chapter ${chapterId} metadata is missing.`)
  return chapter
}
