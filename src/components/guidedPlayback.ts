import { getAdvancedCityCamera, type AdvancedCityViewMode } from '../city/camera'
import { projectCityWorld } from '../city/projection'
import { polylineLength } from '../city/routeGeometry'
import type { CitySceneDefinition, CitySize, CityWorldState } from '../city/types'
import type { ChapterSimulationEvent } from '../domain/chapterSimulation'

export type PlaybackSpeed = 0.5 | 1 | 2

export interface PlaybackSegment {
  readonly fromCursor: number
  readonly toCursor: number
  readonly fromProgress: number
  readonly toProgress: number
  readonly moveDurationMs: number
  readonly minimumDurationMs: number
  readonly speed: PlaybackSpeed
  readonly totalDurationMs: number
}

export interface FacilityInspection {
  readonly facilityId: string
  readonly latestEventIndex: number
  readonly latestNodeId: string | null
  readonly nodeIds: readonly string[]
}

export interface PlaybackSnapshot {
  readonly cursor: number
  readonly carrierProgress: number
  readonly world: CityWorldState
}

export const CARRIER_SPEED_PX_PER_SECOND = 240
export const EVENT_DWELL_MS = 200
export const MIN_EVENT_DISPLAY_MS = 500

export function createPlaybackSnapshots(
  scene: CitySceneDefinition,
  events: readonly ChapterSimulationEvent[],
): readonly PlaybackSnapshot[] {
  return Array.from({ length: events.length + 1 }, (_, index) => {
    const cursor = index - 1
    const world = projectCityWorld(scene, events, cursor)
    return {
      cursor,
      carrierProgress: world.carriers.vehicle?.roadProgress ?? 0,
      world,
    }
  })
}

export function carrierProgressAtCursor(
  scene: CitySceneDefinition,
  events: readonly ChapterSimulationEvent[],
  cursor: number,
  snapshots?: readonly PlaybackSnapshot[],
): number {
  const snapshot = snapshots?.find((candidate) => candidate.cursor === cursor)
  if (snapshot) return snapshot.carrierProgress
  const world = projectCityWorld(scene, events, cursor)
  return world.carriers.vehicle?.roadProgress ?? 0
}

export function createPlaybackSegment({
  currentProgress,
  cursor,
  events,
  scene,
  speed,
  snapshots,
  viewMode,
  viewportSize,
}: {
  readonly currentProgress: number
  readonly cursor: number
  readonly events: readonly ChapterSimulationEvent[]
  readonly scene: CitySceneDefinition
  readonly speed: PlaybackSpeed
  readonly snapshots?: readonly PlaybackSnapshot[]
  readonly viewMode?: AdvancedCityViewMode
  readonly viewportSize?: CitySize
}): PlaybackSegment | null {
  const toCursor = cursor + 1
  if (toCursor < 0 || toCursor >= events.length) return null
  return createPlaybackSegmentBetween({
    currentProgress,
    fromCursor: cursor,
    toCursor,
    events,
    scene,
    speed,
    ...(snapshots ? { snapshots } : {}),
    ...(viewMode ? { viewMode } : {}),
    ...(viewportSize ? { viewportSize } : {}),
  })
}

export function createPlaybackSegmentBetween({
  currentProgress,
  events,
  fromCursor,
  scene,
  speed,
  snapshots,
  toCursor,
  viewMode,
  viewportSize,
}: {
  readonly currentProgress: number
  readonly events: readonly ChapterSimulationEvent[]
  readonly fromCursor: number
  readonly scene: CitySceneDefinition
  readonly speed: PlaybackSpeed
  readonly snapshots?: readonly PlaybackSnapshot[]
  readonly toCursor: number
  readonly viewMode?: AdvancedCityViewMode
  readonly viewportSize?: CitySize
}): PlaybackSegment | null {
  if (toCursor < 0 || toCursor >= events.length) return null
  const fromProgress = clampProgress(currentProgress)
  const toProgress = carrierProgressAtCursor(scene, events, toCursor, snapshots)
  const mainRoadLength = polylineLength(scene.mainRoad.points)
  const distancePx = Math.abs(toProgress - fromProgress) * mainRoadLength * cameraScreenScale(scene, viewMode, viewportSize)
  const scaledMoveMs = (distancePx / CARRIER_SPEED_PX_PER_SECOND) * 1000 / speed
  const dwellMs = EVENT_DWELL_MS / speed
  const minimumMs = MIN_EVENT_DISPLAY_MS / speed

  return {
    fromCursor,
    toCursor,
    fromProgress,
    toProgress,
    moveDurationMs: scaledMoveMs,
    minimumDurationMs: minimumMs,
    speed,
    totalDurationMs: Math.max(minimumMs, scaledMoveMs + dwellMs),
  }
}

export function retimePlaybackSegment({
  currentProgress,
  elapsedMs,
  events,
  previousSegment,
  scene,
  speed,
  snapshots,
  viewMode,
  viewportSize,
}: {
  readonly currentProgress: number
  readonly elapsedMs: number
  readonly events: readonly ChapterSimulationEvent[]
  readonly previousSegment: PlaybackSegment
  readonly scene: CitySceneDefinition
  readonly speed: PlaybackSpeed
  readonly snapshots?: readonly PlaybackSnapshot[]
  readonly viewMode?: AdvancedCityViewMode
  readonly viewportSize?: CitySize
}): PlaybackSegment | null {
  const elapsed = Math.max(0, elapsedMs)
  const speedRatio = previousSegment.speed / speed
  if (elapsed >= previousSegment.moveDurationMs) {
    const remainingMs = Math.max(0, previousSegment.totalDurationMs - elapsed) * speedRatio
    return {
      fromCursor: previousSegment.fromCursor,
      toCursor: previousSegment.toCursor,
      fromProgress: previousSegment.toProgress,
      toProgress: previousSegment.toProgress,
      moveDurationMs: 0,
      minimumDurationMs: remainingMs,
      speed,
      totalDurationMs: remainingMs,
    }
  }

  const retimed = createPlaybackSegmentBetween({
    currentProgress,
    events,
    fromCursor: previousSegment.fromCursor,
    scene,
    speed,
    ...(snapshots ? { snapshots } : {}),
    toCursor: previousSegment.toCursor,
    ...(viewMode ? { viewMode } : {}),
    ...(viewportSize ? { viewportSize } : {}),
  })
  if (!retimed) return null
  const minRemainingMs = Math.max(0, previousSegment.minimumDurationMs - elapsed) * speedRatio
  const dwellMs = EVENT_DWELL_MS / speed
  return {
    ...retimed,
    minimumDurationMs: minRemainingMs,
    totalDurationMs: Math.max(minRemainingMs, retimed.moveDurationMs + dwellMs),
  }
}

export function cameraScreenScale(
  scene: CitySceneDefinition,
  viewMode: AdvancedCityViewMode = 'focus',
  viewportSize?: CitySize,
): number {
  const usedRoadAccessIndexes = new Set(scene.nodes.map((node) => node.roadAccessIndex))
  const usedFacilities = scene.physicalFacilities.filter((facility) => usedRoadAccessIndexes.has(facility.roadAccessIndex))
  const camera = getAdvancedCityCamera(scene, usedFacilities, viewMode, viewportSize)
  const widthScale = viewportSize?.width ? viewportSize.width / camera.viewBoxRect.width : 1
  const heightScale = viewportSize?.height ? viewportSize.height / camera.viewBoxRect.height : widthScale
  if (!Number.isFinite(widthScale) || !Number.isFinite(heightScale)) return 1
  return Math.max(0.001, Math.min(widthScale, heightScale))
}

export function interpolatePlaybackProgress(
  segment: PlaybackSegment,
  elapsedMs: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion || segment.moveDurationMs <= 0) return segment.toProgress
  const moveRatio = clampProgress(elapsedMs / segment.moveDurationMs)
  return segment.fromProgress + (segment.toProgress - segment.fromProgress) * moveRatio
}

export function inspectFacilityAtCursor({
  cursor,
  events,
  facilityOrNodeId,
  logicalNodeId,
  scene,
}: {
  readonly cursor: number
  readonly events: readonly ChapterSimulationEvent[]
  readonly facilityOrNodeId: string
  readonly logicalNodeId?: string
  readonly scene: CitySceneDefinition
}): FacilityInspection {
  const nodeIds = nodeIdsForFacility(scene, facilityOrNodeId)
  const observedNodeIds = logicalNodeId ? [logicalNodeId] : nodeIds
  const latestObservation = latestObservedEvent(events, cursor, observedNodeIds)
  return {
    facilityId: facilityIdFor(scene, facilityOrNodeId),
    latestEventIndex: latestObservation.index,
    latestNodeId: latestObservation.nodeId,
    nodeIds,
  }
}

export function nodeIdsForFacility(
  scene: CitySceneDefinition,
  facilityOrNodeId: string,
): readonly string[] {
  const physicalFacility = scene.physicalFacilities.find((facility) => facility.id === facilityOrNodeId)
  const sourceNode = scene.nodes.find((node) => node.id === facilityOrNodeId)
  const roadAccessIndex = physicalFacility?.roadAccessIndex ?? sourceNode?.roadAccessIndex
  if (roadAccessIndex === undefined) return []
  return scene.nodes
    .filter((node) => node.roadAccessIndex === roadAccessIndex)
    .map((node) => node.id)
}

export function facilityIdFor(scene: CitySceneDefinition, facilityOrNodeId: string): string {
  if (scene.physicalFacilities.some((facility) => facility.id === facilityOrNodeId)) return facilityOrNodeId
  const sourceNode = scene.nodes.find((node) => node.id === facilityOrNodeId)
  const physicalFacility = scene.physicalFacilities.find(
    (facility) => facility.roadAccessIndex === sourceNode?.roadAccessIndex,
  )
  return physicalFacility?.id ?? facilityOrNodeId
}

function latestObservedEvent(
  events: readonly ChapterSimulationEvent[],
  cursor: number,
  nodeIds: readonly string[],
): { readonly index: number; readonly nodeId: string | null } {
  if (cursor < 0 || nodeIds.length === 0) return { index: -1, nodeId: null }
  const nodeIdSet = new Set(nodeIds)
  const boundedCursor = Math.min(cursor, events.length - 1)
  for (let index = boundedCursor; index >= 0; index -= 1) {
    const event = events[index]
    if (!event) continue
    const focusedNodeId = event.cityCue.focusNodeIds.find((nodeId) => nodeIdSet.has(nodeId))
    if (focusedNodeId) return { index, nodeId: focusedNodeId }
    const changedNodeId = Object.keys(event.cityCue.nodeChanges ?? {}).find((nodeId) => nodeIdSet.has(nodeId))
    if (changedNodeId) return { index, nodeId: changedNodeId }
  }
  return { index: -1, nodeId: null }
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
