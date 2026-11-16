import { describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG, DEFAULT_MESSAGE } from '../domain/simulation'
import { simulateProducerSend } from '../domain/engine'
import { getChapterOneScene, getChapterScene } from './chapterScenes'
import { createIsoPrism, isoPoint } from './isometric'
import {
  buildCarrierTransitions,
  createChapterOneCuedEvents,
  projectCityWorld,
} from './projection'
import { isPointOnPolyline } from './routeGeometry'
import type { CityCuedEvent, CitySceneDefinition } from './types'
import { validateChapterCityCue, validateCityScene } from './validation'

const pProducer = isoPoint(2, 5)
const pPartition = isoPoint(5, 3)
const pBroker = isoPoint(5, 7)

const scene: CitySceneDefinition = {
  id: 'chapter-test-graph',
  chapterId: 2,
  label: 'Test Isometric Graph',
  viewport: { width: 1600, height: 900 },
  gridBounds: { minU: 0, maxU: 10, minV: 0, maxV: 10 },
  physicalFacilities: [
    {
      id: 'producer',
      label: 'Producer',
      koreanLabel: '출발센터',
      archetype: 'warehouse',
      grid: { u: 2, v: 5 },
      position: pProducer,
      footprint: { u: 1.2, v: 1.2, height: 50 },
      hitAreaPath: createIsoPrism(2, 5, 1.2, 1.2, 50).outlinePath,
    },
    {
      id: 'partition',
      label: 'Partition',
      koreanLabel: '파티션',
      archetype: 'hub',
      grid: { u: 5, v: 3 },
      position: pPartition,
      footprint: { u: 1.2, v: 1.2, height: 50 },
      hitAreaPath: createIsoPrism(5, 3, 1.2, 1.2, 50).outlinePath,
    },
    {
      id: 'broker',
      label: 'Broker',
      koreanLabel: '기록센터',
      archetype: 'factory',
      grid: { u: 5, v: 7 },
      position: pBroker,
      footprint: { u: 1.2, v: 1.2, height: 50 },
      hitAreaPath: createIsoPrism(5, 7, 1.2, 1.2, 50).outlinePath,
    },
  ],
  initialVehicleRouteId: 'producer-partition',
  nodes: [
    {
      id: 'producer',
      kind: 'producer',
      archetype: 'warehouse',
      facilityId: 'producer',
      label: 'Producer',
      description: 'Records start here.',
      grid: { u: 2, v: 5 },
      position: pProducer,
      hitAreaPath: createIsoPrism(2, 5, 1.2, 1.2, 50).outlinePath,
    },
    {
      id: 'partition',
      kind: 'partition',
      archetype: 'hub',
      facilityId: 'partition',
      label: 'Partition',
      description: 'Partition branch node.',
      grid: { u: 5, v: 3 },
      position: pPartition,
      hitAreaPath: createIsoPrism(5, 3, 1.2, 1.2, 50).outlinePath,
    },
    {
      id: 'broker',
      kind: 'broker',
      archetype: 'factory',
      facilityId: 'broker',
      label: 'Broker',
      description: 'Records finish here.',
      grid: { u: 5, v: 7 },
      position: pBroker,
      hitAreaPath: createIsoPrism(5, 7, 1.2, 1.2, 50).outlinePath,
    },
  ],
  routes: [
    {
      id: 'producer-partition',
      kind: 'data',
      fromNodeId: 'producer',
      toNodeId: 'partition',
      path: `M${pProducer.x} ${pProducer.y} L${pPartition.x} ${pPartition.y}`,
      points: [pProducer, pPartition],
      checkpoints: [
        { id: 'producer-partition:start', position: pProducer, progress: 0, nodeId: 'producer' },
        { id: 'producer-partition:mid', position: { x: (pProducer.x + pPartition.x) / 2, y: (pProducer.y + pPartition.y) / 2 }, progress: 0.5 },
        { id: 'producer-partition:end', position: pPartition, progress: 1, nodeId: 'partition' },
      ],
    },
    {
      id: 'partition-broker',
      kind: 'data',
      fromNodeId: 'partition',
      toNodeId: 'broker',
      path: `M${pPartition.x} ${pPartition.y} L${pBroker.x} ${pBroker.y}`,
      points: [pPartition, pBroker],
      checkpoints: [
        { id: 'partition-broker:start', position: pPartition, progress: 0, nodeId: 'partition' },
        { id: 'partition-broker:mid', position: { x: (pPartition.x + pBroker.x) / 2, y: (pPartition.y + pBroker.y) / 2 }, progress: 0.5 },
        { id: 'partition-broker:end', position: pBroker, progress: 1, nodeId: 'broker' },
      ],
    },
    {
      id: 'broker-partition-loop',
      kind: 'retry',
      fromNodeId: 'broker',
      toNodeId: 'partition',
      path: `M${pBroker.x} ${pBroker.y} L${pPartition.x} ${pPartition.y}`,
      points: [pBroker, pPartition],
      checkpoints: [
        { id: 'broker-partition-loop:start', position: pBroker, progress: 0, nodeId: 'broker' },
        { id: 'broker-partition-loop:mid', position: { x: (pBroker.x + pPartition.x) / 2, y: (pBroker.y + pPartition.y) / 2 }, progress: 0.5 },
        { id: 'broker-partition-loop:end', position: pPartition, progress: 1, nodeId: 'partition' },
      ],
    },
  ],
}

describe('city scene graph validation', () => {
  it('accepts connected waypoint scenes and rejects disconnected endpoints', () => {
    expect(() => validateCityScene(scene)).not.toThrow()

    expect(() => validateCityScene({
      ...scene,
      nodes: [scene.nodes[0]!, scene.nodes[0]!],
    })).toThrow('Duplicate node id: producer')

    expect(() => validateCityScene({
      ...scene,
      routes: [{
        ...scene.routes[0]!,
        points: [{ x: 0, y: 0 }, pPartition],
      }],
    })).toThrow('Route producer-partition start point must match fromNode producer position.')
  })

  it('validates chapter cues against the scene graph', () => {
    expect(() => validateChapterCityCue(scene, {
      focusNodeIds: ['partition'],
      nodeChanges: { partition: { state: 'active', badge: 'p1' } },
      routeChanges: { 'producer-partition': { state: 'active' } },
      carrierChanges: {
        message: {
          kind: 'record',
          routeId: 'producer-partition',
          checkpointId: 'producer-partition:end',
          progress: 1,
          label: 'order-2401',
        },
      },
      signal: { kind: 'ack', fromNodeId: 'broker', toNodeId: 'producer', state: 'complete', label: 'ack' },
      barrier: { routeId: 'producer-partition', checkpointId: 'producer-partition:end', state: 'open', label: 'gate' },
    })).not.toThrow()

    expect(() => validateChapterCityCue(scene, { focusNodeIds: ['missing'] })).toThrow(
      'City cue focuses unknown node id: missing',
    )
  })
})

describe('projectCityWorld Waypoint Graph projection', () => {
  it('projects A -> B -> C and loopback trajectories with exact positions and headings', () => {
    const events: readonly CityCuedEvent[] = [
      {
        cityCue: {
          focusNodeIds: ['partition'],
          carrierChanges: {
            record: { kind: 'record', routeId: 'producer-partition', progress: 1, state: 'active' },
          },
        },
      },
      {
        cityCue: {
          focusNodeIds: ['broker'],
          carrierChanges: {
            record: { kind: 'record', routeId: 'partition-broker', progress: 1, state: 'complete' },
          },
        },
      },
      {
        cityCue: {
          focusNodeIds: ['partition'],
          carrierChanges: {
            retry: { kind: 'retry-record', routeId: 'broker-partition-loop', progress: 1, state: 'active', label: 'retry loop' },
          },
        },
      },
    ]

    const atB = projectCityWorld(scene, events, 0)
    expect(atB.carriers.vehicle?.position).toEqual(pPartition)
    expect(atB.carriers.vehicle?.heading).toBe('ne')

    const atC = projectCityWorld(scene, events, 1)
    expect(atC.carriers.vehicle?.position).toEqual(pBroker)
    expect(atC.carriers.vehicle?.heading).toBe('se')

    const atLoopBackToB = projectCityWorld(scene, events, 2)
    expect(atLoopBackToB.carriers.vehicle?.position).toEqual(pPartition)
    expect(atLoopBackToB.carriers.vehicle?.heading).toBe('nw')
    expect(atLoopBackToB.carriers.vehicle?.journeyProgress).toBe(1)

    const transitions = buildCarrierTransitions(scene, atC, atLoopBackToB)
    expect(transitions[0]?.points).toEqual([pBroker, pPartition])
  })

  it('splits branching carriers across simultaneous routes and collapses cleanly back', () => {
    const ch2Scene = getChapterScene(2)
    const events: readonly CityCuedEvent[] = [
      {
        cityCue: {
          focusNodeIds: ['producer', 'partition-p0', 'partition-p1', 'partition-p2'],
          carrierChanges: {
            'record-1': { kind: 'record', routeId: 'producer-p0', progress: 1, state: 'active', label: 'p0' },
            'record-2': { kind: 'record', routeId: 'producer-p1', progress: 1, state: 'active', label: 'p1' },
            'record-3': { kind: 'record', routeId: 'producer-p2', progress: 1, state: 'active', label: 'p2' },
          },
        },
      },
    ]

    const world = projectCityWorld(ch2Scene, events, 0)
    expect(Object.keys(world.carriers)).toEqual(['vehicle', 'branch-1', 'branch-2'])
    expect(world.carriers.vehicle?.position).toEqual(ch2Scene.nodes.find((n) => n.id === 'partition-p0')?.position)
    expect(world.carriers['branch-1']?.position).toEqual(ch2Scene.nodes.find((n) => n.id === 'partition-p1')?.position)
    expect(world.carriers['branch-2']?.position).toEqual(ch2Scene.nodes.find((n) => n.id === 'partition-p2')?.position)
  })

  it('ignores return-lane offset-ticket receipts so the primary van stays parked at its destination', () => {
    const ch2Scene = getChapterScene(2)
    const world = projectCityWorld(ch2Scene, [
      {
        cityCue: {
          focusNodeIds: ['application'],
          carrierChanges: {
            record: { kind: 'record', routeId: 'p1-application', progress: 1, state: 'complete' },
          },
        },
      },
      {
        cityCue: {
          focusNodeIds: ['application'],
          carrierChanges: {
            receipt: { kind: 'offset-ticket', routeId: 'application-producer-result', progress: 1, state: 'complete' },
          },
          signal: { kind: 'ack', fromNodeId: 'application', toNodeId: 'producer', state: 'complete', label: 'ok' },
        },
      },
    ], 1)

    expect(world.carriers.vehicle?.routeId).toBe('p1-application')
    expect(world.carriers.vehicle?.position).toEqual(ch2Scene.nodes.find((n) => n.id === 'application')?.position)
  })

  it('projects Chapter 1 failed and succeeded runs onto the Chapter 1 diorama scene', () => {
    const ch1Scene = getChapterOneScene()
    const failedRun = simulateProducerSend({
      runId: 'ch1-fail',
      seed: 2401,
      message: DEFAULT_MESSAGE,
      config: { ...DEFAULT_CONFIG, serializer: 'string' },
    })
    const failedWorld = projectCityWorld(ch1Scene, createChapterOneCuedEvents(failedRun), failedRun.events.length - 1)
    expect(failedWorld.barrier?.state).toBe('closed')
    expect(failedWorld.nodes.serializer?.state).toBe('failed')
    expect(isPointOnPolyline(ch1Scene.routes[0]!.points, failedWorld.carriers.vehicle!.position, 0.1)).toBe(true)

    const successRun = simulateProducerSend({
      runId: 'ch1-ok',
      seed: 2401,
      message: DEFAULT_MESSAGE,
      config: { ...DEFAULT_CONFIG, serializer: 'json' },
    })
    const successWorld = projectCityWorld(ch1Scene, createChapterOneCuedEvents(successRun), successRun.events.length - 1)
    expect(successWorld.signal?.kind).toBe('ack')
    expect(successWorld.nodes.broker?.state).toBe('complete')
    expect(successWorld.carriers.vehicle?.position).toEqual(ch1Scene.nodes.find((n) => n.id === 'broker')?.position)
  })
})
