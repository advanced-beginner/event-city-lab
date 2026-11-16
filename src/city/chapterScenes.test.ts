import { describe, expect, it } from 'vitest'

import { getChapterRule } from '../domain/chapterEngine'
import type { AdvancedChapterId } from '../domain/chapterSimulation'
import {
  getAdvancedChapterScene,
  getChapterOneScene,
  getChapterScene,
  getExperimentCityPreview,
} from './chapterScenes'
import { projectCityWorld } from './projection'
import { isPointOnPolyline } from './routeGeometry'
import { validateCityScene } from './validation'

describe('isometric diorama chapter scenes (Chapters 1-8)', () => {
  it('validates Chapter 1 diorama scene with exact A -> B -> C connectivity', () => {
    const scene = getChapterOneScene()
    expect(() => validateCityScene(scene)).not.toThrow()
    expect(scene.viewport).toEqual({ width: 1600, height: 900 })
    expect(scene.nodes.map((node) => node.id)).toEqual(['producer', 'serializer', 'broker'])
    expect(scene.routes.map((route) => route.id)).toEqual([
      'producer-serializer',
      'serializer-broker',
      'broker-producer-ack',
    ])

    const serializer = scene.nodes.find((n) => n.id === 'serializer')!
    expect(scene.routes[0]!.points.at(-1)).toEqual(serializer.position)
    expect(scene.routes[1]!.points[0]).toEqual(serializer.position)
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8] as const)(
    'validates Chapter %s diorama scene geometry, facility spacing, and waypoint connectivity',
    (chapterId) => {
      const scene = getChapterScene(chapterId)
      const nodeById = new Map(scene.nodes.map((node) => [node.id, node]))

      expect(() => validateCityScene(scene)).not.toThrow()
      expect(scene.viewport).toEqual({ width: 1600, height: 900 })
      expect(scene.routes.find((route) => route.id === scene.initialVehicleRouteId)).toMatchObject({
        kind: 'data',
      })
      expect(Object.keys(projectCityWorld(scene, [], -1).carriers)).toEqual(['vehicle'])

      for (const route of scene.routes) {
        const fromNode = nodeById.get(route.fromNodeId)!
        const toNode = nodeById.get(route.toNodeId)!
        expect(route.points.length, route.id).toBeGreaterThanOrEqual(2)
        expect(route.points[0], route.id).toEqual(fromNode.position)
        expect(route.points.at(-1), route.id).toEqual(toNode.position)
        expect(route.checkpoints[0]?.position, route.id).toEqual(route.points[0])
        expect(route.checkpoints.at(-1)?.position, route.id).toEqual(route.points.at(-1))
        expect(isPointOnPolyline(route.points, route.checkpoints[1]!.position, 0.05), route.id).toBe(true)
      }

      // Ensure no two physical facility centers overlap in grid space
      for (let i = 0; i < scene.physicalFacilities.length; i += 1) {
        for (let j = i + 1; j < scene.physicalFacilities.length; j += 1) {
          const left = scene.physicalFacilities[i]!
          const right = scene.physicalFacilities[j]!
          const gridDistance = Math.hypot(left.grid.u - right.grid.u, left.grid.v - right.grid.v)
          expect(gridDistance, `${left.id} vs ${right.id}`).toBeGreaterThanOrEqual(1.8)
        }
      }
    },
  )

  it.each([2, 3, 4, 5, 6, 7, 8] as const)(
    'keeps Chapter %s experiment previews inside the scene contract',
    (chapterId: AdvancedChapterId) => {
      const scene = getAdvancedChapterScene(chapterId)
      const nodeIds = new Set(scene.nodes.map((node) => node.id))
      const routeIds = new Set(scene.routes.map((route) => route.id))

      if (chapterId === 8) {
        expect(scene.boundaries?.map((boundary) => boundary.id)).toEqual(['consume-transform-produce-tx'])
      }

      for (const experiment of getChapterRule(chapterId).experiments) {
        for (const choice of experiment.choices) {
          const preview = getExperimentCityPreview(experiment.id, choice.id)
          const subject = `${experiment.id}/${choice.id}`
          expect(preview.nodeIds.length, subject).toBeGreaterThan(0)
          expect(preview.routeIds.length, subject).toBeGreaterThan(0)
          expect(preview.nodeIds.every((nodeId) => nodeIds.has(nodeId)), subject).toBe(true)
          expect(preview.routeIds.every((routeId) => routeIds.has(routeId)), subject).toBe(true)
        }
      }
    },
  )
})

describe('experiment choice previews', () => {
  it.each([2, 3, 4, 5, 6, 7, 8] as const)(
    'gives Chapter %s sibling choices distinguishable previews',
    (chapterId: AdvancedChapterId) => {
      for (const experiment of getChapterRule(chapterId).experiments) {
        const signatures = experiment.choices.map((choice) => {
          const preview = getExperimentCityPreview(experiment.id, choice.id)
          return {
            choiceId: choice.id,
            signature: JSON.stringify([
              [...new Set(preview.nodeIds)].sort(),
              [...new Set(preview.routeIds)].sort(),
            ]),
          }
        })

        for (let left = 0; left < signatures.length; left += 1) {
          for (let right = left + 1; right < signatures.length; right += 1) {
            const pair = `${experiment.id}: ${signatures[left]!.choiceId} vs ${signatures[right]!.choiceId}`
            expect(signatures[left]!.signature, pair).not.toBe(signatures[right]!.signature)
          }
        }
      }
    },
  )
})
