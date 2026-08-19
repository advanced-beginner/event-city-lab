import { describe, expect, it } from 'vitest'

import { getAdvancedChapterScene } from '../chapterScenes'
import { validateChapterCityCue } from '../validation'
import { runChapterRule, type ChapterRuleModule, type ChapterSimulationRun } from '../../domain/chapterSimulation'
import { chapter6Rule } from '../../domain/chapters/chapter6'
import { chapter7Rule } from '../../domain/chapters/chapter7'
import { chapter8Rule } from '../../domain/chapters/chapter8'
import { buildChapter68CityCue } from './chapter6_8'

const RULES = [chapter6Rule, chapter7Rule, chapter8Rule] as const

describe('buildChapter68CityCue', () => {
  it('builds a valid focused city cue for every event in every outcome of Chapters 6-8', () => {
    const experimentIds = new Set<string>()

    for (const { rule, run } of allRuns()) {
      const scene = getAdvancedChapterScene(rule.chapterId)
      experimentIds.add(run.experimentId)

      run.events.forEach((event, sequence) => {
        const cue = buildChapter68CityCue({
          chapterId: rule.chapterId,
          experimentId: run.experimentId,
          choiceId: run.choiceId,
          outcomeStatus: run.status,
          event,
          sequence,
          eventCount: run.events.length,
        })

        expect(() => validateChapterCityCue(scene, cue)).not.toThrow()
        const primaryFocusNodeId = cue.focusNodeIds[0]
        expect(cue.focusNodeIds.length, `${run.experimentId}/${run.choiceId}/${sequence}`).toBeGreaterThan(0)
        expect(primaryFocusNodeId, `${run.experimentId}/${run.choiceId}/${sequence}`).toBeDefined()
        expect(cue.nodeChanges?.[primaryFocusNodeId!], `${run.experimentId}/${run.choiceId}/${sequence}`).toBeDefined()
      })
    }

    expect(experimentIds).toEqual(new Set([
      'assignment-capacity',
      'join-leave-rebalance',
      'poll-timeout',
      'blocking-retry',
      'staged-backoff',
      'dead-letter-evidence',
      'partial-transform',
      'transactional-repair',
      'isolation-visibility',
    ]))
  })

  it('marks every failed terminal event with a closed barrier, failed node, and failed route while reserving carriers for record paths', () => {
    const failedRuns = allRuns().filter(({ run }) => run.status === 'failed')

    for (const { rule, run } of failedRuns) {
      const event = run.events.at(-1)
      expect(event).toBeDefined()
      const cue = buildChapter68CityCue({
        chapterId: rule.chapterId,
        experimentId: run.experimentId,
        choiceId: run.choiceId,
        outcomeStatus: run.status,
        event: event!,
        sequence: run.events.length - 1,
        eventCount: run.events.length,
      })
      const barrierRouteId = cue.barrier?.routeId
      const failedCarrier = Object.values(cue.carrierChanges ?? {}).find((carrier) => carrier?.state === 'failed')
      const barrierRoute = getAdvancedChapterScene(rule.chapterId).routes.find((route) => route.id === barrierRouteId)

      expect(cue.barrier?.state, run.choiceId).toBe('closed')
      expect(cue.barrier?.nodeId, run.choiceId).toBeTruthy()
      expect(barrierRouteId, run.choiceId).toBeTruthy()
      expect(cue.nodeChanges?.[cue.barrier!.nodeId!]?.state, run.choiceId).toBe('failed')
      expect(cue.routeChanges?.[barrierRouteId!]?.state, run.choiceId).toBe('failed')
      expect(cue.routeChanges?.[barrierRouteId!]?.disabled, run.choiceId).toBe(true)
      expect(barrierRoute, run.choiceId).toBeDefined()

      if (barrierRoute?.kind === 'data' || barrierRoute?.kind === 'retry') {
        expect(failedCarrier?.kind, run.choiceId).toBe('ghost-record')
      } else {
        expect(failedCarrier, run.choiceId).toBeUndefined()
      }
    }
  })

  it('shows Chapter 6 assignment, revocation, and idle owner states', () => {
    const capacityFailure = cueAt(chapter6Rule, 'assignment-capacity', 'add-consumers-only', 2)
    expect(capacityFailure.focusNodeIds).toEqual(['consumer-c4', 'consumer-c5'])
    expect(capacityFailure.nodeChanges?.['consumer-c4']).toMatchObject({ state: 'idle', badge: 'idle' })
    expect(capacityFailure.nodeChanges?.['consumer-c5']).toMatchObject({ state: 'idle', badge: 'idle' })

    const capacitySuccess = terminalCue(chapter6Rule, 'assignment-capacity', 'match-parallelism-to-partitions')
    expect(capacitySuccess.signal).toMatchObject({ kind: 'assignment', fromNodeId: 'coordinator', state: 'complete' })
    expect(capacitySuccess.nodeChanges?.['consumer-c1']).toMatchObject({ state: 'complete', badge: 'p0' })
    expect(capacitySuccess.nodeChanges?.['consumer-c2']).toMatchObject({ state: 'complete', badge: 'p1' })
    expect(capacitySuccess.nodeChanges?.['consumer-c3']).toMatchObject({ state: 'complete', badge: 'p2' })

    const revocation = cueAt(chapter6Rule, 'join-leave-rebalance', 'handle-revocation-and-assignment', 2)
    expect(revocation.signal).toMatchObject({ kind: 'revocation', fromNodeId: 'coordinator', toNodeId: 'consumer-c1' })
    expect(revocation.nodeChanges?.['consumer-c1']).toMatchObject({ state: 'muted', badge: 'revoked' })

    const handoff = terminalCue(chapter6Rule, 'join-leave-rebalance', 'handle-revocation-and-assignment')
    expect(handoff.signal).toMatchObject({ kind: 'assignment', toNodeId: 'consumer-c2', state: 'complete' })
    expect(handoff.nodeChanges?.['partition-p1']).toMatchObject({ state: 'complete', badge: 'c2' })
  })

  it('shows Chapter 7 retry loops, retry topics, DLT routing, and manifest carriers', () => {
    const blocking = cueAt(chapter7Rule, 'blocking-retry', 'retry-in-place-unbounded', 2)
    expect(blocking.nodeChanges?.['retry-loop']).toMatchObject({ state: 'blocked', badge: 'loop' })
    expect(blocking.routeChanges?.['application-retry-loop']).toMatchObject({ state: 'blocked' })

    const retry1m = cueAt(chapter7Rule, 'staged-backoff', 'application-publishes-retry-topics', 2)
    expect(retry1m.nodeChanges?.['retry-1m']).toMatchObject({ state: 'active', badge: '1m' })
    expect(retry1m.carrierChanges?.retry).toMatchObject({ kind: 'retry-record', routeId: 'application-retry-1m' })

    const retry10m = cueAt(chapter7Rule, 'staged-backoff', 'application-publishes-retry-topics', 4)
    expect(retry10m.nodeChanges?.['retry-10m']).toMatchObject({ state: 'active', badge: '10m' })
    expect(retry10m.routeChanges?.['retry-1m-retry-10m']).toMatchObject({ state: 'active' })

    const dlt = cueAt(chapter7Rule, 'dead-letter-evidence', 'publish-dlt-with-context', 2)
    expect(dlt.nodeChanges?.dlt).toMatchObject({ state: 'active', badge: 'manifest' })
    expect(dlt.carrierChanges?.manifest).toMatchObject({ kind: 'retry-record', routeId: 'application-dlt', label: 'DLT manifest' })

    const terminal = terminalCue(chapter7Rule, 'dead-letter-evidence', 'publish-dlt-with-context')
    expect(terminal.signal).toMatchObject({ kind: 'commit', fromNodeId: 'offset-store', toNodeId: 'consumer-c1' })
  })

  it('shows Chapter 8 transaction boundaries, offsets, LSO, abort, commit, and tx-commit signals', () => {
    const offsetBoundary = cueAt(chapter8Rule, 'partial-transform', 'use-atomic-transform-boundary', 3)
    expect(offsetBoundary.nodeChanges?.['offset-store']).toMatchObject({ state: 'active', badge: 'offset' })
    expect(offsetBoundary.carrierChanges?.offset).toMatchObject({ kind: 'offset-ticket', routeId: 'application-offset' })

    const abortedAttempt = cueAt(chapter8Rule, 'transactional-repair', 'send-offsets-then-commit', 4)
    expect(abortedAttempt.signal).toMatchObject({ kind: 'tx-abort', fromNodeId: 'transaction-coordinator', toNodeId: 'application' })
    expect(abortedAttempt.nodeChanges?.['transaction-coordinator']).toMatchObject({ state: 'blocked', badge: 'tx' })

    const lsoBoundary = cueAt(chapter8Rule, 'isolation-visibility', 'read-committed-to-lso', 2)
    expect(lsoBoundary.barrier).toMatchObject({
      state: 'closed',
      nodeId: 'offset-store',
      routeId: 'transaction-offset',
      label: 'Last Stable Offset boundary',
    })
    expect(lsoBoundary.nodeChanges?.['offset-store']).toMatchObject({ state: 'blocked', badge: 'LSO' })

    const committed = terminalCue(chapter8Rule, 'transactional-repair', 'send-offsets-then-commit')
    expect(committed.signal).toMatchObject({ kind: 'tx-commit', fromNodeId: 'transaction-coordinator', toNodeId: 'offset-store' })
    expect(committed.nodeChanges?.['transaction-coordinator']).toMatchObject({ state: 'complete', badge: 'tx' })

    const readUncommittedFailure = terminalCue(chapter8Rule, 'isolation-visibility', 'read-uncommitted-results')
    expect(readUncommittedFailure.signal).toMatchObject({ kind: 'tx-abort', state: 'failed' })
    expect(readUncommittedFailure.nodeChanges?.application).toMatchObject({ state: 'failed' })
  })

  it('does not derive routing from event detail or log text', () => {
    const run = runFor(chapter8Rule, 'isolation-visibility', 'read-committed-to-lso')
    const event = run.events[2]
    expect(event).toBeDefined()
    if (!event) throw new Error('Expected read_committed LSO event at sequence 2')
    const baseline = buildChapter68CityCue({
      chapterId: 8,
      experimentId: run.experimentId,
      choiceId: run.choiceId,
      outcomeStatus: run.status,
      event,
      sequence: 2,
      eventCount: run.events.length,
    })
    const perturbed = buildChapter68CityCue({
      chapterId: 8,
      experimentId: run.experimentId,
      choiceId: run.choiceId,
      outcomeStatus: run.status,
      event: { ...event, detail: 'unrelated detail', log: 'unrelated log' },
      sequence: 2,
      eventCount: run.events.length,
    })

    expect(perturbed).toEqual(baseline)
  })
})

function terminalCue(rule: ChapterRuleModule, experimentId: string, choiceId: string) {
  const run = runFor(rule, experimentId, choiceId)
  return cueAt(rule, experimentId, choiceId, run.events.length - 1)
}

function cueAt(rule: ChapterRuleModule, experimentId: string, choiceId: string, sequence: number) {
  const run = runFor(rule, experimentId, choiceId)
  const event = run.events[sequence]
  expect(event).toBeDefined()
  if (!event) throw new Error(`Expected event ${sequence} for ${experimentId}/${choiceId}`)
  return buildChapter68CityCue({
    chapterId: rule.chapterId,
    experimentId,
    choiceId,
    outcomeStatus: run.status,
    event,
    sequence,
    eventCount: run.events.length,
  })
}

function runFor(rule: ChapterRuleModule, experimentId: string, choiceId: string): ChapterSimulationRun {
  return runChapterRule(rule, {
    runId: `${rule.chapterId}-${experimentId}-${choiceId}`,
    seed: 1,
    chapterId: rule.chapterId,
    experimentId,
    choiceId,
  })
}

function allRuns(): Array<{ rule: ChapterRuleModule, run: ChapterSimulationRun }> {
  return RULES.flatMap((rule) =>
    rule.experiments.flatMap((experiment) =>
      experiment.choices.map((choice) => ({
        rule,
        run: runFor(rule, experiment.id, choice.id),
      })),
    ),
  )
}
