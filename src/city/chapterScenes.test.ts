import { describe, expect, it } from 'vitest'

import { getChapterRule } from '../domain/chapterEngine'
import type { AdvancedChapterId } from '../domain/chapterSimulation'
import { getAdvancedChapterScene, getExperimentCityPreview } from './chapterScenes'
import { projectCityWorld } from './projection'
import { isPointOnPolyline } from './routeGeometry'
import { validateCityScene } from './validation'

describe('advanced chapter city scenes', () => {
  it.each([2, 3, 4, 5, 6, 7, 8] as const)(
    'keeps Chapter %s experiment previews inside the scene contract',
    (chapterId: AdvancedChapterId) => {
      const scene = getAdvancedChapterScene(chapterId)
      const nodeIds = new Set(scene.nodes.map((node) => node.id))
      const routeIds = new Set(scene.routes.map((route) => route.id))
      const roadPointKeys = new Set(scene.mainRoad.points.map((point) => `${point.x}:${point.y}`))

      expect(() => validateCityScene(scene)).not.toThrow()
      expect(scene.mainRoad.id).toBe('downtown-main-arterial')
      expect(scene.mainRoad.points).toEqual([
        { x: 664, y: 794 },
        { x: 871.25, y: 674.5 },
        { x: 1078.5, y: 555 },
        { x: 1285.75, y: 435.5 },
        { x: 1493, y: 316 },
      ])
      expect(scene.physicalFacilities.map((facility) => ({
        hitAreaPath: facility.hitAreaPath,
        label: facility.label,
        position: facility.position,
        roadAccessIndex: facility.roadAccessIndex,
      }))).toEqual([
        {
          hitAreaPath: 'M535,690L668,650L745,704L712,790L610,826L535,770Z',
          label: 'Source / Producer',
          position: { x: 625, y: 714 },
          roadAccessIndex: 0,
        },
        {
          hitAreaPath: 'M690,430L815,390L925,490L902,625L790,670L690,590Z',
          label: 'Kafka Ingress',
          position: { x: 805, y: 510 },
          roadAccessIndex: 1,
        },
        {
          hitAreaPath: 'M885,305L1030,275L1115,360L1088,512L990,560L885,485Z',
          label: 'Kafka Cluster',
          position: { x: 997, y: 405 },
          roadAccessIndex: 2,
        },
        {
          hitAreaPath: 'M1160,472L1320,430L1435,515L1400,645L1270,690L1160,600Z',
          label: 'Consumer / Processor',
          position: { x: 1292, y: 548 },
          roadAccessIndex: 3,
        },
        {
          hitAreaPath: 'M1408,228L1575,195L1665,285L1630,405L1510,450L1408,360Z',
          label: 'Application / Sink',
          position: { x: 1530, y: 285 },
          roadAccessIndex: 4,
        },
      ])
      expect(scene.routes.find((route) => route.id === scene.initialVehicleRouteId)).toMatchObject({
        kind: 'data',
      })
      expect(new Set(scene.nodes.map((node) => node.roadAccessIndex)).size).toBeLessThanOrEqual(5)
      expect(new Set(scene.nodes.map((node) => node.roadAccessIndex)).size).toBeGreaterThanOrEqual(3)
      expect(scene.mainRoad.points.every((point) => isPointOnPolyline([
        scene.mainRoad.points[0]!,
        scene.mainRoad.points.at(-1)!,
      ], point, 0.01))).toBe(true)
      expect(Object.keys(projectCityWorld(scene, [], -1).carriers)).toEqual(['vehicle'])
      expect(scene.routes.every((route) => route.path.includes(' L') && !route.path.includes(' Q'))).toBe(true)
      expect(scene.routes.every((route) => route.points.length >= 2)).toBe(true)
      for (const route of scene.routes) {
        const points = route.points
        expect(route.checkpoints[0]?.position, route.id).toEqual(points[0])
        expect(route.checkpoints.at(-1)?.position, route.id).toEqual(points.at(-1))
        expect(isPointOnPolyline(points, route.checkpoints[1]!.position, 0.01), route.id).toBe(true)
        expect(points.every((point) => roadPointKeys.has(`${point.x}:${point.y}`)), route.id).toBe(true)
      }
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
