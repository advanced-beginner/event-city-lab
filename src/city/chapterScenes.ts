import type {
  CityNodeDefinition,
  CityNodeKind,
  CityPoint,
  CityRouteDefinition,
  CityRouteKind,
  CitySceneDefinition,
} from './types'

type AdvancedChapterId = 2 | 3 | 4 | 5 | 6 | 7 | 8

interface AtlasAnchor {
  kind: CityNodeKind
  label: string
  description: string
  hitAreaPath: string
  labelPosition: CityPoint
  roadPosition: CityPoint
  shortLabel?: string
}

export interface CityScenePreview {
  nodeIds: readonly string[]
  routeIds: readonly string[]
}

const ANCHORS = {
  producer: anchor('producer', 'Producer 출발센터', 'Kafka record를 만들고 전송하는 출발 시설입니다.', '477,221 584,201 630,493 506,536 431,450', [541, 410], [430, 452], 'Producer'),
  application: anchor('application', 'Application 처리공장', '업무 규칙과 변환, 재시도 정책을 실행합니다.', '1013,302 1155,292 1221,515 1071,583 983,488', [1098, 452], [1006, 583], 'Application'),
  'broker-leader': anchor('broker', 'Broker Leader 기록센터', '현재 partition leader가 record를 append하는 기록센터입니다.', '744,356 843,333 921,560 793,637 712,565', [815, 505], [918, 629], 'Leader'),
  'broker-follower-1': anchor('replica', 'Broker Follower 1', 'Leader 기록을 복제하는 follower replica입니다.', '1211,475 1352,465 1427,583 1282,647 1195,568', [1305, 548], [1218, 470], 'Follower 1'),
  'broker-follower-2': anchor('replica', 'Broker Follower 2', 'Leader 기록을 복제하는 follower replica입니다.', '1697,400 1857,398 1906,557 1741,641 1644,554', [1780, 506], [1615, 550], 'Follower 2'),
  'partition-p0': anchor('partition', 'Partition p0 적재장', 'p0의 독립적인 append 순서와 offset을 보관합니다.', '872,301 936,282 987,391 922,441 846,381', [918, 360], [848, 405], 'p0'),
  'partition-p1': anchor('partition', 'Partition p1 적재장', 'p1의 독립적인 append 순서와 offset을 보관합니다.', '887,377 1002,348 1044,521 934,566 875,495', [953, 463], [1036, 579], 'p1'),
  'partition-p2': anchor('partition', 'Partition p2 적재장', 'p2의 독립적인 append 순서와 offset을 보관합니다.', '985,626 1083,607 1162,714 1053,776 974,709', [1060, 681], [979, 639], 'p2'),
  'consumer-c1': anchor('consumer', 'Consumer c1 수령센터', '할당받은 partition에서 record를 poll합니다.', '382,699 479,661 532,974 420,1044 344,886', [449, 842], [341, 797], 'c1'),
  'consumer-c2': anchor('consumer', 'Consumer c2 수령센터', '할당받은 partition에서 record를 poll합니다.', '465,731 543,698 579,921 494,977 430,874', [513, 838], [583, 913], 'c2'),
  'consumer-c3': anchor('consumer', 'Consumer c3 수령센터', '할당받은 partition에서 record를 poll합니다.', '1009,768 1195,727 1331,820 1134,929 976,866', [1139, 827], [1050, 946], 'c3'),
  'consumer-c4': anchor('consumer', 'Consumer c4 대기 차고', 'partition을 배정받지 못하면 IDLE 상태로 대기합니다.', '1507,754 1659,710 1741,862 1596,971 1459,884', [1608, 834], [1466, 788], 'c4 · IDLE'),
  'consumer-c5': anchor('consumer', 'Consumer c5 대기 차고', 'partition을 배정받지 못하면 IDLE 상태로 대기합니다.', '1680,677 1790,630 1882,720 1763,808 1642,751', [1764, 715], [1636, 650], 'c5 · IDLE'),
  coordinator: anchor('coordinator', 'Group Coordinator 관제탑', '멤버십과 partition assignment를 조정합니다.', '1262,223 1346,200 1403,357 1312,410 1238,347', [1324, 304], [1216, 402], 'Coordinator'),
  'offset-store': anchor('offset', 'Offset Store 검표소', 'Consumer group의 다음 읽기 위치를 보관합니다.', '1459,357 1601,338 1684,442 1575,524 1423,468', [1558, 430], [1474, 531], 'Offset Store'),
  'retry-loop': anchor('retry', 'Retry 회차로', '현재 처리 경로에서 제한된 재시도를 수행합니다.', '1495,581 1657,565 1746,665 1633,747 1469,685', [1608, 650], [1459, 600], 'Retry 회차로'),
  'retry-1m': anchor('retry', 'retry-1m 대기장', '애플리케이션이 발행한 첫 번째 지연 retry topic입니다.', '1434,674 1523,653 1580,728 1490,779 1409,724', [1495, 714], [1392, 728], 'retry-1m'),
  'retry-10m': anchor('retry', 'retry-10m 대기장', '더 긴 backoff를 적용하는 retry topic입니다.', '1366,904 1452,875 1522,931 1437,996 1344,949', [1432, 934], [1336, 908], 'retry-10m'),
  dlt: anchor('retry', 'DLT 격리창고', '재시도를 소진한 record와 진단 context를 격리합니다.', '620,811 720,775 768,961 663,1040 592,939', [678, 910], [770, 838], 'DLT'),
  'transaction-coordinator': anchor('transaction', 'Transaction Coordinator', '출력과 offset의 commit 또는 abort 경계를 조정합니다.', '930,112 1035,95 1114,208 1011,279 913,215', [1003, 182], [1008, 289], 'TX Coordinator'),
} as const satisfies Record<string, AtlasAnchor>

export type AdvancedCityNodeId = keyof typeof ANCHORS

const SCENE_NODE_IDS: Record<AdvancedChapterId, readonly AdvancedCityNodeId[]> = {
  2: ['producer', 'partition-p0', 'partition-p1', 'partition-p2', 'application'],
  3: ['producer', 'broker-leader', 'broker-follower-1', 'broker-follower-2', 'partition-p1', 'retry-loop', 'application'],
  4: ['producer', 'broker-leader', 'broker-follower-1', 'broker-follower-2'],
  5: ['partition-p0', 'consumer-c1', 'application', 'offset-store'],
  6: ['partition-p0', 'partition-p1', 'partition-p2', 'consumer-c1', 'consumer-c2', 'consumer-c3', 'consumer-c4', 'consumer-c5', 'coordinator', 'offset-store', 'application'],
  7: ['partition-p0', 'consumer-c1', 'application', 'retry-loop', 'retry-1m', 'retry-10m', 'dlt', 'offset-store'],
  8: ['consumer-c1', 'application', 'producer', 'offset-store', 'transaction-coordinator'],
}

function createSceneRoutes(): Record<AdvancedChapterId, readonly CityRouteDefinition[]> {
  return {
  2: [
    route('producer-p0', 'producer', 'partition-p0', 'data'),
    route('producer-p1', 'producer', 'partition-p1', 'data'),
    route('producer-p2', 'producer', 'partition-p2', 'data'),
    route('p0-application', 'partition-p0', 'application', 'data'),
    route('p1-application', 'partition-p1', 'application', 'data'),
    route('p2-application', 'partition-p2', 'application', 'data'),
    route('application-producer-result', 'application', 'producer', 'return'),
  ],
  3: [
    route('producer-leader', 'producer', 'broker-leader', 'data'),
    route('leader-follower-1', 'broker-leader', 'broker-follower-1', 'replication'),
    route('leader-follower-2', 'broker-leader', 'broker-follower-2', 'replication'),
    route('producer-retry-loop', 'producer', 'retry-loop', 'retry'),
    route('retry-loop-leader', 'retry-loop', 'broker-leader', 'retry'),
    route('leader-partition', 'broker-leader', 'partition-p1', 'data'),
    route('leader-producer-ack', 'broker-leader', 'producer', 'return'),
    route('partition-application', 'partition-p1', 'application', 'data'),
  ],
  4: [
    route('producer-leader', 'producer', 'broker-leader', 'data'),
    route('leader-follower-1', 'broker-leader', 'broker-follower-1', 'replication'),
    route('leader-follower-2', 'broker-leader', 'broker-follower-2', 'replication'),
    route('follower-1-producer', 'broker-follower-1', 'producer', 'control'),
    route('leader-producer-ack', 'broker-leader', 'producer', 'return'),
  ],
  5: [
    route('p0-consumer', 'partition-p0', 'consumer-c1', 'data'),
    route('consumer-application', 'consumer-c1', 'application', 'data'),
    route('application-offset', 'application', 'offset-store', 'control'),
    route('consumer-offset', 'consumer-c1', 'offset-store', 'control'),
    route('offset-consumer-commit', 'offset-store', 'consumer-c1', 'return'),
  ],
  6: [
    route('coordinator-c1', 'coordinator', 'consumer-c1', 'control'),
    route('coordinator-c2', 'coordinator', 'consumer-c2', 'control'),
    route('coordinator-c3', 'coordinator', 'consumer-c3', 'control'),
    route('coordinator-c4', 'coordinator', 'consumer-c4', 'control'),
    route('coordinator-c5', 'coordinator', 'consumer-c5', 'control'),
    route('p0-c1', 'partition-p0', 'consumer-c1', 'data'),
    route('p1-c1', 'partition-p1', 'consumer-c1', 'data'),
    route('p1-c2', 'partition-p1', 'consumer-c2', 'data'),
    route('p2-c3', 'partition-p2', 'consumer-c3', 'data'),
    route('c1-offset', 'consumer-c1', 'offset-store', 'control'),
    route('c2-offset', 'consumer-c2', 'offset-store', 'control'),
    route('c1-application', 'consumer-c1', 'application', 'data'),
  ],
  7: [
    route('p0-consumer', 'partition-p0', 'consumer-c1', 'data'),
    route('consumer-application', 'consumer-c1', 'application', 'data'),
    route('application-retry-loop', 'application', 'retry-loop', 'retry'),
    route('application-retry-1m', 'application', 'retry-1m', 'retry'),
    route('retry-1m-retry-10m', 'retry-1m', 'retry-10m', 'retry'),
    route('retry-10m-application', 'retry-10m', 'application', 'retry'),
    route('application-dlt', 'application', 'dlt', 'data'),
    route('application-offset', 'application', 'offset-store', 'control'),
    route('offset-consumer-commit', 'offset-store', 'consumer-c1', 'return'),
  ],
  8: [
    route('consumer-application', 'consumer-c1', 'application', 'data'),
    route('application-producer', 'application', 'producer', 'data'),
    route('application-offset', 'application', 'offset-store', 'control'),
    route('transaction-application', 'transaction-coordinator', 'application', 'transaction'),
    route('producer-transaction', 'producer', 'transaction-coordinator', 'transaction'),
    route('transaction-offset', 'transaction-coordinator', 'offset-store', 'transaction'),
    route('transaction-consumer-result', 'transaction-coordinator', 'consumer-c1', 'return'),
  ],
  }
}

// Measured atlas road intersections. Kafka semantics reference route/checkpoint
// ids only; these waypoints can be remeasured without changing domain events.
const ROUTE_WAYPOINTS: Readonly<Record<string, readonly CityPoint[]>> = {
  'producer-p0': points([600, 500], [720, 455]),
  'producer-p1': points([600, 535], [760, 620], [910, 670]),
  'producer-p2': points([600, 535], [760, 620], [910, 670]),
  'p0-application': points([930, 440], [1040, 505]),
  'p1-application': points([1020, 610]),
  'p2-application': points([1020, 620]),
  'application-producer-result': points([910, 670], [760, 620], [600, 535]),
  'producer-leader': points([600, 535], [760, 620], [890, 675]),
  'leader-follower-1': points([1040, 620], [1150, 560], [1270, 500]),
  'leader-follower-2': points([1040, 620], [1200, 550], [1400, 600], [1530, 620]),
  'producer-retry-loop': points([600, 535], [760, 620], [930, 680], [1110, 620], [1280, 550]),
  'retry-loop-leader': points([1400, 620], [1240, 680], [1060, 700]),
  'leader-partition': points([960, 630]),
  'leader-producer-ack': points([890, 675], [760, 620], [600, 535]),
  'partition-application': points([1000, 600]),
  'follower-1-producer': points([1270, 500], [1150, 560], [1040, 620], [890, 675], [760, 620], [600, 535]),
  'p0-consumer': points([760, 480], [650, 600], [540, 700], [420, 780]),
  'consumer-application': points([500, 720], [700, 700], [890, 675]),
  'application-offset': points([1160, 555], [1270, 500], [1400, 560]),
  'consumer-offset': points([500, 720], [700, 700], [890, 675], [1050, 620], [1270, 500], [1400, 560]),
  'offset-consumer-commit': points([1400, 560], [1270, 500], [1050, 620], [890, 675], [700, 700], [500, 720]),
  'coordinator-c1': points([1270, 500], [1160, 555], [1050, 620], [890, 675], [700, 700], [500, 720], [420, 780]),
  'coordinator-c2': points([1270, 500], [1160, 555], [1050, 620], [890, 675], [760, 700], [650, 820]),
  'coordinator-c3': points([1270, 500], [1160, 555], [1050, 620], [1050, 760], [1050, 900]),
  'coordinator-c4': points([1270, 500], [1350, 580], [1400, 680]),
  'coordinator-c5': points([1270, 500], [1400, 560], [1530, 620]),
  'p0-c1': points([760, 480], [650, 600], [540, 700], [420, 780]),
  'p1-c1': points([910, 670], [760, 700], [600, 720], [420, 780]),
  'p1-c2': points([910, 670], [760, 700], [650, 820]),
  'p2-c3': points([1050, 700], [1050, 820]),
  'c1-offset': points([500, 720], [700, 700], [890, 675], [1050, 620], [1270, 500], [1400, 560]),
  'c2-offset': points([650, 820], [760, 700], [910, 670], [1050, 620], [1270, 500], [1400, 560]),
  'c1-application': points([500, 720], [700, 700], [890, 675]),
  'application-retry-loop': points([1160, 555], [1270, 500], [1400, 560]),
  'application-retry-1m': points([1160, 650], [1260, 700]),
  'retry-1m-retry-10m': points([1410, 780], [1370, 850]),
  'retry-10m-application': points([1250, 850], [1120, 760], [1040, 650]),
  'application-dlt': points([900, 675], [760, 700], [700, 800]),
  'application-producer': points([890, 675], [760, 620], [600, 535]),
  'transaction-application': points([1050, 380], [1160, 470], [1100, 540]),
  'producer-transaction': points([600, 500], [760, 440], [900, 360]),
  'transaction-offset': points([1130, 360], [1270, 430], [1400, 500]),
  'transaction-consumer-result': points([1130, 360], [1270, 430], [1270, 520], [1100, 620], [900, 675], [700, 700], [500, 720], [420, 780]),
}

const SCENE_ROUTES = createSceneRoutes()

export const ADVANCED_CHAPTER_SCENES: Readonly<Record<AdvancedChapterId, CitySceneDefinition>> = {
  2: scene(2, 'Partition routing district'),
  3: scene(3, 'Producer reliability district'),
  4: scene(4, 'Broker replication district'),
  5: scene(5, 'Consumer offset district'),
  6: scene(6, 'Consumer group district'),
  7: scene(7, 'Retry and DLT district'),
  8: scene(8, 'Transaction district'),
}

export function getAdvancedChapterScene(chapterId: AdvancedChapterId): CitySceneDefinition {
  return ADVANCED_CHAPTER_SCENES[chapterId]
}

const EXPERIMENT_PREVIEWS: Readonly<Record<string, CityScenePreview>> = {
  'same-key-same-partition': preview(['producer', 'partition-p0'], ['producer-p0']),
  'keyless-distribution': preview(['producer', 'partition-p0', 'partition-p1', 'partition-p2'], ['producer-p0', 'producer-p1', 'producer-p2']),
  'cross-partition-order': preview(['partition-p0', 'partition-p1', 'partition-p2', 'application'], ['p0-application', 'p1-application', 'p2-application']),
  'acks-leader-loss': preview(['producer', 'broker-leader', 'broker-follower-1', 'broker-follower-2'], ['producer-leader', 'leader-follower-1', 'leader-follower-2']),
  'retry-duplicate-order': preview(['producer', 'retry-loop', 'broker-leader', 'partition-p1'], ['producer-retry-loop', 'retry-loop-leader', 'leader-partition']),
  'idempotent-repair': preview(['producer', 'retry-loop', 'broker-leader', 'application'], ['producer-retry-loop', 'retry-loop-leader', 'partition-application']),
  'replica-lag': preview(['broker-leader', 'broker-follower-1', 'broker-follower-2'], ['leader-follower-1', 'leader-follower-2']),
  'min-isr-write-failure': preview(['producer', 'broker-leader', 'broker-follower-1', 'broker-follower-2'], ['producer-leader', 'leader-follower-1', 'leader-follower-2']),
  'leader-failover': preview(['producer', 'broker-leader', 'broker-follower-1'], ['producer-leader', 'follower-1-producer']),
  'poll-versus-process': preview(['partition-p0', 'consumer-c1', 'application'], ['p0-consumer', 'consumer-application']),
  'early-commit-loss': preview(['consumer-c1', 'application', 'offset-store'], ['consumer-application', 'consumer-offset']),
  'late-commit-replay': preview(['partition-p0', 'consumer-c1', 'application', 'offset-store'], ['p0-consumer', 'consumer-application', 'application-offset']),
  'assignment-capacity': preview(['partition-p0', 'partition-p1', 'partition-p2', 'consumer-c1', 'consumer-c2', 'consumer-c3', 'consumer-c4', 'consumer-c5', 'coordinator'], ['coordinator-c1', 'coordinator-c2', 'coordinator-c3', 'coordinator-c4', 'coordinator-c5']),
  'join-leave-rebalance': preview(['partition-p1', 'consumer-c1', 'consumer-c2', 'coordinator', 'offset-store'], ['coordinator-c1', 'coordinator-c2', 'p1-c2']),
  'poll-timeout': preview(['partition-p1', 'consumer-c1', 'coordinator', 'application', 'offset-store'], ['p1-c1', 'c1-application', 'c1-offset']),
  'blocking-retry': preview(['partition-p0', 'consumer-c1', 'application', 'retry-loop'], ['p0-consumer', 'consumer-application', 'application-retry-loop']),
  'staged-backoff': preview(['application', 'retry-1m', 'retry-10m'], ['application-retry-1m', 'retry-1m-retry-10m', 'retry-10m-application']),
  'dead-letter-evidence': preview(['application', 'retry-loop', 'dlt', 'offset-store'], ['application-retry-loop', 'application-dlt', 'application-offset']),
  'partial-transform': preview(['consumer-c1', 'application', 'producer', 'offset-store', 'transaction-coordinator'], ['consumer-application', 'application-producer', 'application-offset', 'transaction-application']),
  'transactional-repair': preview(['application', 'producer', 'offset-store', 'transaction-coordinator'], ['application-producer', 'producer-transaction', 'transaction-offset']),
  'isolation-visibility': preview(['consumer-c1', 'offset-store', 'transaction-coordinator'], ['transaction-offset', 'transaction-consumer-result']),
}

const CHOICE_PREVIEWS: Readonly<Record<string, CityScenePreview>> = {
  'random-key-per-record': preview(['producer', 'partition-p0', 'partition-p1', 'partition-p2'], ['producer-p0', 'producer-p1', 'producer-p2']),
  'stable-customer-key': preview(['producer', 'partition-p1'], ['producer-p1']),
  'omit-key-and-assume-order': preview(['producer', 'partition-p0', 'partition-p2'], ['producer-p0', 'producer-p2']),
  'restore-business-key': preview(['producer', 'partition-p2'], ['producer-p2']),
  'sort-offsets-globally': preview(['partition-p0', 'partition-p1', 'application'], ['p0-application', 'p1-application']),
  'partition-local-timeline': preview(['partition-p0', 'partition-p1', 'application'], ['p0-application', 'p1-application']),
  'leader-only-ack': preview(['producer', 'broker-leader'], ['producer-leader', 'leader-producer-ack']),
  'wait-for-isr-acks': preview(['producer', 'broker-leader', 'broker-follower-1', 'broker-follower-2'], ['producer-leader', 'leader-follower-1', 'leader-follower-2', 'leader-producer-ack']),
  'unbounded-non-idempotent-retry': preview(['producer', 'retry-loop', 'broker-leader', 'partition-p1'], ['producer-retry-loop', 'retry-loop-leader', 'leader-partition']),
  'idempotent-bounded-retry': preview(['producer', 'retry-loop', 'broker-leader', 'partition-p1', 'application'], ['producer-retry-loop', 'retry-loop-leader', 'leader-partition', 'partition-application']),
  'conflicting-idempotent-config': preview(['producer', 'retry-loop', 'broker-leader'], ['producer-retry-loop', 'retry-loop-leader']),
  'coherent-idempotent-config': preview(['producer', 'broker-leader', 'broker-follower-1', 'broker-follower-2', 'application'], ['producer-leader', 'leader-follower-1', 'leader-follower-2', 'partition-application']),
  'write-with-one-isr': preview(['producer', 'broker-leader'], ['producer-leader']),
  'restore-isr-before-write': preview(['producer', 'broker-leader', 'broker-follower-1'], ['leader-follower-1', 'leader-producer-ack']),
  'retry-before-election': preview(['producer', 'broker-leader'], ['producer-leader']),
  'wait-for-isr-leader-and-retry': preview(['producer', 'broker-follower-1'], ['leader-follower-1', 'follower-1-producer']),
  'treat-poll-as-complete': preview(['partition-p0', 'consumer-c1'], ['p0-consumer']),
  'process-then-commit': preview(['partition-p0', 'consumer-c1', 'application', 'offset-store'], ['p0-consumer', 'consumer-application', 'application-offset']),
  'commit-before-processing': preview(['consumer-c1', 'offset-store', 'application'], ['consumer-offset', 'consumer-application']),
  'commit-after-processing': preview(['consumer-c1', 'application', 'offset-store'], ['consumer-application', 'application-offset']),
  'add-consumers-only': preview(['partition-p0', 'partition-p1', 'partition-p2', 'consumer-c1', 'consumer-c2', 'consumer-c3', 'consumer-c4', 'consumer-c5', 'coordinator'], ['coordinator-c1', 'coordinator-c2', 'coordinator-c3', 'coordinator-c4', 'coordinator-c5']),
  'match-parallelism-to-partitions': preview(['partition-p0', 'partition-p1', 'partition-p2', 'consumer-c1', 'consumer-c2', 'consumer-c3', 'coordinator'], ['coordinator-c1', 'coordinator-c2', 'coordinator-c3']),
  'assume-broker-auto-retry-topics': preview(['application', 'retry-loop'], ['application-retry-loop']),
  'application-publishes-retry-topics': preview(['application', 'retry-1m', 'retry-10m'], ['application-retry-1m', 'retry-1m-retry-10m', 'retry-10m-application']),
  'commit-output-and-offset-separately': preview(['application', 'producer', 'offset-store'], ['application-producer', 'application-offset']),
  'use-atomic-transform-boundary': preview(['consumer-c1', 'application', 'producer', 'offset-store', 'transaction-coordinator'], ['consumer-application', 'transaction-application', 'producer-transaction', 'transaction-offset']),
  'transactional-output-only': preview(['application', 'producer', 'transaction-coordinator'], ['application-producer', 'producer-transaction']),
  'send-offsets-then-commit': preview(['application', 'producer', 'offset-store', 'transaction-coordinator'], ['application-producer', 'producer-transaction', 'transaction-offset']),
}

export function getExperimentCityPreview(experimentId: string, choiceId?: string): CityScenePreview {
  if (choiceId && CHOICE_PREVIEWS[choiceId]) return CHOICE_PREVIEWS[choiceId]
  return EXPERIMENT_PREVIEWS[experimentId] ?? { nodeIds: [], routeIds: [] }
}

function anchor(
  kind: CityNodeKind,
  label: string,
  description: string,
  polygonPoints: string,
  [x, y]: readonly [number, number],
  [roadX, roadY]: readonly [number, number],
  shortLabel?: string,
): AtlasAnchor {
  return {
    kind,
    label,
    description,
    hitAreaPath: `M${polygonPoints.replaceAll(' ', 'L')}Z`,
    labelPosition: { x, y },
    roadPosition: { x: roadX, y: roadY },
    ...(shortLabel ? { shortLabel } : {}),
  }
}

function preview(nodeIds: readonly string[], routeIds: readonly string[]): CityScenePreview {
  return { nodeIds, routeIds }
}

function points(...values: ReadonlyArray<readonly [number, number]>): readonly CityPoint[] {
  return values.map(([x, y]) => ({ x, y }))
}

function node(id: AdvancedCityNodeId): CityNodeDefinition {
  const source = ANCHORS[id]
  return {
    id,
    kind: source.kind,
    label: source.shortLabel ?? source.label,
    description: source.description,
    hitAreaPath: source.hitAreaPath,
    position: source.labelPosition,
    ariaLabel: source.label,
  }
}

function route(
  id: string,
  fromNodeId: AdvancedCityNodeId,
  toNodeId: AdvancedCityNodeId,
  kind: CityRouteKind,
): CityRouteDefinition {
  const start = ANCHORS[fromNodeId].roadPosition
  const end = ANCHORS[toNodeId].roadPosition
  const waypoints = ROUTE_WAYPOINTS[id]
  if (!waypoints) throw new Error(`Route ${id} requires measured atlas waypoints.`)
  const pathPoints = [start, ...waypoints, end]
  const midpoint = pathPoints[Math.floor(pathPoints.length / 2)] ?? start
  return {
    id,
    fromNodeId,
    toNodeId,
    kind,
    label: `${ANCHORS[fromNodeId].label} → ${ANCHORS[toNodeId].label}`,
    path: pathPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' '),
    checkpoints: [
      { id: `${id}:start`, position: start, nodeId: fromNodeId },
      { id: `${id}:mid`, position: midpoint, label: '이동 중' },
      { id: `${id}:end`, position: end, nodeId: toNodeId },
    ],
  }
}

function scene(chapterId: AdvancedChapterId, label: string): CitySceneDefinition {
  return {
    id: `chapter-${chapterId}-city`,
    label,
    viewport: { width: 1920, height: 1047 },
    nodes: SCENE_NODE_IDS[chapterId].map(node),
    routes: SCENE_ROUTES[chapterId],
    ...(chapterId === 8
      ? {
          boundaries: [{
            id: 'consume-transform-produce-tx',
            kind: 'transaction' as const,
            label: 'OUTPUT + OFFSET · ATOMIC BOUNDARY',
            path: 'M410 170L1070 85L1690 350L1580 570L1040 645L420 525Z',
            nodeIds: ['consumer-c1', 'application', 'producer', 'offset-store', 'transaction-coordinator'],
          }],
        }
      : {}),
  }
}
