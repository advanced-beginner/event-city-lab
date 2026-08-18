import { describe, expect, it } from 'vitest'

import { runChapterRule, validateChapterRule } from '../chapterSimulation'
import { chapter7Rule } from './chapter7'

describe('Chapter 7 retry and DLT rules', () => {
  it('defines three valid guided experiments with failure and recommended success choices', () => {
    expect(() => validateChapterRule(chapter7Rule)).not.toThrow()
    expect(chapter7Rule.experiments).toHaveLength(3)

    for (const experiment of chapter7Rule.experiments) {
      expect(experiment.choices.length).toBeGreaterThanOrEqual(2)
      expect(experiment.choices.some((choice) => choice.outcome.status === 'failed')).toBe(true)
      expect(experiment.choices.find((choice) => choice.id === experiment.recommendedChoiceId)?.outcome.status).toBe('succeeded')
      expect(experiment.choices.every((choice) => (choice.outcome.diagnosis?.evidence.length ?? 0) > 0)).toBe(true)
    }
  })

  it('produces deterministic staged retry events for the same input', () => {
    const input = { runId: 'chapter7-run', seed: 71, chapterId: 7 as const, experimentId: 'staged-backoff', choiceId: 'application-publishes-retry-topics' }
    expect(runChapterRule(chapter7Rule, input)).toEqual(runChapterRule(chapter7Rule, input))
  })

  it('states that retry topics and DLT are application or framework patterns', () => {
    const missingRetry = runChapterRule(chapter7Rule, {
      runId: 'retry', seed: 1, chapterId: 7, experimentId: 'staged-backoff', choiceId: 'assume-broker-auto-retry-topics',
    })
    const dlt = runChapterRule(chapter7Rule, {
      runId: 'dlt', seed: 2, chapterId: 7, experimentId: 'dead-letter-evidence', choiceId: 'publish-dlt-with-context',
    })
    const blocking = runChapterRule(chapter7Rule, {
      runId: 'blocking', seed: 3, chapterId: 7, experimentId: 'blocking-retry', choiceId: 'retry-in-place-unbounded',
    })

    expect(missingRetry.diagnosis?.rootCause).toContain('애플리케이션 또는 프레임워크 패턴')
    expect(dlt.events.some((entry) => entry.log.includes('pattern=application-dlt'))).toBe(true)
    expect(blocking.diagnosis?.tradeOff).toContain('partition')
  })
})

