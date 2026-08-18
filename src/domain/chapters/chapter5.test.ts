import { describe, expect, it } from 'vitest'

import { runChapterRule, validateChapterRule } from '../chapterSimulation'
import { chapter5Rule } from './chapter5'

describe('chapter5Rule', () => {
  it('defines three valid guided experiments with observable failure and recommended success', () => {
    expect(() => validateChapterRule(chapter5Rule)).not.toThrow()

    for (const experiment of chapter5Rule.experiments) {
      expect(experiment.choices.length).toBeGreaterThanOrEqual(2)
      expect(experiment.choices.some((choice) => choice.outcome.status === 'failed')).toBe(true)
      expect(
        experiment.choices.find((choice) => choice.id === experiment.recommendedChoiceId)?.outcome.status,
      ).toBe('succeeded')
    }
  })

  it('replays deterministically with the same input', () => {
    const input = {
      runId: 'chapter-5-stable',
      seed: 431,
      chapterId: 5 as const,
      experimentId: 'late-commit-replay',
      choiceId: 'idempotent-replay-then-commit',
    }

    expect(runChapterRule(chapter5Rule, input)).toEqual(runChapterRule(chapter5Rule, input))
  })

  it('keeps poll position, processed state, and committed offset distinct', () => {
    const failed = runChapterRule(chapter5Rule, {
      runId: 'chapter-5-poll-failure',
      seed: 431,
      chapterId: 5,
      experimentId: 'poll-versus-process',
      choiceId: 'treat-poll-as-complete',
    })
    const succeeded = runChapterRule(chapter5Rule, {
      runId: 'chapter-5-poll-success',
      seed: 431,
      chapterId: 5,
      experimentId: 'poll-versus-process',
      choiceId: 'process-then-commit',
    })

    expect(failed.status).toBe('failed')
    expect(failed.events.at(-1)?.log).toBe('position=41 processed=none committed=40')
    expect(failed.diagnosis?.evidence).toContain('consumer.position=41')
    expect(succeeded.status).toBe('succeeded')
    expect(succeeded.events.at(-1)?.log).toContain('meaning=next-record-to-read')
  })

  it('shows early commit skipping unprocessed work and repairs the commit boundary', () => {
    const failed = runChapterRule(chapter5Rule, {
      runId: 'chapter-5-early-failure',
      seed: 431,
      chapterId: 5,
      experimentId: 'early-commit-loss',
      choiceId: 'commit-before-processing',
    })
    const succeeded = runChapterRule(chapter5Rule, {
      runId: 'chapter-5-early-success',
      seed: 431,
      chapterId: 5,
      experimentId: 'early-commit-loss',
      choiceId: 'commit-after-processing',
    })

    expect(failed.status).toBe('failed')
    expect(failed.events.at(-1)?.log).toContain('skipped.offset=50')
    expect(failed.diagnosis?.tradeOff).toContain('영구히 건너뛸 위험')
    expect(succeeded.status).toBe('succeeded')
    expect(succeeded.events.at(-1)?.log).toBe('commit.offset=51 after=processed.offset:50')
  })

  it('models late commit replay and prevents a duplicate effect with idempotent processing', () => {
    const failed = runChapterRule(chapter5Rule, {
      runId: 'chapter-5-late-failure',
      seed: 431,
      chapterId: 5,
      experimentId: 'late-commit-replay',
      choiceId: 'assume-no-replay-after-processing',
    })
    const succeeded = runChapterRule(chapter5Rule, {
      runId: 'chapter-5-late-success',
      seed: 431,
      chapterId: 5,
      experimentId: 'late-commit-replay',
      choiceId: 'idempotent-replay-then-commit',
    })

    expect(failed.status).toBe('failed')
    expect(failed.events.at(-1)?.log).toContain('duplicate=true')
    expect(failed.diagnosis?.rootCause).toContain('원자적이지 않은데')
    expect(succeeded.status).toBe('succeeded')
    expect(succeeded.events.some((event) => event.log.includes('already-processed=true'))).toBe(true)
    expect(succeeded.events.at(-1)?.log).toContain('commit.offset=71')
  })
})
