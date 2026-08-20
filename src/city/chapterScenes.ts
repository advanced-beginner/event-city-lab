import type {
  CityNodeDefinition,
  CityNodeKind,
  CityPoint,
  CityRouteDefinition,
  CityRouteKind,
  CitySceneDefinition,
} from './types'
import { interpolatePolyline } from './routeGeometry'

type AdvancedChapterId = 2 | 3 | 4 | 5 | 6 | 7 | 8

interface AtlasAnchor {
  kind: CityNodeKind
  label: string
  description: string
  hitAreaPath: string
  labelPosition: CityPoint
  roadAccessIndex: number
  shortLabel?: string
}

interface RoadsideBuilding {
  hitAreaPath: string
  labelPosition: CityPoint
  roadAccessIndex: number
}

export interface CityScenePreview {
  nodeIds: readonly string[]
  routeIds: readonly string[]
}

// The atlas has one prominent southwest-to-northeast arterial through downtown.
// Every Chapter 2–8 facility is assigned to one of these roadside buildings so
// every record carrier can stay on the same road spine.
export const ADVANCED_CITY_MAIN_ROAD_POINTS = points(
  [235, 704], [382, 646], [548, 590], [706, 642], [866, 666], [1018, 608],
  [1164, 552], [1308, 500], [1450, 452], [1602, 410], [1760, 368],
)

const ROADSIDE_BUILDINGS = [
  roadsideBuilding('170,590 278,538 358,604 315,718 210,754 145,680', [256, 630], 0),
  roadsideBuilding('300,468 418,425 486,548 420,641 314,604 270,532', [382, 538], 1),
  roadsideBuilding('477,221 584,201 630,493 506,536 431,450', [541, 410], 2),
  roadsideBuilding('635,330 721,307 779,493 700,554 622,470', [700, 447], 3),
  roadsideBuilding('744,356 843,333 921,560 793,637 712,565', [815, 505], 4),
  roadsideBuilding('887,377 1002,348 1044,521 934,566 875,495', [953, 463], 5),
  roadsideBuilding('1013,302 1155,292 1221,515 1071,583 983,488', [1098, 452], 6),
  roadsideBuilding('1211,475 1352,465 1427,583 1282,647 1195,568', [1305, 548], 7),
  roadsideBuilding('1262,223 1346,200 1403,357 1312,410 1238,347', [1324, 304], 8),
  roadsideBuilding('1459,357 1601,338 1684,442 1575,524 1423,468', [1558, 430], 9),
  roadsideBuilding('1697,400 1857,398 1906,557 1741,641 1644,554', [1780, 506], 10),
] as const satisfies readonly RoadsideBuilding[]

const ANCHORS = {
  producer: anchor('producer', 'Producer 출발센터', 'Kafka record를 만들고 전송하는 출발 시설입니다.', 0, 'Producer'),
  application: anchor('application', 'Application 처리공장', '업무 규칙과 변환, 재시도 정책을 실행합니다.', 9, 'Application'),
  'broker-leader': anchor('broker', 'Broker Leader 기록센터', '현재 partition leader가 record를 append하는 기록센터입니다.', 5, 'Leader'),
  'broker-follower-1': anchor('replica', 'Broker Follower 1', 'Leader 기록을 복제하는 follower replica입니다.', 6, 'Follower 1'),
  'broker-follower-2': anchor('replica', 'Broker Follower 2', 'Leader 기록을 복제하는 follower replica입니다.', 8, 'Follower 2'),
  'partition-p0': anchor('partition', 'Partition p0 적재장', 'p0의 독립적인 append 순서와 offset을 보관합니다.', 1, 'p0'),
  'partition-p1': anchor('partition', 'Partition p1 적재장', 'p1의 독립적인 append 순서와 offset을 보관합니다.', 2, 'p1'),
  'partition-p2': anchor('partition', 'Partition p2 적재장', 'p2의 독립적인 append 순서와 offset을 보관합니다.', 3, 'p2'),
  'consumer-c1': anchor('consumer', 'Consumer c1 수령센터', '할당받은 partition에서 record를 poll합니다.', 4, 'c1'),
  'consumer-c2': anchor('consumer', 'Consumer c2 수령센터', '할당받은 partition에서 record를 poll합니다.', 5, 'c2'),
  'consumer-c3': anchor('consumer', 'Consumer c3 수령센터', '할당받은 partition에서 record를 poll합니다.', 6, 'c3'),
  'consumer-c4': anchor('consumer', 'Consumer c4 대기 차고', 'partition을 배정받지 못하면 IDLE 상태로 대기합니다.', 7, 'c4 · IDLE'),
  'consumer-c5': anchor('consumer', 'Consumer c5 대기 차고', 'partition을 배정받지 못하면 IDLE 상태로 대기합니다.', 8, 'c5 · IDLE'),
  coordinator: anchor('coordinator', 'Group Coordinator 관제탑', '멤버십과 partition assignment를 조정합니다.', 0, 'Coordinator'),
  'offset-store': anchor('offset', 'Offset Store 검표소', 'Consumer group의 다음 읽기 위치를 보관합니다.', 10, 'Offset Store'),
  'retry-loop': anchor('retry', 'Retry 회차로', '현재 처리 경로에서 제한된 재시도를 수행합니다.', 7, 'Retry 회차로'),
  'retry-1m': anchor('retry', 'retry-1m 대기장', '애플리케이션이 발행한 첫 번째 지연 retry topic입니다.', 5, 'retry-1m'),
  'retry-10m': anchor('retry', 'retry-10m 대기장', '더 긴 backoff를 적용하는 retry topic입니다.', 6, 'retry-10m'),
  dlt: anchor('retry', 'DLT 격리창고', '재시도를 소진한 record와 진단 context를 격리합니다.', 8, 'DLT'),
  'transaction-coordinator': anchor('transaction', 'Transaction Coordinator', '출력과 offset의 commit 또는 abort 경계를 조정합니다.', 8, 'TX Coordinator'),
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
  roadAccessIndex: number,
  shortLabel?: string,
): AtlasAnchor {
  const building = ROADSIDE_BUILDINGS[roadAccessIndex]
  if (!building) throw new Error(`Roadside building ${roadAccessIndex} is not defined.`)
  return {
    kind,
    label,
    description,
    ...building,
    ...(shortLabel ? { shortLabel } : {}),
  }
}

function roadsideBuilding(
  polygonPoints: string,
  [x, y]: readonly [number, number],
  roadAccessIndex: number,
): RoadsideBuilding {
  return {
    hitAreaPath: `M${polygonPoints.replaceAll(' ', 'L')}Z`,
    labelPosition: { x, y },
    roadAccessIndex,
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
    roadAccessIndex: source.roadAccessIndex,
    ariaLabel: source.label,
  }
}

function route(
  id: string,
  fromNodeId: AdvancedCityNodeId,
  toNodeId: AdvancedCityNodeId,
  kind: CityRouteKind,
): CityRouteDefinition {
  const pathPoints = roadSlice(
    ADVANCED_CITY_MAIN_ROAD_POINTS,
    ANCHORS[fromNodeId].roadAccessIndex,
    ANCHORS[toNodeId].roadAccessIndex,
  )
  const start = pathPoints[0]!
  const end = pathPoints.at(-1)!
  const midpoint = interpolatePolyline(pathPoints, 0.5)
  return {
    id,
    fromNodeId,
    toNodeId,
    kind,
    label: `${ANCHORS[fromNodeId].label} → ${ANCHORS[toNodeId].label}`,
    path: pathPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' '),
    points: pathPoints,
    checkpoints: [
      { id: `${id}:start`, position: start, progress: 0, nodeId: fromNodeId },
      { id: `${id}:mid`, position: midpoint, progress: 0.5, label: '이동 중' },
      { id: `${id}:end`, position: end, progress: 1, nodeId: toNodeId },
    ],
  }
}

function roadSlice(points: readonly CityPoint[], fromIndex: number, toIndex: number): readonly CityPoint[] {
  const start = Math.min(fromIndex, toIndex)
  const end = Math.max(fromIndex, toIndex)
  const slice = points.slice(start, end + 1)
  return fromIndex <= toIndex ? slice : slice.reverse()
}

function scene(chapterId: AdvancedChapterId, label: string): CitySceneDefinition {
  return {
    id: `chapter-${chapterId}-city`,
    label,
    viewport: { width: 1920, height: 1047 },
    mainRoad: {
      id: 'downtown-main-arterial',
      path: ADVANCED_CITY_MAIN_ROAD_POINTS.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' '),
      points: ADVANCED_CITY_MAIN_ROAD_POINTS,
    },
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
