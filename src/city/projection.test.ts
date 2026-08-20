import { describe, expect, it } from 'vitest'

import { projectCityWorld } from './projection'
import type { CityCuedEvent, CitySceneDefinition } from './types'
import { validateChapterCityCue, validateCityScene } from './validation'

const scene: CitySceneDefinition = {
  id: 'chapter-advanced',
  label: 'Advanced chapter city',
  viewport: { width: 1200, height: 720 },
  mainRoad: {
    id: 'main-road',
    path: 'M100 360 L400 320 L700 280',
    points: [{ x: 100, y: 360 }, { x: 400, y: 320 }, { x: 700, y: 280 }],
  },
  nodes: [
    {
      id: 'producer',
      kind: 'producer',
      label: 'Producer',
      description: 'Records start here.',
      position: { x: 100, y: 360 },
      roadAccessIndex: 0,
      hitAreaPath: 'M80 330h80v70h-80Z',
    },
    {
      id: 'partition',
      kind: 'partition',
      label: 'Partition',
      description: 'Partition selection is inspected here.',
      position: { x: 380, y: 320 },
      roadAccessIndex: 1,
      hitAreaPath: 'M340 290h90v70h-90Z',
    },
    {
      id: 'broker',
      kind: 'broker',
      label: 'Broker',
      description: 'Records are appended here.',
      position: { x: 700, y: 280 },
      roadAccessIndex: 2,
      hitAreaPath: 'M650 240h100v80h-100Z',
    },
  ],
  routes: [
    {
      id: 'produce-route',
      kind: 'data',
      fromNodeId: 'producer',
      toNodeId: 'broker',
      path: 'M100 360 L400 320 L700 280',
      points: [{ x: 100, y: 360 }, { x: 400, y: 320 }, { x: 700, y: 280 }],
      checkpoints: [
        { id: 'loaded', position: { x: 100, y: 360 }, progress: 0, nodeId: 'producer' },
        { id: 'partitioned', position: { x: 400, y: 320 }, progress: 0.5, nodeId: 'partition' },
        { id: 'appended', position: { x: 700, y: 280 }, progress: 1, nodeId: 'broker' },
      ],
    },
  ],
}

describe('city scene validation', () => {
  it('accepts a scene with nodes, routes, and checkpoints', () => {
    expect(() => validateCityScene(scene)).not.toThrow()
  })

  it('rejects duplicate node ids and dangling route references', () => {
    expect(() => validateCityScene({
      ...scene,
      nodes: [scene.nodes[0]!, scene.nodes[0]!],
    })).toThrow('Duplicate node id: producer')

    expect(() => validateCityScene({
      ...scene,
      routes: [{ ...scene.routes[0]!, toNodeId: 'missing' }],
    })).toThrow('Route produce-route references unknown toNodeId: missing')
  })
})

describe('chapter city cue validation', () => {
  it('accepts cues that reference only scene ids', () => {
    expect(() => validateChapterCityCue(scene, {
      focusNodeIds: ['partition'],
      nodeChanges: { partition: { state: 'active', badge: 'p1' } },
      routeChanges: { 'produce-route': { state: 'active' } },
      carrierChanges: {
        message: {
          kind: 'record',
          routeId: 'produce-route',
          checkpointId: 'partitioned',
          progress: 0.5,
          label: 'order-2401',
        },
      },
      signal: { kind: 'ack', fromNodeId: 'broker', toNodeId: 'producer', state: 'complete', label: 'ack' },
      barrier: { routeId: 'produce-route', checkpointId: 'partitioned', state: 'open', label: 'partition gate' },
    })).not.toThrow()
  })

  it('rejects dangling focus, carrier, signal, and barrier references', () => {
    expect(() => validateChapterCityCue(scene, { focusNodeIds: ['serializer'] })).toThrow(
      'City cue focuses unknown node id: serializer',
    )

    expect(() => validateChapterCityCue(scene, {
      focusNodeIds: [],
      carrierChanges: { message: { kind: 'record', routeId: 'produce-route', checkpointId: 'missing' } },
    })).toThrow('Carrier message references unknown checkpointId on route produce-route: missing')

    expect(() => validateChapterCityCue(scene, {
      focusNodeIds: [],
      signal: { kind: 'ack', fromNodeId: 'missing', toNodeId: 'producer', state: 'active', label: 'ack' },
    })).toThrow('City cue signal references unknown fromNodeId: missing')

    expect(() => validateChapterCityCue(scene, {
      focusNodeIds: [],
      barrier: { checkpointId: 'partitioned', state: 'closed', label: 'gate' },
    })).toThrow('City cue barrier must reference a nodeId or routeId.')
  })
})

describe('projectCityWorld', () => {
  it('projects cursor state by replaying concrete city cues', () => {
    const events: readonly CityCuedEvent[] = [
      {
        cityCue: {
          focusNodeIds: ['producer'],
          nodeChanges: { producer: { state: 'active', badge: 'ready' } },
          carrierChanges: {
            message: {
              kind: 'record',
              routeId: 'produce-route',
              checkpointId: 'loaded',
              progress: 0,
              state: 'idle',
            },
          },
        },
      },
      {
        cityCue: {
          focusNodeIds: ['partition'],
          nodeChanges: {
            producer: { state: 'complete' },
            partition: { state: 'blocked', badge: 'key?' },
          },
          routeChanges: { 'produce-route': { state: 'blocked', disabled: true } },
          carrierChanges: {
            message: {
              kind: 'record',
              routeId: 'produce-route',
              checkpointId: 'partitioned',
              progress: 0.45,
              state: 'blocked',
            },
          },
          barrier: {
            routeId: 'produce-route',
            checkpointId: 'partitioned',
            state: 'closed',
            label: 'ordering blocked',
          },
        },
      },
    ]

    const atStart = projectCityWorld(scene, events, 0)
    expect(atStart.focusNodeIds).toEqual(['producer'])
    expect(atStart.nodes.producer?.focused).toBe(true)
    expect(atStart.nodes.producer?.badge).toBe('ready')
    expect(atStart.carriers.message?.checkpointId).toBe('loaded')

    const blocked = projectCityWorld(scene, events, 1)
    expect(blocked.focusNodeIds).toEqual(['partition'])
    expect(blocked.nodes.producer?.focused).toBe(false)
    expect(blocked.nodes.producer?.state).toBe('complete')
    expect(blocked.nodes.partition?.state).toBe('blocked')
    expect(blocked.routes['produce-route']?.disabled).toBe(true)
    expect(blocked.carriers.message?.progress).toBe(0.45)
    expect(blocked.barrier?.state).toBe('closed')
  })

  it('returns the base scene for a cursor before the first event and supports carrier removal', () => {
    expect(projectCityWorld(scene, [], 0).nodes.producer?.state).toBe('idle')
    expect(projectCityWorld(scene, [{ cityCue: { focusNodeIds: [] } }], -1).focusNodeIds).toEqual([])

    const world = projectCityWorld(scene, [
      { cityCue: { focusNodeIds: [], carrierChanges: { message: { kind: 'record', routeId: 'produce-route' } } } },
      { cityCue: { focusNodeIds: [], carrierChanges: { message: null } } },
    ], 1)

    expect(world.carriers.message).toBeUndefined()
  })
})
