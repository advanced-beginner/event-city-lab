import { createIsoPrism, DIORAMA_VIEWPORT, isoPoint } from './isometric'
import { interpolatePolyline } from './routeGeometry'
import type {
  CityBuildingArchetype,
  CityBuildingFootprint,
  CityCheckpointDefinition,
  CityGridBounds,
  CityGridCoord,
  CityNodeDefinition,
  CityNodeKind,
  CityPhysicalFacilityDefinition,
  CityPoint,
  CityRouteDefinition,
  CityRouteKind,
  CitySceneDefinition,
} from './types'

export type DioramaChapterId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type AdvancedChapterId = 2 | 3 | 4 | 5 | 6 | 7 | 8

export interface CityScenePreview {
  nodeIds: readonly string[]
  routeIds: readonly string[]
}

interface NodeBlueprint {
  kind: CityNodeKind
  archetype: CityBuildingArchetype
  label: string
  koreanLabel: string
  description: string
  shortLabel?: string
  footprint?: CityBuildingFootprint
}

const DEFAULT_FOOTPRINT: Record<CityBuildingArchetype, CityBuildingFootprint> = {
  warehouse: { u: 1.25, v: 1.25, height: 54 },
  gate: { u: 1.05, v: 1.35, height: 64 },
  hub: { u: 1.35, v: 1.35, height: 68 },
  tower: { u: 1.0, v: 1.0, height: 86 },
  loop: { u: 1.15, v: 1.15, height: 42 },
  vault: { u: 1.15, v: 1.15, height: 58 },
  checkpoint: { u: 1.05, v: 1.05, height: 48 },
  factory: { u: 1.35, v: 1.35, height: 64 },
}

const NODE_BLUEPRINTS = {
  producer: blueprint('producer', 'warehouse', 'Producer', '출발센터', 'Kafka record를 만들고 직렬화해 전송하는 출발 시설입니다.'),
  serializer: blueprint('serializer', 'gate', 'Serializer', '검사소', '네트워크 전송 전 value 타입과 호환성을 검사하는 관문입니다.'),
  broker: blueprint('broker', 'hub', 'Broker', '기록센터', '전달된 메시지를 partition 로그에 append하고 ACK를 회신합니다.'),
  application: blueprint('application', 'factory', 'Application', '처리공장', '업무 규칙과 변환, 재시도 정책을 실행합니다.'),
  'broker-leader': blueprint('broker', 'hub', 'Broker Leader', '기록센터', '현재 partition leader가 record를 append하는 기록센터입니다.', 'Leader'),
  'broker-follower-1': blueprint('replica', 'tower', 'Follower 1', '복제 타워', 'Leader 기록을 복제하는 follower replica입니다.', 'Follower 1'),
  'broker-follower-2': blueprint('replica', 'tower', 'Follower 2', '복제 타워', 'Leader 기록을 복제하는 follower replica입니다.', 'Follower 2'),
  'partition-p0': blueprint('partition', 'hub', 'Partition p0', '적재장', 'p0의 독립적인 append 순서와 offset을 보관합니다.', 'p0'),
  'partition-p1': blueprint('partition', 'hub', 'Partition p1', '적재장', 'p1의 독립적인 append 순서와 offset을 보관합니다.', 'p1'),
  'partition-p2': blueprint('partition', 'hub', 'Partition p2', '적재장', 'p2의 독립적인 append 순서와 offset을 보관합니다.', 'p2'),
  'consumer-c1': blueprint('consumer', 'warehouse', 'Consumer c1', '수령센터', '할당받은 partition에서 record를 poll합니다.', 'c1'),
  'consumer-c2': blueprint('consumer', 'warehouse', 'Consumer c2', '수령센터', '할당받은 partition에서 record를 poll합니다.', 'c2'),
  'consumer-c3': blueprint('consumer', 'warehouse', 'Consumer c3', '수령센터', '할당받은 partition에서 record를 poll합니다.', 'c3'),
  'consumer-c4': blueprint('consumer', 'warehouse', 'Consumer c4', '대기 차고', 'partition을 배정받지 못하면 IDLE 상태로 대기합니다.', 'c4 · IDLE'),
  'consumer-c5': blueprint('consumer', 'warehouse', 'Consumer c5', '대기 차고', 'partition을 배정받지 못하면 IDLE 상태로 대기합니다.', 'c5 · IDLE'),
  coordinator: blueprint('coordinator', 'tower', 'Coordinator', '그룹 관제탑', '멤버십과 partition assignment를 조정합니다.', 'Coordinator'),
  'offset-store': blueprint('offset', 'checkpoint', 'Offset Store', '검표소', 'Consumer group의 다음 읽기 위치를 보관합니다.', 'Offset Store'),
  'retry-loop': blueprint('retry', 'loop', 'Retry 회차로', '인메모리 재시도', '현재 처리 경로에서 제한된 재시도를 수행합니다.', 'Retry 회차로'),
  'retry-1m': blueprint('retry', 'checkpoint', 'retry-1m', '1분 지연 대기장', '애플리케이션이 발행한 첫 번째 지연 retry topic입니다.', 'retry-1m'),
  'retry-10m': blueprint('retry', 'checkpoint', 'retry-10m', '10분 지연 대기장', '더 긴 backoff를 적용하는 retry topic입니다.', 'retry-10m'),
  dlt: blueprint('retry', 'vault', 'DLT', '독성 메시지 격리창고', '재시도를 소진한 record와 진단 context를 격리합니다.', 'DLT'),
  'transaction-coordinator': blueprint('transaction', 'tower', 'TX Coordinator', '트랜잭션 관제탑', '출력과 offset의 commit 또는 abort 경계를 조정합니다.', 'TX Coordinator'),
} as const satisfies Record<string, NodeBlueprint>

export type DioramaNodeId = keyof typeof NODE_BLUEPRINTS

interface ChapterNodePlacement {
  id: DioramaNodeId
  grid: CityGridCoord
  facilityId?: string
}

interface ChapterRouteSpec {
  id: string
  from: DioramaNodeId
  to: DioramaNodeId
  kind: CityRouteKind
  via?: ReadonlyArray<readonly [number, number]>
}

interface ChapterSceneBlueprint {
  chapterId: DioramaChapterId
  label: string
  gridBounds: CityGridBounds
  initialVehicleRouteId: string
  placements: readonly ChapterNodePlacement[]
  complexes?: readonly {
    id: string
    label: string
    koreanLabel: string
    archetype: CityBuildingArchetype
    grid: CityGridCoord
    footprint: CityBuildingFootprint
  }[]
  routes: readonly ChapterRouteSpec[]
  boundaries?: CitySceneDefinition['boundaries']
}

const CHAPTER_BLUEPRINTS: Readonly<Record<DioramaChapterId, ChapterSceneBlueprint>> = {
  1: {
    chapterId: 1,
    label: 'Chapter 1 · Producer & Serializer 디오라마',
    gridBounds: { minU: 0.4, maxU: 9.6, minV: 2.2, maxV: 7.8 },
    initialVehicleRouteId: 'producer-serializer',
    placements: [
      { id: 'producer', grid: { u: 2.0, v: 5.0 } },
      { id: 'serializer', grid: { u: 5.0, v: 5.0 } },
      { id: 'broker', grid: { u: 8.0, v: 5.0 } },
    ],
    routes: [
      { id: 'producer-serializer', from: 'producer', to: 'serializer', kind: 'data' },
      { id: 'serializer-broker', from: 'serializer', to: 'broker', kind: 'data' },
      { id: 'broker-producer-ack', from: 'broker', to: 'producer', kind: 'return', via: [[8.0, 3.2], [2.0, 3.2]] },
    ],
  },
  2: {
    chapterId: 2,
    label: 'Chapter 2 · Partition 분기 물류 지구',
    gridBounds: { minU: 0.4, maxU: 9.8, minV: 1.0, maxV: 9.2 },
    initialVehicleRouteId: 'producer-p1',
    placements: [
      { id: 'producer', grid: { u: 1.8, v: 5.0 } },
      { id: 'partition-p0', grid: { u: 5.1, v: 2.3 } },
      { id: 'partition-p1', grid: { u: 5.1, v: 5.0 } },
      { id: 'partition-p2', grid: { u: 5.1, v: 7.7 } },
      { id: 'application', grid: { u: 8.4, v: 5.0 } },
    ],
    routes: [
      { id: 'producer-p0', from: 'producer', to: 'partition-p0', kind: 'data', via: [[3.4, 5.0], [3.4, 2.3]] },
      { id: 'producer-p1', from: 'producer', to: 'partition-p1', kind: 'data' },
      { id: 'producer-p2', from: 'producer', to: 'partition-p2', kind: 'data', via: [[3.4, 5.0], [3.4, 7.7]] },
      { id: 'p0-application', from: 'partition-p0', to: 'application', kind: 'data', via: [[6.8, 2.3], [6.8, 5.0]] },
      { id: 'p1-application', from: 'partition-p1', to: 'application', kind: 'data' },
      { id: 'p2-application', from: 'partition-p2', to: 'application', kind: 'data', via: [[6.8, 7.7], [6.8, 5.0]] },
      { id: 'application-producer-result', from: 'application', to: 'producer', kind: 'return', via: [[8.4, 8.9], [1.8, 8.9]] },
    ],
  },
  3: {
    chapterId: 3,
    label: 'Chapter 3 · ACK·재시도·멱등성 지구',
    gridBounds: { minU: 0.3, maxU: 10.2, minV: 1.0, maxV: 9.2 },
    initialVehicleRouteId: 'producer-leader',
    placements: [
      { id: 'producer', grid: { u: 1.5, v: 5.2 } },
      { id: 'retry-loop', grid: { u: 3.1, v: 2.2 } },
      { id: 'broker-leader', grid: { u: 4.9, v: 5.2 } },
      { id: 'broker-follower-1', grid: { u: 5.7, v: 2.2 } },
      { id: 'broker-follower-2', grid: { u: 5.5, v: 8.0 } },
      { id: 'partition-p1', grid: { u: 7.1, v: 5.2 } },
      { id: 'application', grid: { u: 9.1, v: 5.2 } },
    ],
    routes: [
      { id: 'producer-leader', from: 'producer', to: 'broker-leader', kind: 'data' },
      { id: 'leader-follower-1', from: 'broker-leader', to: 'broker-follower-1', kind: 'replication', via: [[5.7, 5.2]] },
      { id: 'leader-follower-2', from: 'broker-leader', to: 'broker-follower-2', kind: 'replication', via: [[5.5, 5.2]] },
      { id: 'producer-retry-loop', from: 'producer', to: 'retry-loop', kind: 'retry', via: [[1.5, 2.2]] },
      { id: 'retry-loop-leader', from: 'retry-loop', to: 'broker-leader', kind: 'retry', via: [[4.3, 2.2], [4.3, 5.2]] },
      { id: 'leader-partition', from: 'broker-leader', to: 'partition-p1', kind: 'data' },
      { id: 'leader-producer-ack', from: 'broker-leader', to: 'producer', kind: 'return', via: [[4.9, 7.0], [1.5, 7.0]] },
      { id: 'partition-application', from: 'partition-p1', to: 'application', kind: 'data' },
    ],
  },
  4: {
    chapterId: 4,
    label: 'Chapter 4 · Broker 복제와 ISR 지구',
    gridBounds: { minU: 0.4, maxU: 9.4, minV: 1.0, maxV: 9.0 },
    initialVehicleRouteId: 'producer-leader',
    placements: [
      { id: 'producer', grid: { u: 1.8, v: 5.0 } },
      { id: 'broker-leader', grid: { u: 5.0, v: 5.0 } },
      { id: 'broker-follower-1', grid: { u: 7.8, v: 2.4 } },
      { id: 'broker-follower-2', grid: { u: 7.8, v: 7.6 } },
    ],
    routes: [
      { id: 'producer-leader', from: 'producer', to: 'broker-leader', kind: 'data' },
      { id: 'leader-follower-1', from: 'broker-leader', to: 'broker-follower-1', kind: 'replication', via: [[5.0, 2.4]] },
      { id: 'leader-follower-2', from: 'broker-leader', to: 'broker-follower-2', kind: 'replication', via: [[5.0, 7.6]] },
      { id: 'follower-1-producer', from: 'broker-follower-1', to: 'producer', kind: 'control', via: [[1.8, 2.4]] },
      { id: 'leader-producer-ack', from: 'broker-leader', to: 'producer', kind: 'return', via: [[5.0, 6.7], [1.8, 6.7]] },
    ],
  },
  5: {
    chapterId: 5,
    label: 'Chapter 5 · Consumer Poll과 Offset 지구',
    gridBounds: { minU: 0.4, maxU: 9.6, minV: 1.8, maxV: 9.0 },
    initialVehicleRouteId: 'p0-consumer',
    placements: [
      { id: 'partition-p0', grid: { u: 1.8, v: 4.5 } },
      { id: 'consumer-c1', grid: { u: 5.0, v: 4.5 } },
      { id: 'application', grid: { u: 8.2, v: 4.5 } },
      { id: 'offset-store', grid: { u: 6.6, v: 7.7 } },
    ],
    routes: [
      { id: 'p0-consumer', from: 'partition-p0', to: 'consumer-c1', kind: 'data' },
      { id: 'consumer-application', from: 'consumer-c1', to: 'application', kind: 'data' },
      { id: 'application-offset', from: 'application', to: 'offset-store', kind: 'control', via: [[8.2, 7.7]] },
      { id: 'consumer-offset', from: 'consumer-c1', to: 'offset-store', kind: 'control', via: [[5.0, 7.7]] },
      { id: 'offset-consumer-commit', from: 'offset-store', to: 'consumer-c1', kind: 'return', via: [[5.0, 7.7]] },
    ],
  },
  6: {
    chapterId: 6,
    label: 'Chapter 6 · Consumer Group & Rebalance 지구',
    gridBounds: { minU: 0.4, maxU: 10.0, minV: 0.8, maxV: 9.4 },
    initialVehicleRouteId: 'p0-c1',
    complexes: [
      {
        id: 'slot-partitions',
        label: 'Partitions p0–p2',
        koreanLabel: '파티션 터미널',
        archetype: 'hub',
        grid: { u: 1.8, v: 5.0 },
        footprint: { u: 1.3, v: 3.4, height: 64 },
      },
      {
        id: 'slot-consumers',
        label: 'Consumers c1–c5',
        koreanLabel: '컨슈머 플릿',
        archetype: 'warehouse',
        grid: { u: 6.0, v: 5.0 },
        footprint: { u: 1.3, v: 4.2, height: 60 },
      },
    ],
    placements: [
      { id: 'partition-p0', grid: { u: 1.8, v: 3.8 }, facilityId: 'slot-partitions' },
      { id: 'partition-p1', grid: { u: 1.8, v: 5.0 }, facilityId: 'slot-partitions' },
      { id: 'partition-p2', grid: { u: 1.8, v: 6.2 }, facilityId: 'slot-partitions' },
      { id: 'coordinator', grid: { u: 4.6, v: 1.9 } },
      { id: 'consumer-c1', grid: { u: 6.0, v: 3.4 }, facilityId: 'slot-consumers' },
      { id: 'consumer-c2', grid: { u: 6.0, v: 4.2 }, facilityId: 'slot-consumers' },
      { id: 'consumer-c3', grid: { u: 6.0, v: 5.0 }, facilityId: 'slot-consumers' },
      { id: 'consumer-c4', grid: { u: 6.0, v: 5.8 }, facilityId: 'slot-consumers' },
      { id: 'consumer-c5', grid: { u: 6.0, v: 6.6 }, facilityId: 'slot-consumers' },
      { id: 'offset-store', grid: { u: 4.6, v: 8.2 } },
      { id: 'application', grid: { u: 8.8, v: 5.0 } },
    ],
    routes: [
      { id: 'coordinator-c1', from: 'coordinator', to: 'consumer-c1', kind: 'control', via: [[5.2, 1.9], [5.2, 3.4]] },
      { id: 'coordinator-c2', from: 'coordinator', to: 'consumer-c2', kind: 'control', via: [[5.2, 1.9], [5.2, 4.2]] },
      { id: 'coordinator-c3', from: 'coordinator', to: 'consumer-c3', kind: 'control', via: [[5.2, 1.9], [5.2, 5.0]] },
      { id: 'coordinator-c4', from: 'coordinator', to: 'consumer-c4', kind: 'control', via: [[5.2, 1.9], [5.2, 5.8]] },
      { id: 'coordinator-c5', from: 'coordinator', to: 'consumer-c5', kind: 'control', via: [[5.2, 1.9], [5.2, 6.6]] },
      { id: 'p0-c1', from: 'partition-p0', to: 'consumer-c1', kind: 'data', via: [[3.6, 3.8], [3.6, 3.4]] },
      { id: 'p1-c1', from: 'partition-p1', to: 'consumer-c1', kind: 'data', via: [[3.9, 5.0], [3.9, 3.4]] },
      { id: 'p1-c2', from: 'partition-p1', to: 'consumer-c2', kind: 'data', via: [[4.2, 5.0], [4.2, 4.2]] },
      { id: 'p2-c3', from: 'partition-p2', to: 'consumer-c3', kind: 'data', via: [[4.5, 6.2], [4.5, 5.0]] },
      { id: 'c1-offset', from: 'consumer-c1', to: 'offset-store', kind: 'control', via: [[4.6, 3.4]] },
      { id: 'c2-offset', from: 'consumer-c2', to: 'offset-store', kind: 'control', via: [[4.9, 4.2], [4.9, 8.2]] },
      { id: 'c1-application', from: 'consumer-c1', to: 'application', kind: 'data', via: [[7.4, 3.4], [7.4, 5.0]] },
    ],
  },
  7: {
    chapterId: 7,
    label: 'Chapter 7 · Retry 회차로 & DLT 격리 지구',
    gridBounds: { minU: 0.3, maxU: 10.4, minV: 1.0, maxV: 9.4 },
    initialVehicleRouteId: 'p0-consumer',
    placements: [
      { id: 'partition-p0', grid: { u: 1.4, v: 5.2 } },
      { id: 'consumer-c1', grid: { u: 3.6, v: 5.2 } },
      { id: 'application', grid: { u: 5.9, v: 5.2 } },
      { id: 'retry-loop', grid: { u: 5.9, v: 2.3 } },
      { id: 'retry-1m', grid: { u: 8.1, v: 2.3 } },
      { id: 'retry-10m', grid: { u: 9.2, v: 4.3 } },
      { id: 'offset-store', grid: { u: 4.4, v: 8.1 } },
      { id: 'dlt', grid: { u: 8.2, v: 8.0 } },
    ],
    routes: [
      { id: 'p0-consumer', from: 'partition-p0', to: 'consumer-c1', kind: 'data' },
      { id: 'consumer-application', from: 'consumer-c1', to: 'application', kind: 'data' },
      { id: 'application-retry-loop', from: 'application', to: 'retry-loop', kind: 'retry' },
      { id: 'application-retry-1m', from: 'application', to: 'retry-1m', kind: 'retry', via: [[7.5, 5.2], [7.5, 2.3]] },
      { id: 'retry-1m-retry-10m', from: 'retry-1m', to: 'retry-10m', kind: 'retry', via: [[9.2, 2.3]] },
      { id: 'retry-10m-application', from: 'retry-10m', to: 'application', kind: 'retry', via: [[9.2, 5.2]] },
      { id: 'application-dlt', from: 'application', to: 'dlt', kind: 'data', via: [[5.9, 8.0]] },
      { id: 'application-offset', from: 'application', to: 'offset-store', kind: 'control', via: [[5.9, 8.1]] },
      { id: 'offset-consumer-commit', from: 'offset-store', to: 'consumer-c1', kind: 'return', via: [[3.6, 8.1]] },
    ],
  },
  8: {
    chapterId: 8,
    label: 'Chapter 8 · Transaction 원자적 경계 지구',
    gridBounds: { minU: 0.4, maxU: 9.8, minV: 0.8, maxV: 9.3 },
    initialVehicleRouteId: 'consumer-application',
    placements: [
      { id: 'consumer-c1', grid: { u: 1.8, v: 5.0 } },
      { id: 'application', grid: { u: 5.1, v: 5.0 } },
      { id: 'producer', grid: { u: 8.4, v: 5.0 } },
      { id: 'transaction-coordinator', grid: { u: 5.1, v: 2.0 } },
      { id: 'offset-store', grid: { u: 6.8, v: 8.0 } },
    ],
    routes: [
      { id: 'consumer-application', from: 'consumer-c1', to: 'application', kind: 'data' },
      { id: 'application-producer', from: 'application', to: 'producer', kind: 'data' },
      { id: 'application-offset', from: 'application', to: 'offset-store', kind: 'control', via: [[5.1, 8.0]] },
      { id: 'transaction-application', from: 'transaction-coordinator', to: 'application', kind: 'transaction' },
      { id: 'producer-transaction', from: 'producer', to: 'transaction-coordinator', kind: 'transaction', via: [[8.4, 2.0]] },
      { id: 'transaction-offset', from: 'transaction-coordinator', to: 'offset-store', kind: 'transaction', via: [[6.8, 2.0]] },
      { id: 'transaction-consumer-result', from: 'transaction-coordinator', to: 'consumer-c1', kind: 'return', via: [[1.8, 2.0]] },
    ],
    boundaries: [
      {
        id: 'consume-transform-produce-tx',
        kind: 'transaction',
        label: 'OUTPUT + OFFSET · ATOMIC BOUNDARY',
        path: 'M510 175 L1080 120 L1320 420 L980 760 L440 600 Z',
        nodeIds: ['consumer-c1', 'application', 'producer', 'offset-store', 'transaction-coordinator'],
      },
    ],
  },
}

const SCENES: Readonly<Record<DioramaChapterId, CitySceneDefinition>> = {
  1: buildScene(CHAPTER_BLUEPRINTS[1]),
  2: buildScene(CHAPTER_BLUEPRINTS[2]),
  3: buildScene(CHAPTER_BLUEPRINTS[3]),
  4: buildScene(CHAPTER_BLUEPRINTS[4]),
  5: buildScene(CHAPTER_BLUEPRINTS[5]),
  6: buildScene(CHAPTER_BLUEPRINTS[6]),
  7: buildScene(CHAPTER_BLUEPRINTS[7]),
  8: buildScene(CHAPTER_BLUEPRINTS[8]),
}

export const ADVANCED_CHAPTER_SCENES: Readonly<Record<AdvancedChapterId, CitySceneDefinition>> = {
  2: SCENES[2],
  3: SCENES[3],
  4: SCENES[4],
  5: SCENES[5],
  6: SCENES[6],
  7: SCENES[7],
  8: SCENES[8],
}

export function getChapterScene(chapterId: DioramaChapterId): CitySceneDefinition {
  return SCENES[chapterId]
}

export function getChapterOneScene(): CitySceneDefinition {
  return SCENES[1]
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
  'partition-local-timeline': preview(['partition-p0', 'partition-p1', 'partition-p2', 'application'], ['p0-application', 'p1-application', 'p2-application']),
  'leader-only-ack': preview(['producer', 'broker-leader'], ['producer-leader', 'leader-producer-ack']),
  'wait-for-isr-acks': preview(['producer', 'broker-leader', 'broker-follower-1', 'broker-follower-2'], ['producer-leader', 'leader-follower-1', 'leader-follower-2', 'leader-producer-ack']),
  'unbounded-non-idempotent-retry': preview(['producer', 'retry-loop', 'broker-leader', 'partition-p1'], ['producer-retry-loop', 'retry-loop-leader', 'leader-partition']),
  'idempotent-bounded-retry': preview(['producer', 'retry-loop', 'broker-leader', 'partition-p1', 'application'], ['producer-retry-loop', 'retry-loop-leader', 'leader-partition', 'partition-application']),
  'conflicting-idempotent-config': preview(['producer', 'retry-loop', 'broker-leader'], ['producer-retry-loop', 'retry-loop-leader']),
  'coherent-idempotent-config': preview(['producer', 'broker-leader', 'broker-follower-1', 'broker-follower-2', 'application'], ['producer-leader', 'leader-follower-1', 'leader-follower-2', 'partition-application']),
  'trust-replication-factor': preview(['broker-leader', 'broker-follower-1', 'broker-follower-2'], ['leader-follower-1', 'leader-follower-2']),
  'inspect-current-isr': preview(['producer', 'broker-leader', 'broker-follower-1', 'broker-follower-2'], ['leader-follower-1', 'leader-follower-2', 'leader-producer-ack']),
  'write-with-one-isr': preview(['producer', 'broker-leader'], ['producer-leader']),
  'restore-isr-before-write': preview(['producer', 'broker-leader', 'broker-follower-1'], ['leader-follower-1', 'leader-producer-ack']),
  'retry-before-election': preview(['producer', 'broker-leader'], ['producer-leader']),
  'wait-for-isr-leader-and-retry': preview(['producer', 'broker-follower-1'], ['leader-follower-1', 'follower-1-producer']),
  'treat-poll-as-complete': preview(['partition-p0', 'consumer-c1'], ['p0-consumer']),
  'process-then-commit': preview(['partition-p0', 'consumer-c1', 'application', 'offset-store'], ['p0-consumer', 'consumer-application', 'application-offset']),
  'commit-before-processing': preview(['consumer-c1', 'offset-store', 'application'], ['consumer-offset', 'consumer-application']),
  'commit-after-processing': preview(['consumer-c1', 'application', 'offset-store'], ['consumer-application', 'application-offset']),
  'assume-no-replay-after-processing': preview(['partition-p0', 'consumer-c1', 'application'], ['p0-consumer', 'consumer-application']),
  'idempotent-replay-then-commit': preview(['partition-p0', 'consumer-c1', 'application', 'offset-store'], ['offset-consumer-commit', 'p0-consumer', 'consumer-application', 'application-offset']),
  'add-consumers-only': preview(['partition-p0', 'partition-p1', 'partition-p2', 'consumer-c1', 'consumer-c2', 'consumer-c3', 'consumer-c4', 'consumer-c5', 'coordinator'], ['coordinator-c1', 'coordinator-c2', 'coordinator-c3', 'coordinator-c4', 'coordinator-c5']),
  'match-parallelism-to-partitions': preview(['partition-p0', 'partition-p1', 'partition-p2', 'consumer-c1', 'consumer-c2', 'consumer-c3', 'coordinator'], ['coordinator-c1', 'coordinator-c2', 'coordinator-c3']),
  'ignore-ownership-boundary': preview(['partition-p1', 'consumer-c1', 'consumer-c2', 'coordinator'], ['coordinator-c1', 'p1-c1', 'p1-c2']),
  'handle-revocation-and-assignment': preview(['partition-p1', 'consumer-c1', 'consumer-c2', 'coordinator', 'offset-store'], ['coordinator-c1', 'coordinator-c2', 'c1-offset', 'p1-c2']),
  'block-poll-past-interval': preview(['partition-p1', 'consumer-c1', 'consumer-c2', 'coordinator', 'application'], ['p1-c1', 'c1-application', 'coordinator-c2', 'p1-c2']),
  'keep-poll-cadence': preview(['partition-p1', 'consumer-c1', 'coordinator', 'application', 'offset-store'], ['p1-c1', 'c1-application', 'c1-offset', 'coordinator-c1']),
  'retry-in-place-unbounded': preview(['partition-p0', 'consumer-c1', 'application', 'retry-loop'], ['p0-consumer', 'consumer-application', 'application-retry-loop']),
  'bound-blocking-retry': preview(['partition-p0', 'consumer-c1', 'application', 'retry-loop', 'offset-store'], ['p0-consumer', 'consumer-application', 'application-retry-loop', 'application-offset', 'offset-consumer-commit']),
  'assume-broker-auto-retry-topics': preview(['application', 'retry-loop'], ['application-retry-loop']),
  'application-publishes-retry-topics': preview(['application', 'retry-1m', 'retry-10m'], ['application-retry-1m', 'retry-1m-retry-10m', 'retry-10m-application']),
  'publish-payload-only': preview(['application', 'retry-loop', 'dlt'], ['application-retry-loop', 'application-dlt']),
  'publish-dlt-with-context': preview(['consumer-c1', 'application', 'retry-loop', 'dlt', 'offset-store'], ['application-retry-loop', 'application-dlt', 'application-offset', 'offset-consumer-commit']),
  'commit-output-and-offset-separately': preview(['application', 'producer', 'offset-store'], ['application-producer', 'application-offset']),
  'use-atomic-transform-boundary': preview(['consumer-c1', 'application', 'producer', 'offset-store', 'transaction-coordinator'], ['consumer-application', 'transaction-application', 'producer-transaction', 'transaction-offset']),
  'transactional-output-only': preview(['application', 'producer', 'transaction-coordinator'], ['application-producer', 'producer-transaction']),
  'send-offsets-then-commit': preview(['application', 'producer', 'offset-store', 'transaction-coordinator'], ['application-producer', 'producer-transaction', 'transaction-offset']),
  'read-uncommitted-results': preview(['producer', 'application', 'consumer-c1', 'transaction-coordinator'], ['application-producer', 'consumer-application', 'transaction-consumer-result']),
  'read-committed-to-lso': preview(['application', 'consumer-c1', 'offset-store', 'transaction-coordinator'], ['consumer-application', 'transaction-offset', 'transaction-consumer-result']),
}

export function getExperimentCityPreview(experimentId: string, choiceId?: string): CityScenePreview {
  if (choiceId && CHOICE_PREVIEWS[choiceId]) return CHOICE_PREVIEWS[choiceId]
  return EXPERIMENT_PREVIEWS[experimentId] ?? { nodeIds: [], routeIds: [] }
}

function buildScene(spec: ChapterSceneBlueprint): CitySceneDefinition {
  const nodesById = new Map<DioramaNodeId, CityNodeDefinition>()
  const facilities: CityPhysicalFacilityDefinition[] = []
  const seenFacilityIds = new Set<string>()

  for (const complex of spec.complexes ?? []) {
    const prism = createIsoPrism(complex.grid.u, complex.grid.v, complex.footprint.u, complex.footprint.v, complex.footprint.height)
    facilities.push({
      id: complex.id,
      label: complex.label,
      koreanLabel: complex.koreanLabel,
      archetype: complex.archetype,
      grid: complex.grid,
      position: isoPoint(complex.grid.u, complex.grid.v),
      footprint: complex.footprint,
      hitAreaPath: prism.outlinePath,
    })
    seenFacilityIds.add(complex.id)
  }

  const nodes: CityNodeDefinition[] = spec.placements.map((placement) => {
    const bp = NODE_BLUEPRINTS[placement.id]
    const footprint = bp.footprint ?? DEFAULT_FOOTPRINT[bp.archetype]
    const position = isoPoint(placement.grid.u, placement.grid.v)
    const facilityId = placement.facilityId ?? placement.id
    const prism = createIsoPrism(placement.grid.u, placement.grid.v, footprint.u, footprint.v, footprint.height)

    if (!seenFacilityIds.has(facilityId)) {
      facilities.push({
        id: facilityId,
        label: bp.label,
        koreanLabel: bp.koreanLabel,
        archetype: bp.archetype,
        grid: placement.grid,
        position,
        footprint,
        hitAreaPath: prism.outlinePath,
      })
      seenFacilityIds.add(facilityId)
    }

    const node: CityNodeDefinition = {
      id: placement.id,
      kind: bp.kind,
      archetype: bp.archetype,
      facilityId,
      label: bp.shortLabel ?? bp.label,
      description: bp.description,
      grid: placement.grid,
      position,
      hitAreaPath: prism.outlinePath,
      ariaLabel: `${bp.label} ${bp.koreanLabel}`,
    }
    nodesById.set(placement.id, node)
    return node
  })

  const routes: CityRouteDefinition[] = spec.routes.map((routeSpec) => {
    const fromNode = nodesById.get(routeSpec.from)
    const toNode = nodesById.get(routeSpec.to)
    if (!fromNode || !toNode) {
      throw new Error(`Route ${routeSpec.id} references missing node in Chapter ${spec.chapterId}.`)
    }
    const gridPoints: readonly CityGridCoord[] = [
      fromNode.grid,
      ...(routeSpec.via ?? []).map(([u, v]) => ({ u, v })),
      toNode.grid,
    ]
    const points: readonly CityPoint[] = gridPoints.map((coord) => isoPoint(coord.u, coord.v))
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
    const midpoint = interpolatePolyline(points, 0.5)
    const checkpoints: readonly CityCheckpointDefinition[] = [
      { id: `${routeSpec.id}:start`, position: points[0]!, progress: 0, nodeId: fromNode.id },
      { id: `${routeSpec.id}:mid`, position: midpoint, progress: 0.5, label: '이동 중' },
      { id: `${routeSpec.id}:end`, position: points.at(-1)!, progress: 1, nodeId: toNode.id },
    ]
    return {
      id: routeSpec.id,
      kind: routeSpec.kind,
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      label: `${fromNode.label} → ${toNode.label}`,
      path,
      points,
      checkpoints,
    }
  })

  return {
    id: `chapter-${spec.chapterId}-city`,
    chapterId: spec.chapterId,
    label: spec.label,
    viewport: DIORAMA_VIEWPORT,
    gridBounds: spec.gridBounds,
    physicalFacilities: facilities,
    initialVehicleRouteId: spec.initialVehicleRouteId,
    nodes,
    routes,
    ...(spec.boundaries ? { boundaries: spec.boundaries } : {}),
  }
}

function blueprint(
  kind: CityNodeKind,
  archetype: CityBuildingArchetype,
  label: string,
  koreanLabel: string,
  description: string,
  shortLabel?: string,
): NodeBlueprint {
  return {
    kind,
    archetype,
    label,
    koreanLabel,
    description,
    ...(shortLabel ? { shortLabel } : {}),
  }
}

function preview(nodeIds: readonly string[], routeIds: readonly string[]): CityScenePreview {
  return { nodeIds, routeIds }
}
