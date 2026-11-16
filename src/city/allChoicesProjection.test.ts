import { describe, expect, it } from 'vitest'

import { getChapterRule, simulateChapterExperiment } from '../domain/chapterEngine'
import { getAdvancedChapterScene } from './chapterScenes'
import { buildCarrierTransitions, projectCityWorld } from './projection'
import { isPointOnPolyline } from './routeGeometry'

const choices = ([2, 3, 4, 5, 6, 7, 8] as const).flatMap((chapterId) => (
  getChapterRule(chapterId).experiments.flatMap((experiment) => (
    experiment.choices.map((choice) => ({
      chapterId,
      experimentId: experiment.id,
      choiceId: choice.id,
    }))
  ))
))

describe('all chapter city evidence on Isometric Waypoint Graph', () => {
  it('covers all 21 experiments and 42 choices', () => {
    expect(choices).toHaveLength(42)
    expect(new Set(choices.map((choice) => choice.experimentId)).size).toBe(21)
  })

  it.each(choices)('$chapterId/$choiceId projects valid route coordinates, transitions, and rewind determinism', (choice) => {
    const run = simulateChapterExperiment({ ...choice, runId: 'projection-regression', seed: 2401 })
    const original = structuredClone(run)
    const scene = getAdvancedChapterScene(choice.chapterId)
    let previousProgress = 0

    const snapshots = run.events.map((_, cursor) => {
      const world = projectCityWorld(scene, run.events, cursor)
      const carriers = Object.values(world.carriers)
      expect(carriers.length).toBeGreaterThanOrEqual(1)
      expect(world.carriers.vehicle).toBeDefined()

      for (const carrier of carriers) {
        const route = scene.routes.find((candidate) => candidate.id === carrier.routeId)
        expect(route, `route ${carrier.routeId}`).toBeDefined()
        expect(isPointOnPolyline(route!.points, carrier.position, 0.1)).toBe(true)
        expect(['ne', 'se', 'sw', 'nw']).toContain(carrier.heading)
      }

      const primary = world.carriers.vehicle!
      expect(primary.journeyProgress).toBeGreaterThanOrEqual(previousProgress)
      expect(primary.journeyProgress).toBeLessThanOrEqual(1)
      expect(primary.label ?? '').not.toMatch(/\d+ records/)
      previousProgress = primary.journeyProgress
      return world
    })

    // Transition polylines between consecutive cursors must remain non-empty and continuous
    const initial = projectCityWorld(scene, run.events, -1)
    expect(initial.carriers.vehicle?.journeyProgress).toBe(0)
    expect(initial.signal).toBeNull()
    expect(initial.barrier).toBeNull()

    let prevWorld = initial
    for (const nextWorld of snapshots) {
      const transitions = buildCarrierTransitions(scene, prevWorld, nextWorld)
      expect(transitions.length).toBeGreaterThanOrEqual(1)
      for (const transition of transitions) {
        expect(transition.points.length).toBeGreaterThanOrEqual(2)
      }
      prevWorld = nextWorld
    }

    // Rewinding must deterministically restore prior evidence states
    for (let cursor = run.events.length - 1; cursor >= 0; cursor -= 1) {
      expect(projectCityWorld(scene, run.events, cursor)).toEqual(snapshots[cursor])
    }
    expect(run).toEqual(original)
  })
})
