import { interpolatePolyline, nearestPointOnPolyline } from './routeGeometry'
import type { CityCarrierChange, CityCuedEvent, CitySceneDefinition, CityWorldState } from './types'
import { validateChapterCityCue, validateCityScene } from './validation'

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

  return events.slice(0, cursor + 1).reduce((world, event) => {
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

    const carriers = projectSingleVehicle(scene, world.carriers, event.cityCue.carrierChanges)

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

function projectSingleVehicle(
  scene: CitySceneDefinition,
  current: CityWorldState['carriers'],
  changes: ChapterCityCueCarrierChanges,
): CityWorldState['carriers'] {
  if (changes === undefined) return current

  const recordChanges = Object.entries(changes).flatMap(([id, change]) => {
    if (change === null || change.kind === 'offset-ticket') return []
    return [{
      change,
      id,
      roadProgress: carrierRoadProgress(scene, change),
      forward: isForwardCarrierRoute(scene, change.routeId),
    }]
  })
  const currentRoadProgress = current.vehicle?.roadProgress ?? 0
  const eligibleChanges = recordChanges
    .filter((candidate) => candidate.forward && candidate.roadProgress >= currentRoadProgress - 0.001)
    .sort((left, right) => (
      right.roadProgress - left.roadProgress || left.id.localeCompare(right.id)
    ))
  const visibleChange = eligibleChanges[0]
  const batchLabels = recordChanges.map(({ change, id }) => change.label ?? id)
  if (visibleChange) {
    const label = batchVehicleLabel(visibleChange.change, recordChanges.length)
    return {
      vehicle: {
        ...visibleChange.change,
        id: 'vehicle',
        batchLabels,
        batchSize: recordChanges.length,
        roadProgress: Math.max(currentRoadProgress, visibleChange.roadProgress),
        sourceCarrierId: visibleChange.id,
        ...(label ? { label } : {}),
      },
    }
  }

  const reverseStatusChange = recordChanges
    .sort((left, right) => left.id.localeCompare(right.id))[0]
  if (reverseStatusChange && current.vehicle) {
    const label = current.vehicle.batchSize > 1
      ? current.vehicle.label
      : batchVehicleLabel(reverseStatusChange.change, recordChanges.length)
    return {
      vehicle: {
        ...current.vehicle,
        ...(reverseStatusChange.change.state ? { state: reverseStatusChange.change.state } : {}),
        ...(label ? { label } : {}),
      },
    }
  }

  return current
}

type ChapterCityCueCarrierChanges = CityCuedEvent['cityCue']['carrierChanges']

function initialVehicle(scene: CitySceneDefinition): CityWorldState['carriers'] {
  const route = scene.routes.find((candidate) => candidate.id === scene.initialVehicleRouteId)
  if (!route) return {}
  return {
    vehicle: {
      id: 'vehicle',
      batchLabels: ['record'],
      batchSize: 1,
      kind: 'record',
      roadProgress: 0,
      routeId: route.id,
      sourceCarrierId: 'initial',
      ...(route.checkpoints[0] ? { checkpointId: route.checkpoints[0].id } : {}),
      progress: 0,
      state: 'idle',
      label: 'record',
    },
  }
}

function isForwardCarrierRoute(scene: CitySceneDefinition, routeId: string): boolean {
  const route = scene.routes.find((candidate) => candidate.id === routeId)
  if (!route) return false
  const fromNode = scene.nodes.find((node) => node.id === route.fromNodeId)
  const toNode = scene.nodes.find((node) => node.id === route.toNodeId)
  return Boolean(fromNode && toNode && fromNode.roadAccessIndex < toNode.roadAccessIndex)
}

function batchVehicleLabel(change: NonNullable<CityCarrierChangeValue>, visibleCount: number): string | undefined {
  if (visibleCount <= 1) return change.label
  return `${visibleCount} records · 순차`
}

function carrierRoadProgress(scene: CitySceneDefinition, change: CityCarrierChange): number {
  const route = scene.routes.find((candidate) => candidate.id === change.routeId)
  if (!route) return 0
  const checkpoint = change.checkpointId
    ? route.checkpoints.find((candidate) => candidate.id === change.checkpointId)
    : undefined
  const routeProgress = Math.max(0, Math.min(1, change.progress ?? checkpoint?.progress ?? 0))
  const position = interpolatePolyline(route.points, routeProgress)
  return nearestPointOnPolyline(scene.mainRoad.points, position).routeProgress
}

type CityCarrierChangeValue = NonNullable<NonNullable<ChapterCityCueCarrierChanges>[string]>
