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
  physicalFacilities: [
    {
      id: 'slot-producer',
      label: 'Source / Producer',
      position: { x: 100, y: 360 },
      roadAccessIndex: 0,
      hitAreaPath: 'M80 330h80v70h-80Z',
    },
    {
      id: 'slot-partition',
      label: 'Kafka Cluster',
      position: { x: 380, y: 320 },
      roadAccessIndex: 1,
      hitAreaPath: 'M340 290h90v70h-90Z',
    },
    {
      id: 'slot-broker',
      label: 'Application / Sink',
      position: { x: 700, y: 280 },
      roadAccessIndex: 2,
      hitAreaPath: 'M650 240h100v80h-100Z',
    },
  ],
  initialVehicleRouteId: 'produce-route',
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
    expect(atStart.carriers.vehicle?.checkpointId).toBe('loaded')

    const blocked = projectCityWorld(scene, events, 1)
    expect(blocked.focusNodeIds).toEqual(['partition'])
    expect(blocked.nodes.producer?.focused).toBe(false)
    expect(blocked.nodes.producer?.state).toBe('complete')
    expect(blocked.nodes.partition?.state).toBe('blocked')
    expect(blocked.routes['produce-route']?.disabled).toBe(true)
    expect(blocked.carriers.vehicle?.progress).toBe(0.45)
    expect(blocked.barrier?.state).toBe('closed')
  })

  it('returns the base scene with one parked vehicle and does not remove its identity', () => {
    expect(projectCityWorld(scene, [], 0).nodes.producer?.state).toBe('idle')
    expect(projectCityWorld(scene, [{ cityCue: { focusNodeIds: [] } }], -1).focusNodeIds).toEqual([])

    const world = projectCityWorld(scene, [
      { cityCue: { focusNodeIds: [], carrierChanges: { message: { kind: 'record', routeId: 'produce-route' } } } },
      { cityCue: { focusNodeIds: [], carrierChanges: { message: null } } },
    ], 1)

    expect(Object.keys(world.carriers)).toEqual(['vehicle'])
    expect(world.carriers.vehicle).toMatchObject({ kind: 'record', routeId: 'produce-route' })
  })

  it('keeps one persistent message vehicle and ignores control tickets', () => {
    const world = projectCityWorld(scene, [
      {
        cityCue: {
          focusNodeIds: [],
          carrierChanges: {
            primary: { kind: 'record', routeId: 'produce-route', progress: 0.5 },
            replica: { kind: 'record', routeId: 'produce-route', progress: 1 },
          },
        },
      },
      {
        cityCue: {
          focusNodeIds: [],
          carrierChanges: {
            receipt: { kind: 'offset-ticket', routeId: 'produce-route', progress: 1 },
          },
        },
      },
    ], 1)

    expect(Object.keys(world.carriers)).toEqual(['vehicle'])
    expect(world.carriers.vehicle).toMatchObject({
      cueLabels: ['primary', 'replica'],
      cueCount: 2,
      kind: 'record',
      label: '메시지 흐름 요약',
      progress: 1,
      roadProgress: 1,
      sourceCarrierId: 'replica',
    })
  })

  it('parks the initial vehicle on the scene-declared route', () => {
    const customScene = {
      ...scene,
      initialVehicleRouteId: 'partition-route',
      routes: [
        {
          id: 'unused-route',
          kind: 'data' as const,
          fromNodeId: 'producer',
          toNodeId: 'partition',
          path: 'M100 360 L400 320',
          points: [{ x: 100, y: 360 }, { x: 400, y: 320 }],
          checkpoints: [
            { id: 'unused-route:start', position: { x: 100, y: 360 }, progress: 0, nodeId: 'producer' },
            { id: 'unused-route:end', position: { x: 400, y: 320 }, progress: 1, nodeId: 'partition' },
          ],
        },
        {
          id: 'partition-route',
          kind: 'data' as const,
          fromNodeId: 'partition',
          toNodeId: 'broker',
          path: 'M400 320 L700 280',
          points: [{ x: 400, y: 320 }, { x: 700, y: 280 }],
          checkpoints: [
            { id: 'partition-route:start', position: { x: 400, y: 320 }, progress: 0, nodeId: 'partition' },
            { id: 'partition-route:end', position: { x: 700, y: 280 }, progress: 1, nodeId: 'broker' },
          ],
        },
      ],
    }

    expect(projectCityWorld(customScene, [], -1).carriers.vehicle).toMatchObject({
      roadProgress: 0,
      routeId: 'partition-route',
    })
  })

  it('does not turn reverse signals into a southwest vehicle trip', () => {
    const reverseScene: CitySceneDefinition = {
      ...scene,
      routes: [
        ...scene.routes,
        {
          id: 'broker-producer',
          kind: 'return',
          fromNodeId: 'broker',
          toNodeId: 'producer',
          path: 'M700 280 L400 320 L100 360',
          points: [{ x: 700, y: 280 }, { x: 400, y: 320 }, { x: 100, y: 360 }],
          checkpoints: [
            { id: 'broker-producer:start', position: { x: 700, y: 280 }, progress: 0, nodeId: 'broker' },
            { id: 'broker-producer:mid', position: { x: 400, y: 320 }, progress: 0.5, nodeId: 'partition' },
            { id: 'broker-producer:end', position: { x: 100, y: 360 }, progress: 1, nodeId: 'producer' },
          ],
        },
      ],
    }

    const world = projectCityWorld(reverseScene, [
      {
        cityCue: {
          focusNodeIds: [],
          carrierChanges: {
            record: { kind: 'record', routeId: 'produce-route', progress: 1, state: 'complete' },
          },
        },
      },
      {
        cityCue: {
          focusNodeIds: [],
          carrierChanges: {
            ack: { kind: 'record', routeId: 'broker-producer', progress: 1, state: 'complete', label: 'ack' },
          },
        },
      },
    ], 1)

    expect(world.carriers.vehicle).toMatchObject({ routeId: 'produce-route', progress: 1 })
  })

  it('never moves the persistent vehicle backward when a later forward cue targets an earlier checkpoint', () => {
    const world = projectCityWorld(scene, [
      {
        cityCue: {
          focusNodeIds: [],
          carrierChanges: {
            arrived: { kind: 'record', routeId: 'produce-route', progress: 1, state: 'complete' },
          },
        },
      },
      {
        cityCue: {
          focusNodeIds: [],
          carrierChanges: {
            staleRetry: { kind: 'retry-record', routeId: 'produce-route', progress: 0.5, state: 'active' },
          },
        },
      },
    ], 1)

    expect(world.carriers.vehicle).toMatchObject({
      progress: 1,
      roadProgress: 1,
      routeId: 'produce-route',
      state: 'active',
    })
  })
})
