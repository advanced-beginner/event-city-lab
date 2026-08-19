import { describe, expect, it } from 'vitest'

import { getAdvancedChapterScene } from '../chapterScenes'
import { validateChapterCityCue } from '../validation'
import { runChapterRule } from '../../domain/chapterSimulation'
import { chapter4Rule } from '../../domain/chapters/chapter4'
import { chapter5Rule } from '../../domain/chapters/chapter5'
import { buildChapter45CityCue } from './chapter4_5'
import type { CityCueContext } from './types'

const rules = [chapter4Rule, chapter5Rule] as const

describe('buildChapter45CityCue', () => {
  it('validates every event cue for every Chapter 4 and 5 experiment outcome', () => {
    for (const rule of rules) {
      const scene = getAdvancedChapterScene(rule.chapterId)

      for (const experiment of rule.experiments) {
        for (const choice of experiment.choices) {
          const run = runChapterRule(rule, {
            runId: `${experiment.id}:${choice.id}`,
            seed: 1,
            chapterId: rule.chapterId,
            experimentId: experiment.id,
            choiceId: choice.id,
          })

          for (const event of run.events) {
            const cue = buildChapter45CityCue(contextFor(run, event.sequence))

            expect(cue.focusNodeIds.length, `${experiment.id}/${choice.id}/${event.sequence}`).toBeGreaterThan(0)
            expect(() => validateChapterCityCue(scene, cue)).not.toThrow()
          }
        }
      }
    }
  })

  it('closes a failed terminal barrier and marks a failed route and node', () => {
    for (const rule of rules) {
      for (const experiment of rule.experiments) {
        const failedChoice = experiment.choices.find((choice) => choice.outcome.status === 'failed')
        expect(failedChoice).toBeDefined()

        const run = runChapterRule(rule, {
          runId: `${experiment.id}:failed`,
          seed: 1,
          chapterId: rule.chapterId,
          experimentId: experiment.id,
          choiceId: failedChoice!.id,
        })
        const cue = buildChapter45CityCue(contextFor(run, run.events.length - 1))

        expect(cue.barrier?.state, experiment.id).toBe('closed')
        expect(Object.values(cue.nodeChanges ?? {}).some((change) => change.state === 'failed'), experiment.id).toBe(true)
        expect(Object.values(cue.routeChanges ?? {}).some((change) => change.state === 'failed'), experiment.id).toBe(true)
      }
    }
  })

  it('uses explicit ACK signals for Chapter 4 successes and commit signals for Chapter 5 successes', () => {
    for (const rule of rules) {
      for (const experiment of rule.experiments) {
        const choice = experiment.choices.find((candidate) => candidate.id === experiment.recommendedChoiceId)
        expect(choice).toBeDefined()

        const run = runChapterRule(rule, {
          runId: `${experiment.id}:succeeded`,
          seed: 1,
          chapterId: rule.chapterId,
          experimentId: experiment.id,
          choiceId: choice!.id,
        })
        const cue = buildChapter45CityCue(contextFor(run, run.events.length - 1))

        expect(cue.signal?.state, experiment.id).toBe('complete')
        expect(cue.signal?.kind, experiment.id).toBe(rule.chapterId === 4 ? 'ack' : 'commit')
      }
    }
  })

  it('represents late commit replay with ghost records', () => {
    const run = runChapterRule(chapter5Rule, {
      runId: 'late-replay',
      seed: 1,
      chapterId: 5,
      experimentId: 'late-commit-replay',
      choiceId: 'idempotent-replay-then-commit',
    })

    const cue = buildChapter45CityCue(contextFor(run, 0))

    expect(cue.carrierChanges?.record?.kind).toBe('ghost-record')
    expect(cue.focusNodeIds).toContain('consumer-c1')
  })

  it('returns metadata for the elected leader before the repaired retry', () => {
    const run = runChapterRule(chapter4Rule, {
      runId: 'leader-failover-metadata',
      seed: 1,
      chapterId: 4,
      experimentId: 'leader-failover',
      choiceId: 'wait-for-isr-leader-and-retry',
    })

    expect(buildChapter45CityCue(contextFor(run, 1)).signal).toMatchObject({
      kind: 'metadata',
      fromNodeId: 'broker-follower-1',
      toNodeId: 'producer',
    })
    expect(buildChapter45CityCue(contextFor(run, run.events.length - 1)).signal?.kind).toBe('ack')
  })
})

function contextFor(
  run: ReturnType<typeof runChapterRule>,
  sequence: number,
): CityCueContext {
  return {
    chapterId: run.chapterId,
    experimentId: run.experimentId,
    choiceId: run.choiceId,
    outcomeStatus: run.status,
    event: run.events[sequence]!,
    sequence,
    eventCount: run.events.length,
  }
}
