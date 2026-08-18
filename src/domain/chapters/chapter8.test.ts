import { describe, expect, it } from 'vitest'

import { runChapterRule, validateChapterRule } from '../chapterSimulation'
import { chapter8Rule } from './chapter8'

describe('Chapter 8 transaction rules', () => {
  it('defines three valid guided experiments with failure and recommended success choices', () => {
    expect(() => validateChapterRule(chapter8Rule)).not.toThrow()
    expect(chapter8Rule.experiments).toHaveLength(3)

    for (const experiment of chapter8Rule.experiments) {
      expect(experiment.choices.length).toBeGreaterThanOrEqual(2)
      expect(experiment.choices.some((choice) => choice.outcome.status === 'failed')).toBe(true)
      expect(experiment.choices.find((choice) => choice.id === experiment.recommendedChoiceId)?.outcome.status).toBe('succeeded')
      expect(experiment.choices.every((choice) => (choice.outcome.diagnosis?.tradeOff.length ?? 0) > 0)).toBe(true)
    }
  })

  it('produces deterministic transactional repair events for the same input', () => {
    const input = { runId: 'chapter8-run', seed: 81, chapterId: 8 as const, experimentId: 'transactional-repair', choiceId: 'send-offsets-then-commit' }
    expect(runChapterRule(chapter8Rule, input)).toEqual(runChapterRule(chapter8Rule, input))
  })

  it('models transactional id, offset enlistment, abort/commit, and read committed LSO visibility', () => {
    const repaired = runChapterRule(chapter8Rule, {
      runId: 'repair', seed: 1, chapterId: 8, experimentId: 'transactional-repair', choiceId: 'send-offsets-then-commit',
    })
    const isolated = runChapterRule(chapter8Rule, {
      runId: 'isolation', seed: 2, chapterId: 8, experimentId: 'isolation-visibility', choiceId: 'read-committed-to-lso',
    })

    const repairLogs = repaired.events.map((entry) => entry.log).join('\n')
    expect(repairLogs).toContain('transactional.id=payments-transformer-0')
    expect(repairLogs).toContain('sendOffsetsToTransaction')
    expect(repairLogs).toContain('abortTransaction')
    expect(repairLogs).toContain('commitTransaction')
    expect(isolated.diagnosis?.rootCause).toContain('LSO')
    expect(isolated.events.some((entry) => entry.log.includes('aborted-offsets=90,91 excluded=true'))).toBe(true)
  })
})

