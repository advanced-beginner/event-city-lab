import type { CityCuedEvent, CitySceneDefinition, CityWorldState } from './types'
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
    carriers: {},
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

    const carriers = { ...world.carriers }
    for (const [carrierId, change] of Object.entries(event.cityCue.carrierChanges ?? {})) {
      if (change === null) {
        delete carriers[carrierId]
        continue
      }
      carriers[carrierId] = {
        ...carriers[carrierId],
        ...change,
        id: carrierId,
      }
    }

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
