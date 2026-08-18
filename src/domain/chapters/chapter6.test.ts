import { describe, expect, it } from 'vitest'

import { runChapterRule, validateChapterRule } from '../chapterSimulation'
import { chapter6Rule } from './chapter6'

describe('Chapter 6 consumer group rules', () => {
  it('defines three valid guided experiments with failure and recommended success choices', () => {
    expect(() => validateChapterRule(chapter6Rule)).not.toThrow()
    expect(chapter6Rule.experiments).toHaveLength(3)

    for (const experiment of chapter6Rule.experiments) {
      expect(experiment.choices.length).toBeGreaterThanOrEqual(2)
      expect(experiment.choices.some((choice) => choice.outcome.status === 'failed')).toBe(true)
      expect(experiment.choices.find((choice) => choice.id === experiment.recommendedChoiceId)?.outcome.status).toBe('succeeded')
      expect(experiment.choices.every((choice) => (choice.outcome.diagnosis?.tradeOff.length ?? 0) > 0)).toBe(true)
    }
  })

  it('produces deterministic assignment events for the same input', () => {
    const input = { runId: 'chapter6-run', seed: 61, chapterId: 6 as const, experimentId: 'assignment-capacity', choiceId: 'add-consumers-only' }
    expect(runChapterRule(chapter6Rule, input)).toEqual(runChapterRule(chapter6Rule, input))
  })

  it('models partition capacity, max poll failure, and protocol migration caution', () => {
    const capacity = runChapterRule(chapter6Rule, {
      runId: 'capacity', seed: 1, chapterId: 6, experimentId: 'assignment-capacity', choiceId: 'add-consumers-only',
    })
    const timeout = runChapterRule(chapter6Rule, {
      runId: 'timeout', seed: 2, chapterId: 6, experimentId: 'poll-timeout', choiceId: 'block-poll-past-interval',
    })
    const handoff = runChapterRule(chapter6Rule, {
      runId: 'handoff', seed: 3, chapterId: 6, experimentId: 'join-leave-rebalance', choiceId: 'handle-revocation-and-assignment',
    })

    expect(capacity.diagnosis?.rootCause).toContain('partition 수가 병렬 처리 상한')
    expect(timeout.events.some((entry) => entry.log.includes('max.poll.interval.exceeded'))).toBe(true)
    expect(handoff.diagnosis?.tradeOff).toContain('classic과 consumer group protocol')
  })
})

