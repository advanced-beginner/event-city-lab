import { describe, expect, it } from 'vitest'

import { runChapterRule, validateChapterRule } from '../chapterSimulation'
import { chapter4Rule } from './chapter4'

describe('chapter4Rule', () => {
  it('defines three valid guided experiments with observable failure and recommended success', () => {
    expect(() => validateChapterRule(chapter4Rule)).not.toThrow()

    for (const experiment of chapter4Rule.experiments) {
      expect(experiment.choices.length).toBeGreaterThanOrEqual(2)
      expect(experiment.choices.some((choice) => choice.outcome.status === 'failed')).toBe(true)
      expect(
        experiment.choices.find((choice) => choice.id === experiment.recommendedChoiceId)?.outcome.status,
      ).toBe('succeeded')
    }
  })

  it('replays deterministically with the same input', () => {
    const input = {
      runId: 'chapter-4-stable',
      seed: 431,
      chapterId: 4 as const,
      experimentId: 'leader-failover',
      choiceId: 'wait-for-isr-leader-and-retry',
    }

    expect(runChapterRule(chapter4Rule, input)).toEqual(runChapterRule(chapter4Rule, input))
  })

  it('distinguishes replica count from the current ISR', () => {
    const failed = runChapterRule(chapter4Rule, {
      runId: 'chapter-4-replica-failure',
      seed: 431,
      chapterId: 4,
      experimentId: 'replica-lag',
      choiceId: 'trust-replication-factor',
    })
    const succeeded = runChapterRule(chapter4Rule, {
      runId: 'chapter-4-replica-success',
      seed: 431,
      chapterId: 4,
      experimentId: 'replica-lag',
      choiceId: 'inspect-current-isr',
    })

    expect(failed.status).toBe('failed')
    expect(failed.diagnosis?.evidence).toContain('isr=[1,2]')
    expect(failed.diagnosis?.tradeOff).toContain('장애 허용 여유')
    expect(succeeded.status).toBe('succeeded')
    expect(succeeded.events.some((event) => event.log.includes('out.of.sync=[3]'))).toBe(true)
  })

  it('rejects acks=all when ISR is below min.insync.replicas and succeeds after recovery', () => {
    const failed = runChapterRule(chapter4Rule, {
      runId: 'chapter-4-min-isr-failure',
      seed: 431,
      chapterId: 4,
      experimentId: 'min-isr-write-failure',
      choiceId: 'write-with-one-isr',
    })
    const succeeded = runChapterRule(chapter4Rule, {
      runId: 'chapter-4-min-isr-success',
      seed: 431,
      chapterId: 4,
      experimentId: 'min-isr-write-failure',
      choiceId: 'restore-isr-before-write',
    })

    expect(failed.status).toBe('failed')
    expect(failed.events.at(-1)?.log).toContain('NotEnoughReplicas')
    expect(failed.diagnosis?.rootCause).toContain('min.insync.replicas')
    expect(succeeded.status).toBe('succeeded')
    expect(succeeded.events.at(-1)?.log).toContain('acked-by=[1,2]')
  })

  it('requires a new ISR leader and refreshed metadata before failover retry succeeds', () => {
    const failed = runChapterRule(chapter4Rule, {
      runId: 'chapter-4-failover-failure',
      seed: 431,
      chapterId: 4,
      experimentId: 'leader-failover',
      choiceId: 'retry-before-election',
    })
    const succeeded = runChapterRule(chapter4Rule, {
      runId: 'chapter-4-failover-success',
      seed: 431,
      chapterId: 4,
      experimentId: 'leader-failover',
      choiceId: 'wait-for-isr-leader-and-retry',
    })

    expect(failed.status).toBe('failed')
    expect(failed.events.at(-1)?.log).toContain('NotLeaderOrFollower')
    expect(succeeded.status).toBe('succeeded')
    expect(succeeded.events.map((event) => event.log).join('\n')).toContain('leader=broker-2')
    expect(succeeded.events.at(-1)?.log).toContain('acked-by=[2,3]')
  })
})
