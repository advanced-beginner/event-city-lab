import { z } from 'zod'

import { interpolatePolyline } from './routeGeometry'
import type { ChapterCityCue, CitySceneDefinition } from './types'

const positiveNumberSchema = z.number().finite().positive()
const coordinateSchema = z.number().finite()
const idSchema = z.string().min(1)

const cityPointSchema = z.strictObject({
  x: coordinateSchema,
  y: coordinateSchema,
})

const citySizeSchema = z.strictObject({
  width: positiveNumberSchema,
  height: positiveNumberSchema,
})

export const cityVisualStateSchema = z.enum(['idle', 'active', 'blocked', 'failed', 'complete', 'muted'])

export const cityNodeDefinitionSchema = z.strictObject({
  id: idSchema,
  kind: z.enum([
    'producer',
    'partition',
    'broker',
    'replica',
    'consumer',
    'coordinator',
    'offset',
    'retry',
    'application',
    'transaction',
    'generic',
  ]),
  label: z.string().min(1),
  description: z.string().min(1),
  position: cityPointSchema,
  roadAccessIndex: z.number().int().nonnegative(),
  hitAreaPath: z.string().min(1),
  size: citySizeSchema.optional(),
  ariaLabel: z.string().min(1).optional(),
})

export const cityCheckpointDefinitionSchema = z.strictObject({
  id: idSchema,
  position: cityPointSchema,
  progress: z.number().finite().min(0).max(1),
  label: z.string().min(1).optional(),
  nodeId: idSchema.optional(),
})

export const cityRouteDefinitionSchema = z.strictObject({
  id: idSchema,
  kind: z.enum(['data', 'replication', 'control', 'retry', 'return', 'transaction']),
  fromNodeId: idSchema,
  toNodeId: idSchema,
  path: z.string().min(1),
  points: z.array(cityPointSchema).min(2),
  checkpoints: z.array(cityCheckpointDefinitionSchema),
  label: z.string().min(1).optional(),
})

const cityMainRoadDefinitionSchema = z.strictObject({
  id: idSchema,
  path: z.string().min(1),
  points: z.array(cityPointSchema).min(2),
})

export const cityBoundaryDefinitionSchema = z.strictObject({
  id: idSchema,
  kind: z.literal('transaction'),
  label: z.string().min(1),
  path: z.string().min(1),
  nodeIds: z.array(idSchema).min(1),
})

export const citySceneDefinitionSchema = z.strictObject({
  id: idSchema,
  label: z.string().min(1),
  viewport: citySizeSchema,
  mainRoad: cityMainRoadDefinitionSchema,
  nodes: z.array(cityNodeDefinitionSchema),
  routes: z.array(cityRouteDefinitionSchema),
  boundaries: z.array(cityBoundaryDefinitionSchema).optional(),
})

export const cityNodeChangeSchema = z.strictObject({
  state: cityVisualStateSchema.optional(),
  label: z.string().min(1).optional(),
  badge: z.string().min(1).nullable().optional(),
})

export const cityRouteChangeSchema = z.strictObject({
  state: cityVisualStateSchema.optional(),
  disabled: z.boolean().optional(),
  label: z.string().min(1).optional(),
})

export const cityCarrierChangeSchema = z.strictObject({
  kind: z.enum(['record', 'retry-record', 'offset-ticket', 'ghost-record']),
  routeId: idSchema,
  checkpointId: idSchema.optional(),
  progress: z.number().finite().min(0).max(1).optional(),
  state: cityVisualStateSchema.optional(),
  label: z.string().min(1).optional(),
})

export const citySignalCueSchema = z.strictObject({
  kind: z.enum(['ack', 'commit', 'assignment', 'revocation', 'metadata', 'tx-commit', 'tx-abort']),
  fromNodeId: idSchema,
  toNodeId: idSchema,
  state: cityVisualStateSchema,
  label: z.string().min(1),
})

export const cityBarrierCueSchema = z.strictObject({
  state: z.enum(['open', 'closed']),
  label: z.string().min(1),
  nodeId: idSchema.optional(),
  routeId: idSchema.optional(),
  checkpointId: idSchema.optional(),
})

export const chapterCityCueSchema = z.strictObject({
  focusNodeIds: z.array(idSchema),
  nodeChanges: z.record(idSchema, cityNodeChangeSchema).optional(),
  routeChanges: z.record(idSchema, cityRouteChangeSchema).optional(),
  carrierChanges: z.record(idSchema, cityCarrierChangeSchema.nullable()).optional(),
  signal: citySignalCueSchema.nullable().optional(),
  barrier: cityBarrierCueSchema.nullable().optional(),
})

export function validateCityScene(scene: CitySceneDefinition): void {
  const parsed = citySceneDefinitionSchema.parse(scene)
  const nodeIds = assertUniqueIds(
    parsed.nodes.map((node) => node.id),
    'node',
  )
  const checkpointIds = new Set<string>()
  const nodeById = new Map(parsed.nodes.map((node) => [node.id, node]))

  if (parsed.mainRoad.path !== pointsToPath(parsed.mainRoad.points)) {
    throw new Error(`Main road ${parsed.mainRoad.id} path must match its ordered points.`)
  }
  for (const node of parsed.nodes) {
    if (!parsed.mainRoad.points[node.roadAccessIndex]) {
      throw new Error(`Node ${node.id} references unknown main-road access index: ${node.roadAccessIndex}`)
    }
  }

  assertUniqueIds(
    parsed.routes.map((route) => route.id),
    'route',
  )
  assertUniqueIds(
    (parsed.boundaries ?? []).map((boundary) => boundary.id),
    'boundary',
  )

  for (const boundary of parsed.boundaries ?? []) {
    for (const nodeId of boundary.nodeIds) {
      if (!nodeIds.has(nodeId)) {
        throw new Error(`Boundary ${boundary.id} references unknown nodeId: ${nodeId}`)
      }
    }
  }

  for (const route of parsed.routes) {
    if (!nodeIds.has(route.fromNodeId)) {
      throw new Error(`Route ${route.id} references unknown fromNodeId: ${route.fromNodeId}`)
    }
    if (!nodeIds.has(route.toNodeId)) {
      throw new Error(`Route ${route.id} references unknown toNodeId: ${route.toNodeId}`)
    }

    const fromNode = nodeById.get(route.fromNodeId)!
    const toNode = nodeById.get(route.toNodeId)!
    const expectedPoints = roadSlice(parsed.mainRoad.points, fromNode.roadAccessIndex, toNode.roadAccessIndex)
    if (!pointsEqual(route.points, expectedPoints)) {
      throw new Error(`Route ${route.id} must be a contiguous segment of ${parsed.mainRoad.id}.`)
    }
    if (route.path !== pointsToPath(route.points)) {
      throw new Error(`Route ${route.id} path must match its ordered points.`)
    }

    for (const checkpoint of route.checkpoints) {
      if (checkpointIds.has(checkpoint.id)) {
        throw new Error(`Duplicate checkpoint id: ${checkpoint.id}`)
      }
      checkpointIds.add(checkpoint.id)

      if (checkpoint.nodeId && !nodeIds.has(checkpoint.nodeId)) {
        throw new Error(`Checkpoint ${checkpoint.id} references unknown nodeId: ${checkpoint.nodeId}`)
      }
      if (!pointsEqual([checkpoint.position], [interpolatePolyline(route.points, checkpoint.progress)])) {
        throw new Error(`Checkpoint ${checkpoint.id} must lie at its declared route progress.`)
      }
    }
  }
}

function roadSlice(points: readonly { x: number; y: number }[], fromIndex: number, toIndex: number) {
  const start = Math.min(fromIndex, toIndex)
  const end = Math.max(fromIndex, toIndex)
  const slice = points.slice(start, end + 1)
  return fromIndex <= toIndex ? slice : slice.reverse()
}

function pointsToPath(points: readonly { x: number; y: number }[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
}

function pointsEqual(
  actual: readonly { x: number; y: number }[],
  expected: readonly { x: number; y: number }[],
): boolean {
  return actual.length === expected.length && actual.every((point, index) => {
    const target = expected[index]
    return Boolean(target && Math.abs(point.x - target.x) < 0.001 && Math.abs(point.y - target.y) < 0.001)
  })
}

export function validateChapterCityCue(scene: CitySceneDefinition, cue: ChapterCityCue): void {
  validateCityScene(scene)
  const parsedCue = chapterCityCueSchema.parse(cue)
  const sceneIndex = buildSceneIndex(scene)

  for (const nodeId of parsedCue.focusNodeIds) {
    if (!sceneIndex.nodeIds.has(nodeId)) throw new Error(`City cue focuses unknown node id: ${nodeId}`)
  }

  for (const nodeId of Object.keys(parsedCue.nodeChanges ?? {})) {
    if (!sceneIndex.nodeIds.has(nodeId)) throw new Error(`City cue changes unknown node id: ${nodeId}`)
  }

  for (const routeId of Object.keys(parsedCue.routeChanges ?? {})) {
    if (!sceneIndex.routeIds.has(routeId)) throw new Error(`City cue changes unknown route id: ${routeId}`)
  }

  for (const [carrierId, carrier] of Object.entries(parsedCue.carrierChanges ?? {})) {
    if (carrier === null) continue
    assertRouteCheckpoint(sceneIndex, carrier.routeId, carrier.checkpointId, `Carrier ${carrierId}`)
  }

  if (parsedCue.signal) {
    if (!sceneIndex.nodeIds.has(parsedCue.signal.fromNodeId)) {
      throw new Error(`City cue signal references unknown fromNodeId: ${parsedCue.signal.fromNodeId}`)
    }
    if (!sceneIndex.nodeIds.has(parsedCue.signal.toNodeId)) {
      throw new Error(`City cue signal references unknown toNodeId: ${parsedCue.signal.toNodeId}`)
    }
  }

  if (parsedCue.barrier) {
    if (!parsedCue.barrier.nodeId && !parsedCue.barrier.routeId) {
      throw new Error('City cue barrier must reference a nodeId or routeId.')
    }
    if (parsedCue.barrier.nodeId && !sceneIndex.nodeIds.has(parsedCue.barrier.nodeId)) {
      throw new Error(`City cue barrier references unknown nodeId: ${parsedCue.barrier.nodeId}`)
    }
    if (parsedCue.barrier.routeId) {
      assertRouteCheckpoint(sceneIndex, parsedCue.barrier.routeId, parsedCue.barrier.checkpointId, 'City cue barrier')
    } else if (parsedCue.barrier.checkpointId) {
      throw new Error('City cue barrier checkpointId requires a routeId.')
    }
  }
}

function assertUniqueIds(ids: readonly string[], label: string): Set<string> {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label} id: ${id}`)
    seen.add(id)
  }
  return seen
}

function buildSceneIndex(scene: CitySceneDefinition): {
  nodeIds: Set<string>
  routeIds: Set<string>
  checkpointIdsByRouteId: Map<string, Set<string>>
} {
  return {
    nodeIds: new Set(scene.nodes.map((node) => node.id)),
    routeIds: new Set(scene.routes.map((route) => route.id)),
    checkpointIdsByRouteId: new Map(
      scene.routes.map((route) => [route.id, new Set(route.checkpoints.map((checkpoint) => checkpoint.id))]),
    ),
  }
}

function assertRouteCheckpoint(
  sceneIndex: ReturnType<typeof buildSceneIndex>,
  routeId: string,
  checkpointId: string | undefined,
  subject: string,
): void {
  if (!sceneIndex.routeIds.has(routeId)) {
    throw new Error(`${subject} references unknown routeId: ${routeId}`)
  }
  if (checkpointId && !sceneIndex.checkpointIdsByRouteId.get(routeId)?.has(checkpointId)) {
    throw new Error(`${subject} references unknown checkpointId on route ${routeId}: ${checkpointId}`)
  }
}
