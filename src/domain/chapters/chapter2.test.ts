import { describe, expect, it } from 'vitest'

import { validateChapterRule } from '../chapterSimulation'
import { chapter2Rule, runChapter2Rule } from './chapter2'

describe('Chapter 2 partition and ordering rules', () => {
  it('defines three valid guided experiments with a failure and recommended success', () => {
    expect(() => validateChapterRule(chapter2Rule)).not.toThrow()
    expect(chapter2Rule.experiments).toHaveLength(3)

    for (const experiment of chapter2Rule.experiments) {
      expect(experiment.choices.length).toBeGreaterThanOrEqual(2)
      expect(experiment.choices.some((choice) => choice.outcome.status === 'failed')).toBe(true)
      expect(
        experiment.choices.find((choice) => choice.id === experiment.recommendedChoiceId)?.outcome.status,
      ).toBe('succeeded')
      expect(experiment.choices.every((choice) => choice.outcome.events.length >= 4)).toBe(true)
    }
  })

  it('replays the same key experiment deterministically for identical input', () => {
    const input = {
      runId: 'chapter-2-stable',
      seed: 2402,
      chapterId: 2 as const,
      experimentId: 'same-key-same-partition',
      choiceId: 'stable-customer-key',
    }

    expect(runChapter2Rule(input)).toEqual(runChapter2Rule(input))
  })

  it('diagnoses an unstable key and repairs it with partition-local offsets', () => {
    const failed = runChapter2Rule({
      runId: 'chapter-2-failed',
      seed: 2402,
      chapterId: 2,
      experimentId: 'same-key-same-partition',
      choiceId: 'random-key-per-record',
    })
    const succeeded = runChapter2Rule({
      runId: 'chapter-2-succeeded',
      seed: 2402,
      chapterId: 2,
      experimentId: 'same-key-same-partition',
      choiceId: 'stable-customer-key',
    })

    expect(failed.status).toBe('failed')
    expect(failed.diagnosis?.rootCause).toContain('레코드마다 다른 key')
    expect(failed.diagnosis?.tradeOff).toContain('partition 편향')
    expect(failed.events.some((event) => event.log.includes('p0@18, p2@7, p1@31'))).toBe(true)

    expect(succeeded.status).toBe('succeeded')
    expect(succeeded.diagnosis).toBeNull()
    expect(succeeded.events.some((event) => event.log.includes('p1 offsets=[31,32,33]'))).toBe(true)
    expect(succeeded.events.at(-1)?.detail).toContain('topic-partition')
  })

  it('rejects global offset ordering while preserving independent partition timelines', () => {
    const failed = runChapter2Rule({
      runId: 'chapter-2-global-order',
      seed: 2402,
      chapterId: 2,
      experimentId: 'cross-partition-order',
      choiceId: 'sort-offsets-globally',
    })
    const succeeded = runChapter2Rule({
      runId: 'chapter-2-local-order',
      seed: 2402,
      chapterId: 2,
      experimentId: 'cross-partition-order',
      choiceId: 'partition-local-timeline',
    })

    expect(failed.diagnosis?.evidence).toContain('offset identity에는 partition이 포함됨')
    expect(failed.diagnosis?.tradeOff).toContain('단일 partition')
    expect(succeeded.events.some((event) => event.log.includes('p0:103<104; p1:86<87'))).toBe(true)
    expect(succeeded.summary).toContain('partition별 ordering')
  })
})
