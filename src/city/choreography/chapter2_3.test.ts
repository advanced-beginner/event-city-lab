import { describe, expect, it } from 'vitest'

import { chapter2Rule } from '../../domain/chapters/chapter2'
import { chapter3Rule } from '../../domain/chapters/chapter3'
import { getAdvancedChapterScene } from '../chapterScenes'
import { validateChapterCityCue } from '../validation'
import { buildChapter23CityCue } from './chapter2_3'
import type { CityCueContext } from './types'

describe('Chapter 2 and 3 city choreography', () => {
  it('builds valid city cues for every outcome event in every experiment', () => {
    for (const rule of [chapter2Rule, chapter3Rule]) {
      const scene = getAdvancedChapterScene(rule.chapterId)

      for (const experiment of rule.experiments) {
        for (const choice of experiment.choices) {
          choice.outcome.events.forEach((event, sequence) => {
            const context: CityCueContext = {
              chapterId: rule.chapterId,
              experimentId: experiment.id,
              choiceId: choice.id,
              outcomeStatus: choice.outcome.status,
              event,
              sequence,
              eventCount: choice.outcome.events.length,
            }

            const cue = buildChapter23CityCue(context)

            expect(cue.focusNodeIds.length, `${rule.chapterId}/${experiment.id}/${choice.id}/${sequence}`).toBeGreaterThan(0)
            expect(() => validateChapterCityCue(scene, cue)).not.toThrow()
          })
        }
      }
    }
  })

  it('closes a failed barrier and leaves a ghost carrier on failed terminal events', () => {
    for (const rule of [chapter2Rule, chapter3Rule]) {
      for (const experiment of rule.experiments) {
        for (const choice of experiment.choices.filter((candidate) => candidate.outcome.status === 'failed')) {
          const sequence = choice.outcome.events.length - 1
          const event = choice.outcome.events[sequence]
          expect(event?.kind).toBe('experiment.failed')

          const cue = buildChapter23CityCue({
            chapterId: rule.chapterId,
            experimentId: experiment.id,
            choiceId: choice.id,
            outcomeStatus: choice.outcome.status,
            event: event!,
            sequence,
            eventCount: choice.outcome.events.length,
          })

          expect(cue.barrier?.state).toBe('closed')
          expect(cue.signal).toBeNull()
          expect(Object.values(cue.carrierChanges ?? {}).some((change) => change?.kind === 'ghost-record')).toBe(true)
        }
      }
    }
  })

  it('emits a complete signal and endpoint on successful terminal events', () => {
    for (const rule of [chapter2Rule, chapter3Rule]) {
      for (const experiment of rule.experiments) {
        for (const choice of experiment.choices.filter((candidate) => candidate.outcome.status === 'succeeded')) {
          const sequence = choice.outcome.events.length - 1
          const event = choice.outcome.events[sequence]
          expect(event?.kind).toBe('experiment.succeeded')

          const cue = buildChapter23CityCue({
            chapterId: rule.chapterId,
            experimentId: experiment.id,
            choiceId: choice.id,
            outcomeStatus: choice.outcome.status,
            event: event!,
            sequence,
            eventCount: choice.outcome.events.length,
          })

          expect(cue.signal).toMatchObject({ state: 'complete' })
          expect(cue.barrier).toMatchObject({ state: 'open' })
          expect(Object.values(cue.carrierChanges ?? {}).some((change) => change?.progress === 1)).toBe(true)
        }
      }
    }
  })

  it('moves dispatch carriers over exact scene routes and checkpoints', () => {
    for (const rule of [chapter2Rule, chapter3Rule]) {
      const scene = getAdvancedChapterScene(rule.chapterId)
      const routeIds = new Set(scene.routes.map((route) => route.id))
      const checkpointIdsByRouteId = new Map(
        scene.routes.map((route) => [route.id, new Set(route.checkpoints.map((checkpoint) => checkpoint.id))]),
      )

      for (const experiment of rule.experiments) {
        for (const choice of experiment.choices) {
          choice.outcome.events.forEach((event, sequence) => {
            if (event.kind !== 'record.dispatched') return

            const cue = buildChapter23CityCue({
              chapterId: rule.chapterId,
              experimentId: experiment.id,
              choiceId: choice.id,
              outcomeStatus: choice.outcome.status,
              event,
              sequence,
              eventCount: choice.outcome.events.length,
            })

            const carriers = Object.values(cue.carrierChanges ?? {}).filter((change) => change !== null)
            expect(carriers.length, `${rule.chapterId}/${experiment.id}/${choice.id}`).toBeGreaterThan(0)
            for (const carrier of carriers) {
              expect(routeIds.has(carrier.routeId)).toBe(true)
              expect(checkpointIdsByRouteId.get(carrier.routeId)?.has(carrier.checkpointId ?? '')).toBe(true)
            }
          })
        }
      }
    }
  })

  it('returns partition-specific offset receipts after a successful Chapter 2 run', () => {
    const experiment = chapter2Rule.experiments[0]!
    const choice = experiment.choices.find((candidate) => candidate.id === experiment.recommendedChoiceId)!
    const sequence = choice.outcome.events.length - 1
    const cue = buildChapter23CityCue({
      chapterId: 2,
      experimentId: experiment.id,
      choiceId: choice.id,
      outcomeStatus: choice.outcome.status,
      event: choice.outcome.events[sequence]!,
      sequence,
      eventCount: choice.outcome.events.length,
    })

    expect(Object.values(cue.carrierChanges ?? {})).toEqual([
      expect.objectContaining({ kind: 'offset-ticket', label: expect.stringContaining('partition-p1') }),
    ])
  })
})
