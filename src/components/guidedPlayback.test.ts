import { describe, expect, it } from 'vitest'

import { getAdvancedChapterScene } from '../city/chapterScenes'
import { getChapterRule, simulateChapterExperiment } from '../domain/chapterEngine'
import type { ChapterSimulationRun } from '../domain/chapterSimulation'
import {
  CARRIER_SPEED_PX_PER_SECOND,
  EVENT_DWELL_MS,
  MIN_EVENT_DISPLAY_MS,
  carrierProgressAtCursor,
  createPlaybackSegment,
  inspectFacilityAtCursor,
  interpolatePlaybackProgress,
  nodeIdsForFacility,
  retimePlaybackSegment,
} from './guidedPlayback'

function chapter2Run(choiceId: string): ChapterSimulationRun {
  const experiment = getChapterRule(2).experiments[0]
  if (!experiment) throw new Error('Chapter 2 first experiment is required.')
  return simulateChapterExperiment({
    runId: `playback-${choiceId}`,
    seed: 2401,
    chapterId: 2,
    experimentId: experiment.id,
    choiceId,
  })
}

describe('guided playback contract', () => {
  it('starts before the event log at cursor -1 with the parked vehicle', () => {
    const scene = getAdvancedChapterScene(2)
    const run = chapter2Run('stable-customer-key')

    expect(carrierProgressAtCursor(scene, run.events, -1)).toBe(0)
  })

  it('builds one time-scaled segment from carrier distance, dwell, and minimum display time', () => {
    const scene = getAdvancedChapterScene(2)
    const run = chapter2Run('stable-customer-key')
    const segment = createPlaybackSegment({
      currentProgress: 0,
      cursor: -1,
      events: run.events,
      scene,
      speed: 1,
    })

    expect(segment).not.toBeNull()
    expect(segment?.fromCursor).toBe(-1)
    expect(segment?.toCursor).toBe(0)
    expect(segment?.totalDurationMs).toBeGreaterThanOrEqual(MIN_EVENT_DISPLAY_MS)
    expect(segment?.totalDurationMs).toBeGreaterThanOrEqual((segment?.moveDurationMs ?? 0) + EVENT_DWELL_MS)
    expect(CARRIER_SPEED_PX_PER_SECOND).toBe(240)
  })

  it('applies 0.5x and 2x only to display durations', () => {
    const scene = getAdvancedChapterScene(2)
    const run = chapter2Run('stable-customer-key')
    const normal = createPlaybackSegment({ currentProgress: 0, cursor: -1, events: run.events, scene, speed: 1 })
    const slow = createPlaybackSegment({ currentProgress: 0, cursor: -1, events: run.events, scene, speed: 0.5 })
    const fast = createPlaybackSegment({ currentProgress: 0, cursor: -1, events: run.events, scene, speed: 2 })

    expect(slow?.moveDurationMs).toBeCloseTo((normal?.moveDurationMs ?? 0) * 2, 5)
    expect(slow?.totalDurationMs).toBeCloseTo((normal?.totalDurationMs ?? 0) * 2, 5)
    expect(fast?.moveDurationMs).toBeCloseTo((normal?.moveDurationMs ?? 0) / 2, 5)
    expect(fast?.totalDurationMs).toBeCloseTo((normal?.totalDurationMs ?? 0) / 2, 5)
  })

  it('freezes mid-move progress and reduced motion snaps to the next checkpoint', () => {
    const segment = {
      fromCursor: 0,
      toCursor: 1,
      fromProgress: 0.1,
      toProgress: 0.6,
      moveDurationMs: 1000,
      minimumDurationMs: 500,
      speed: 1 as const,
      totalDurationMs: 1200,
    }

    expect(interpolatePlaybackProgress(segment, 500, false)).toBeCloseTo(0.35)
    expect(interpolatePlaybackProgress(segment, 500, true)).toBe(0.6)
  })

  it('does not restart minimum dwell when playback settings change after movement is complete', () => {
    const scene = getAdvancedChapterScene(2)
    const run = chapter2Run('stable-customer-key')
    const previousSegment = {
      fromCursor: 2,
      toCursor: 3,
      fromProgress: 0.5,
      toProgress: 1,
      moveDurationMs: 300,
      minimumDurationMs: 500,
      speed: 1 as const,
      totalDurationMs: 500,
    }

    const retimed = retimePlaybackSegment({
      currentProgress: 1,
      elapsedMs: 420,
      events: run.events,
      previousSegment,
      scene,
      speed: 0.5,
      viewMode: 'overview',
      viewportSize: { width: 1440, height: 900 },
    })

    expect(retimed).toMatchObject({
      fromProgress: 1,
      toProgress: 1,
      moveDurationMs: 0,
      totalDurationMs: 160,
    })
  })

  it('scales already-started dwell remaining time when speed changes', () => {
    const scene = getAdvancedChapterScene(2)
    const run = chapter2Run('stable-customer-key')
    const previousSegment = {
      fromCursor: 2,
      toCursor: 3,
      fromProgress: 0.5,
      toProgress: 1,
      moveDurationMs: 100,
      minimumDurationMs: 500,
      speed: 1 as const,
      totalDurationMs: 700,
    }

    const retimed = retimePlaybackSegment({
      currentProgress: 1,
      elapsedMs: 300,
      events: run.events,
      previousSegment,
      scene,
      speed: 2,
    })

    expect(retimed).toMatchObject({
      fromProgress: 1,
      toProgress: 1,
      moveDurationMs: 0,
      totalDurationMs: 200,
      speed: 2,
    })
  })

  it('retimes remaining movement from the current carrier position', () => {
    const scene = getAdvancedChapterScene(2)
    const run = chapter2Run('stable-customer-key')
    const previousSegment = {
      fromCursor: 2,
      toCursor: 3,
      fromProgress: 0.5,
      toProgress: 1,
      moveDurationMs: 1000,
      minimumDurationMs: 500,
      speed: 1 as const,
      totalDurationMs: 1200,
    }

    const retimed = retimePlaybackSegment({
      currentProgress: 0.75,
      elapsedMs: 500,
      events: run.events,
      previousSegment,
      scene,
      speed: 2,
    })

    expect(retimed?.fromProgress).toBe(0.75)
    expect(retimed?.toCursor).toBe(3)
    expect(retimed?.moveDurationMs).toBeLessThan(previousSegment.moveDurationMs)
  })

  it('finds the latest observed logical event through a physical facility and does not jump to future events', () => {
    const scene = getAdvancedChapterScene(2)
    const run = chapter2Run('random-key-per-record')

    expect(nodeIdsForFacility(scene, 'partition-p1')).toEqual(['partition-p0', 'partition-p1', 'partition-p2'])
    expect(inspectFacilityAtCursor({
      cursor: 0,
      events: run.events,
      facilityOrNodeId: 'partition-p1',
      scene,
    }).latestEventIndex).toBe(-1)
    const inspection = inspectFacilityAtCursor({
      cursor: run.events.length - 1,
      events: run.events,
      facilityOrNodeId: 'partition-p1',
      scene,
    })
    expect(inspection.latestEventIndex).toBeGreaterThanOrEqual(0)
    expect(inspection.latestNodeId).toBe('partition-p0')
  })
})
