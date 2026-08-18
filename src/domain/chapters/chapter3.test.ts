import { describe, expect, it } from 'vitest'

import { validateChapterRule } from '../chapterSimulation'
import { chapter3Rule, runChapter3Rule } from './chapter3'

describe('Chapter 3 producer durability and retry rules', () => {
  it('defines three valid guided experiments with observable failures', () => {
    expect(() => validateChapterRule(chapter3Rule)).not.toThrow()
    expect(chapter3Rule.experiments).toHaveLength(3)

    for (const experiment of chapter3Rule.experiments) {
      expect(experiment.choices.length).toBeGreaterThanOrEqual(2)
      expect(experiment.choices.some((choice) => choice.outcome.status === 'failed')).toBe(true)
      expect(
        experiment.choices.find((choice) => choice.id === experiment.recommendedChoiceId)?.outcome.status,
      ).toBe('succeeded')
      expect(experiment.choices.every((choice) => choice.outcome.events.length >= 4)).toBe(true)
    }
  })

  it('replays an idempotent retry deterministically for identical input', () => {
    const input = {
      runId: 'chapter-3-stable',
      seed: 2403,
      chapterId: 3 as const,
      experimentId: 'retry-duplicate-order',
      choiceId: 'idempotent-bounded-retry',
    }

    expect(runChapter3Rule(input)).toEqual(runChapter3Rule(input))
  })

  it('shows the durability difference between acks=1 and acks=all', () => {
    const leaderOnly = runChapter3Rule({
      runId: 'chapter-3-acks-1',
      seed: 2403,
      chapterId: 3,
      experimentId: 'acks-leader-loss',
      choiceId: 'leader-only-ack',
    })
    const allIsr = runChapter3Rule({
      runId: 'chapter-3-acks-all',
      seed: 2403,
      chapterId: 3,
      experimentId: 'acks-leader-loss',
      choiceId: 'wait-for-isr-acks',
    })

    expect(leaderOnly.status).toBe('failed')
    expect(leaderOnly.events.some((event) => event.log.includes('ACK; new-leader offset=72 absent'))).toBe(true)
    expect(leaderOnly.diagnosis?.tradeOff).toContain('ACK 대기 시간')

    expect(allIsr.status).toBe('succeeded')
    expect(allIsr.events.some((event) => event.log.includes('new-leader contains offset=72'))).toBe(true)
    expect(allIsr.diagnosis).toBeNull()
  })

  it('distinguishes retry time bounds from idempotent duplicate protection', () => {
    const unsafe = runChapter3Rule({
      runId: 'chapter-3-unsafe-retry',
      seed: 2403,
      chapterId: 3,
      experimentId: 'retry-duplicate-order',
      choiceId: 'unbounded-non-idempotent-retry',
    })
    const safe = runChapter3Rule({
      runId: 'chapter-3-safe-retry',
      seed: 2403,
      chapterId: 3,
      experimentId: 'retry-duplicate-order',
      choiceId: 'idempotent-bounded-retry',
    })

    expect(unsafe.events.some((event) => event.log.includes('p0@90=A, p0@91=B, p0@92=A'))).toBe(true)
    expect(unsafe.diagnosis?.rootCause).toContain('idempotence 없이')
    expect(safe.events.some((event) => event.log.includes('pid=7 seq=40 deduplicated'))).toBe(true)
    expect(safe.events.at(-1)?.detail).toContain('delivery timeout')
  })

  it('rejects conflicting idempotence prerequisites and accepts the coherent repair', () => {
    const conflicting = runChapter3Rule({
      runId: 'chapter-3-conflicting',
      seed: 2403,
      chapterId: 3,
      experimentId: 'idempotent-repair',
      choiceId: 'conflicting-idempotent-config',
    })
    const coherent = runChapter3Rule({
      runId: 'chapter-3-coherent',
      seed: 2403,
      chapterId: 3,
      experimentId: 'idempotent-repair',
      choiceId: 'coherent-idempotent-config',
    })

    expect(conflicting.status).toBe('failed')
    expect(conflicting.diagnosis?.evidence).toEqual(
      expect.arrayContaining(['acks=1', 'retries=0', 'max.in.flight=6']),
    )
    expect(conflicting.events.some((event) => event.log.includes('ConfigException'))).toBe(true)

    expect(coherent.status).toBe('succeeded')
    expect(coherent.events.some((event) => event.log.includes('acks=all; retries=MAX; max.in.flight=5'))).toBe(true)
    expect(coherent.events.some((event) => event.log.includes('count(pid=9,seq=12)=1'))).toBe(true)
  })
})
