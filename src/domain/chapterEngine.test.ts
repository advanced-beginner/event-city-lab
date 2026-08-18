import { describe, expect, it } from 'vitest'

import { getChapterRule, simulateChapterExperiment } from './chapterEngine'
import type { AdvancedChapterId } from './chapterSimulation'

const CHAPTER_IDS: AdvancedChapterId[] = [2, 3, 4, 5, 6, 7, 8]

describe('advanced chapter engine', () => {
  it.each(CHAPTER_IDS)('runs all three Chapter %i experiments deterministically', (chapterId) => {
    const rule = getChapterRule(chapterId)

    expect(rule.experiments).toHaveLength(3)
    for (const experiment of rule.experiments) {
      const input = {
        runId: `chapter-${chapterId}-${experiment.id}`,
        seed: chapterId * 100,
        chapterId,
        experimentId: experiment.id,
        choiceId: experiment.recommendedChoiceId,
      }

      const first = simulateChapterExperiment(input)
      const second = simulateChapterExperiment(input)
      expect(second).toEqual(first)
      expect(first.status).toBe('succeeded')
      expect(first.events.at(-1)?.state).toBe('complete')
    }
  })

  it('rejects an experiment that does not belong to the selected chapter', () => {
    expect(() => simulateChapterExperiment({
      runId: 'wrong-experiment',
      seed: 1,
      chapterId: 2,
      experimentId: 'not-registered',
      choiceId: 'not-registered',
    })).toThrow('Unknown Chapter 2 experiment')
  })
})
