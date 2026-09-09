import { describe, expect, it } from 'vitest'

import { getChapterRule, simulateChapterExperiment } from '../domain/chapterEngine'
import { getAdvancedChapterScene } from './chapterScenes'
import { projectCityWorld } from './projection'
import { interpolatePolyline, isPointOnPolyline } from './routeGeometry'

const choices = ([2, 3, 4, 5, 6, 7, 8] as const).flatMap((chapterId) => (
  getChapterRule(chapterId).experiments.flatMap((experiment) => (
    experiment.choices.map((choice) => ({
      chapterId,
      experimentId: experiment.id,
      choiceId: choice.id,
    }))
  ))
))

describe('all chapter city evidence', () => {
  it('covers all 21 experiments and 42 choices', () => {
    expect(choices).toHaveLength(42)
    expect(new Set(choices.map((choice) => choice.experimentId)).size).toBe(21)
  })

  it.each(choices)('$chapterId/$choiceId preserves evidence and one forward vehicle through every cursor', (choice) => {
    const run = simulateChapterExperiment({ ...choice, runId: 'projection-regression', seed: 2401 })
    const original = structuredClone(run)
    const scene = getAdvancedChapterScene(choice.chapterId)
    let previousProgress = 0
    const snapshots = run.events.map((_, cursor) => {
      const world = projectCityWorld(scene, run.events, cursor)
      expect(Object.keys(world.carriers)).toEqual(['vehicle'])
      const vehicle = world.carriers.vehicle!
      expect(vehicle.roadProgress).toBeGreaterThanOrEqual(previousProgress)
      expect(vehicle.roadProgress).toBeLessThanOrEqual(1)
      expect(isPointOnPolyline(scene.mainRoad.points,
        interpolatePolyline(scene.mainRoad.points, vehicle.roadProgress), 0.01)).toBe(true)
      expect(vehicle.label ?? '').not.toMatch(/\d+ records/)
      previousProgress = vehicle.roadProgress
      return world
    })

    // Rewinding is a replay of observed evidence, not an undo of mutable UI state.
    for (let cursor = run.events.length - 1; cursor >= 0; cursor -= 1) {
      expect(projectCityWorld(scene, run.events, cursor)).toEqual(snapshots[cursor])
    }
    const initial = projectCityWorld(scene, run.events, -1)
    expect(initial.carriers.vehicle?.roadProgress).toBe(0)
    expect(initial.signal).toBeNull()
    expect(initial.barrier).toBeNull()
    expect(run).toEqual(original)
  })
})
