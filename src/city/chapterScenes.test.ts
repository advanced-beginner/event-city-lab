import { describe, expect, it } from 'vitest'

import { getChapterRule } from '../domain/chapterEngine'
import type { AdvancedChapterId } from '../domain/chapterSimulation'
import { getAdvancedChapterScene, getExperimentCityPreview } from './chapterScenes'
import { validateCityScene } from './validation'

describe('advanced chapter city scenes', () => {
  it.each([2, 3, 4, 5, 6, 7, 8] as const)(
    'keeps Chapter %s experiment previews inside the scene contract',
    (chapterId: AdvancedChapterId) => {
      const scene = getAdvancedChapterScene(chapterId)
      const nodeIds = new Set(scene.nodes.map((node) => node.id))
      const routeIds = new Set(scene.routes.map((route) => route.id))

      expect(() => validateCityScene(scene)).not.toThrow()
      expect(scene.routes.every((route) => route.path.includes(' L') && !route.path.includes(' Q'))).toBe(true)
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
