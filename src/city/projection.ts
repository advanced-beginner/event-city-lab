import type { SimulationEvent, SimulationRun } from '../domain/simulation'
import {
  clampProgress,
  headingAtPolylineProgress,
  interpolatePolyline,
  polylineLength,
  slicePolylineByProgress,
} from './routeGeometry'
import type {
  ChapterCityCue,
  CityCarrierChange,
  CityCarrierState,
  CityCuedEvent,
  CityPoint,
  CityRouteDefinition,
  CitySceneDefinition,
  CityWorldState,
} from './types'
import { validateChapterCityCue, validateCityScene } from './validation'

type CarrierChangeEntry = NonNullable<NonNullable<ChapterCityCue['carrierChanges']>[string]>

export interface CarrierTransitionPath {
  readonly id: string
  readonly fromCarrier: CityCarrierState
  readonly toCarrier: CityCarrierState
  readonly points: readonly CityPoint[]
  readonly length: number
}

/**
 * Converts Chapter 1 SimulationEvents into standard CityCuedEvents so Chapter 1 and Chapters 2–8
 * share the exact same projection, playback clock, and Isometric Diorama renderer.
 */
export function createChapterOneCuedEvents(
  run: SimulationRun | null,
  pendingRerun = false,
): readonly CityCuedEvent[] {
  if (!run) return []
  return run.events.map((event) => ({
    cityCue: buildChapterOneCue(event, pendingRerun),
  }))
}

function buildChapterOneCue(event: SimulationEvent, pendingRerun: boolean): ChapterCityCue {
  const attemptTag = pendingRerun ? '수정 대기' : undefined

  switch (event.kind) {
    case 'command.accepted':
      return {
        focusNodeIds: ['producer'],
        nodeChanges: { producer: { state: 'active', badge: '발송 접수' } },
        carrierChanges: {
          record: { kind: 'record', routeId: 'producer-serializer', checkpointId: 'producer-serializer:start', progress: 0.14, state: 'active', label: 'OrderEvent 접수' },
        },
        barrier: null,
        signal: null,
      }
    case 'producer.preparing':
      return {
        focusNodeIds: ['producer'],
        nodeChanges: { producer: { state: 'active', badge: '상차 준비' } },
        carrierChanges: {
          record: { kind: 'record', routeId: 'producer-serializer', checkpointId: 'producer-serializer:mid', progress: 0.45, state: 'active', label: 'ProducerRecord' },
        },
      }
    case 'serializer.inspecting':
      return {
        focusNodeIds: ['serializer'],
        nodeChanges: {
          producer: { state: 'complete', badge: '출발' },
          serializer: { state: 'active', badge: '호환성 검사' },
        },
        routeChanges: { 'producer-serializer': { state: 'active' } },
        carrierChanges: {
          record: { kind: 'record', routeId: 'producer-serializer', checkpointId: 'producer-serializer:end', progress: 0.88, state: 'active', label: '직렬화 검사' },
        },
      }
    case 'serializer.rejected':
      return {
        focusNodeIds: ['serializer'],
        nodeChanges: {
          serializer: { state: 'failed', badge: attemptTag ?? 'OrderEvent ≠ StringSerializer' },
          broker: { state: 'muted', badge: '미수신' },
        },
        routeChanges: {
          'producer-serializer': { state: 'failed', disabled: true },
          'serializer-broker': { state: 'muted', disabled: true },
        },
        carrierChanges: {
          record: { kind: 'ghost-record', routeId: 'producer-serializer', checkpointId: 'producer-serializer:end', progress: 0.90, state: 'failed', label: 'OrderEvent ≠ StringSerializer' },
        },
        barrier: {
          state: 'closed',
          label: 'Serializer 직렬화 차단',
          nodeId: 'serializer',
          routeId: 'producer-serializer',
          checkpointId: 'producer-serializer:end',
        },
        signal: null,
      }
    case 'serializer.completed':
      return {
        focusNodeIds: ['serializer'],
        nodeChanges: {
          serializer: { state: 'complete', badge: 'JSON 82B' },
        },
        routeChanges: {
          'producer-serializer': { state: 'complete', disabled: false },
        },
        carrierChanges: {
          record: { kind: 'record', routeId: 'producer-serializer', checkpointId: 'producer-serializer:end', progress: 1, state: 'complete', label: 'JSON byte[]' },
        },
        barrier: {
          state: 'open',
          label: '직렬화 통과',
          nodeId: 'serializer',
          routeId: 'producer-serializer',
          checkpointId: 'producer-serializer:end',
        },
      }
    case 'network.dispatched':
      return {
        focusNodeIds: ['serializer', 'broker'],
        routeChanges: {
          'serializer-broker': { state: 'active', disabled: false },
        },
        carrierChanges: {
          record: { kind: 'record', routeId: 'serializer-broker', checkpointId: 'serializer-broker:mid', progress: 0.56, state: 'active', label: 'ProduceRequest' },
        },
      }
    case 'broker.received':
      return {
        focusNodeIds: ['broker'],
        nodeChanges: {
          broker: { state: 'active', badge: '요청 수신' },
        },
        routeChanges: {
          'serializer-broker': { state: 'active' },
        },
        carrierChanges: {
          record: { kind: 'record', routeId: 'serializer-broker', checkpointId: 'serializer-broker:end', progress: 0.92, state: 'active', label: 'leader 도착' },
        },
      }
    case 'broker.appended':
      return {
        focusNodeIds: ['broker'],
        nodeChanges: {
          broker: { state: 'complete', badge: 'offset 42' },
        },
        routeChanges: {
          'serializer-broker': { state: 'complete' },
        },
        carrierChanges: {
          record: { kind: 'record', routeId: 'serializer-broker', checkpointId: 'serializer-broker:end', progress: 1, state: 'complete', label: 'offset 42 기록' },
        },
      }
    case 'ack.returned':
      return {
        focusNodeIds: ['broker', 'producer'],
        nodeChanges: {
          producer: { state: 'complete', badge: 'ACK 수신' },
          broker: { state: 'complete', badge: 'acks=all' },
        },
        routeChanges: {
          'broker-producer-ack': { state: 'complete' },
        },
        signal: {
          kind: 'ack',
          fromNodeId: 'broker',
          toNodeId: 'producer',
          state: 'complete',
          label: 'orders.v1 / partition 0 / offset 42 저장 완료 · acks=all',
        },
      }
    case 'run.completed':
      return {
        focusNodeIds: ['producer', 'serializer', 'broker'],
        nodeChanges: {
          producer: { state: 'complete', badge: '배송 완료' },
        },
        signal: {
          kind: 'ack',
          fromNodeId: 'broker',
          toNodeId: 'producer',
          state: 'complete',
          label: 'orders.v1 / partition 0 / offset 42 저장 완료 · acks=all',
        },
      }
  }
}

/**
 * Pure deterministic reducer from (scene, events, cursor) to CityWorldState.
 * Supports full A -> B -> C routing, branching lanes, and circular retry loops without monotonic clamping.
 */
export function projectCityWorld(
  scene: CitySceneDefinition,
  events: readonly CityCuedEvent[],
  cursor: number,
): CityWorldState {
  validateCityScene(scene)

  const initialWorld: CityWorldState = {
    sceneId: scene.id,
    focusNodeIds: [],
    nodes: Object.fromEntries(
      scene.nodes.map((node) => [
        node.id,
        {
          ...node,
          focused: false,
          state: 'idle',
          badge: null,
        },
      ]),
    ),
    routes: Object.fromEntries(
      scene.routes.map((route) => [
        route.id,
        {
          ...route,
          state: 'idle',
          disabled: false,
        },
      ]),
    ),
    carriers: initialVehicle(scene),
    signal: null,
    barrier: null,
  }

  if (events.length === 0 || cursor < 0) return initialWorld

  const boundedCursor = Math.min(cursor, events.length - 1)
  const journeyDistances = computeRunJourneyDistances(scene, events)
  const totalDistance = journeyDistances.at(-1) ?? 0

  return events.slice(0, boundedCursor + 1).reduce((world, event, index) => {
    validateChapterCityCue(scene, event.cityCue)
    const focusNodeIds = [...event.cityCue.focusNodeIds]
    const focusedNodeIds = new Set(focusNodeIds)

    const nodes = { ...world.nodes }
    for (const [nodeId, node] of Object.entries(nodes)) {
      nodes[nodeId] = {
        ...node,
        focused: focusedNodeIds.has(nodeId),
      }
    }
    for (const [nodeId, change] of Object.entries(event.cityCue.nodeChanges ?? {})) {
      const current = nodes[nodeId]
      if (!current) continue
      nodes[nodeId] = {
        ...current,
        ...change,
        badge: change.badge === undefined ? current.badge : change.badge,
      }
    }

    const routes = { ...world.routes }
    for (const [routeId, change] of Object.entries(event.cityCue.routeChanges ?? {})) {
      const current = routes[routeId]
      if (!current) continue
      routes[routeId] = {
        ...current,
        ...change,
      }
    }

    const journeyProgress = totalDistance > 0
      ? clampProgress((journeyDistances[index] ?? 0) / totalDistance)
      : 0

    const carriers = projectCarriers(scene, world.carriers, event.cityCue.carrierChanges, journeyProgress)

    return {
      ...world,
      focusNodeIds,
      nodes,
      routes,
      carriers,
      signal: event.cityCue.signal === undefined ? world.signal : event.cityCue.signal,
      barrier: event.cityCue.barrier === undefined ? world.barrier : event.cityCue.barrier,
    }
  }, initialWorld)
}

/**
 * Builds exact street-following transition polylines between consecutive cursors for smooth playback.
 */
export function buildCarrierTransitions(
  scene: CitySceneDefinition,
  fromWorld: CityWorldState,
  toWorld: CityWorldState,
): readonly CarrierTransitionPath[] {
  const toEntries = Object.values(toWorld.carriers)
  return toEntries.map((toCarrier) => {
    const fromCarrier = fromWorld.carriers[toCarrier.id] ?? fromWorld.carriers.vehicle ?? toCarrier
    const points = resolveTransitionPolyline(scene, fromCarrier, toCarrier)
    return {
      id: toCarrier.id,
      fromCarrier,
      toCarrier,
      points,
      length: polylineLength(points),
    }
  })
}

export function resolveTransitionPolyline(
  scene: CitySceneDefinition,
  fromCarrier: CityCarrierState,
  toCarrier: CityCarrierState,
): readonly CityPoint[] {
  const fromRoute = scene.routes.find((candidate) => candidate.id === fromCarrier.routeId)
  const toRoute = scene.routes.find((candidate) => candidate.id === toCarrier.routeId)
  if (!toRoute) return [fromCarrier.position, toCarrier.position]

  // Same route segment movement (forward or reverse)
  if (fromRoute && fromRoute.id === toRoute.id) {
    return slicePolylineByProgress(toRoute.points, fromCarrier.routeProgress, toCarrier.routeProgress)
  }

  // Adjacent A -> B -> C route handoff (finish previous route to B, then traverse B -> C to target progress)
  if (fromRoute && fromRoute.toNodeId === toRoute.fromNodeId) {
    const tail = fromCarrier.routeProgress < 0.999
      ? slicePolylineByProgress(fromRoute.points, fromCarrier.routeProgress, 1)
      : []
    const head = slicePolylineByProgress(toRoute.points, 0, toCarrier.routeProgress)
    return dedupeAdjacentPoints([...tail, ...head])
  }

  // Initial vehicle was parked at start node of fromRoute and first dispatched along a sibling route from same origin
  if (fromRoute && fromCarrier.routeProgress <= 0.001 && fromRoute.fromNodeId === toRoute.fromNodeId) {
    return slicePolylineByProgress(toRoute.points, 0, toCarrier.routeProgress)
  }

  // Multi-hop graph path search through connected scene routes
  if (fromRoute && fromRoute.toNodeId !== toRoute.fromNodeId) {
    const startNodeId = fromCarrier.routeProgress >= 0.999
      ? fromRoute.toNodeId
      : fromCarrier.routeProgress <= 0.001
        ? fromRoute.fromNodeId
        : fromRoute.toNodeId
    const connectingRoutes = findShortestRouteChain(scene, startNodeId, toRoute.fromNodeId)
    if (connectingRoutes) {
      const tail = fromCarrier.routeProgress > 0.001 && fromCarrier.routeProgress < 0.999
        ? slicePolylineByProgress(fromRoute.points, fromCarrier.routeProgress, 1)
        : []
      const mid = connectingRoutes.flatMap((route) => route.points)
      const head = slicePolylineByProgress(toRoute.points, 0, toCarrier.routeProgress)
      return dedupeAdjacentPoints([...tail, ...mid, ...head])
    }
  }

  return dedupeAdjacentPoints([fromCarrier.position, ...slicePolylineByProgress(toRoute.points, 0, toCarrier.routeProgress)])
}

function projectCarriers(
  scene: CitySceneDefinition,
  current: CityWorldState['carriers'],
  changes: ChapterCityCue['carrierChanges'],
  journeyProgress: number,
): CityWorldState['carriers'] {
  if (changes === undefined) {
    return updateJourneyProgress(current, journeyProgress)
  }

  const allEntries = Object.entries(changes).flatMap(([id, change]) => {
    if (change === null) return []
    const route = scene.routes.find((candidate) => candidate.id === change.routeId)
    if (!route) return []
    return [{ id, change, route }]
  })

  if (allEntries.length === 0) {
    return updateJourneyProgress(current, journeyProgress)
  }

  // Return-lane offset-tickets represent fiber-optic receipts when signal is shown; keep the van parked at its destination.
  const activeMovers = allEntries.filter(
    (entry) => !(entry.change.kind === 'offset-ticket' && entry.route.kind === 'return'),
  )

  if (activeMovers.length === 0) {
    return updateJourneyProgress(current, journeyProgress)
  }

  const cueLabels = activeMovers.map((entry) => entry.change.label ?? entry.id)
  const totalCount = activeMovers.length

  const result: Record<string, CityCarrierState> = {}
  activeMovers.forEach((entry, index) => {
    const carrierId = index === 0 ? 'vehicle' : `branch-${index}`
    const routeProgress = resolveRouteProgress(entry.route, entry.change)
    const position = interpolatePolyline(entry.route.points, routeProgress)
    const heading = headingAtPolylineProgress(entry.route.points, routeProgress)
    const label = index === 0
      ? primaryCarrierLabel(entry.change, totalCount)
      : entry.change.label ?? entry.id

    result[carrierId] = {
      ...entry.change,
      id: carrierId,
      cueLabels,
      cueCount: totalCount,
      routeProgress,
      journeyProgress,
      position,
      heading,
      sourceCarrierId: entry.id,
      ...(label ? { label } : {}),
    }
  })

  return result
}

function updateJourneyProgress(
  carriers: CityWorldState['carriers'],
  journeyProgress: number,
): CityWorldState['carriers'] {
  return Object.fromEntries(
    Object.entries(carriers).map(([id, carrier]) => [
      id,
      { ...carrier, journeyProgress: Math.max(carrier.journeyProgress, journeyProgress) },
    ]),
  )
}

function computeRunJourneyDistances(
  scene: CitySceneDefinition,
  events: readonly CityCuedEvent[],
): readonly number[] {
  const distances: number[] = []
  let cumulative = 0
  let prev = initialVehicle(scene).vehicle!

  for (const event of events) {
    const nextCarriers = projectCarriers(scene, { vehicle: prev }, event.cityCue.carrierChanges, 0)
    const next = nextCarriers.vehicle ?? prev
    const points = resolveTransitionPolyline(scene, prev, next)
    cumulative += polylineLength(points)
    distances.push(cumulative)
    prev = next
  }

  return distances
}

function initialVehicle(scene: CitySceneDefinition): CityWorldState['carriers'] {
  const route = scene.routes.find((candidate) => candidate.id === scene.initialVehicleRouteId)
  if (!route) return {}
  const position = interpolatePolyline(route.points, 0)
  const heading = headingAtPolylineProgress(route.points, 0)
  return {
    vehicle: {
      id: 'vehicle',
      cueLabels: ['record'],
      cueCount: 1,
      kind: 'record',
      routeId: route.id,
      routeProgress: 0,
      journeyProgress: 0,
      position,
      heading,
      sourceCarrierId: 'initial',
      ...(route.checkpoints[0] ? { checkpointId: route.checkpoints[0].id } : {}),
      progress: 0,
      state: 'idle',
      label: 'record',
    },
  }
}

function resolveRouteProgress(route: CityRouteDefinition, change: CityCarrierChange): number {
  const checkpoint = change.checkpointId
    ? route.checkpoints.find((candidate) => candidate.id === change.checkpointId)
    : undefined
  return clampProgress(change.progress ?? checkpoint?.progress ?? 0)
}

function primaryCarrierLabel(change: CarrierChangeEntry, count: number): string | undefined {
  if (count <= 1) return change.label
  return '메시지 흐름 요약'
}

function findShortestRouteChain(
  scene: CitySceneDefinition,
  startNodeId: string,
  targetNodeId: string,
): readonly CityRouteDefinition[] | null {
  if (startNodeId === targetNodeId) return []
  const queue: Array<{ nodeId: string; chain: readonly CityRouteDefinition[] }> = [
    { nodeId: startNodeId, chain: [] },
  ]
  const visited = new Set<string>([startNodeId])

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const route of scene.routes) {
      if (route.fromNodeId !== current.nodeId) continue
      const nextChain = [...current.chain, route]
      if (route.toNodeId === targetNodeId) return nextChain
      if (!visited.has(route.toNodeId)) {
        visited.add(route.toNodeId)
        queue.push({ nodeId: route.toNodeId, chain: nextChain })
      }
    }
  }
  return null
}

function dedupeAdjacentPoints(points: readonly CityPoint[]): readonly CityPoint[] {
  const result: CityPoint[] = []
  for (const point of points) {
    const last = result.at(-1)
    if (last && Math.hypot(last.x - point.x, last.y - point.y) < 0.01) continue
    result.push(point)
  }
  return result.length >= 2 ? result : points
}
