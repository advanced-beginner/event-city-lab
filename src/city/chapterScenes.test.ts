import { describe, expect, it } from 'vitest'

import { getChapterRule } from '../domain/chapterEngine'
import type { AdvancedChapterId } from '../domain/chapterSimulation'
import { getAdvancedChapterScene, getExperimentCityPreview } from './chapterScenes'
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
      expect(scene.mainRoad.points).toHaveLength(11)
      expect(new Set(scene.nodes.map((node) => node.roadAccessIndex)).size).toBe(scene.nodes.length)
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
