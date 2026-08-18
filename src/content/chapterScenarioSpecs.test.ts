import { describe, expect, it } from 'vitest'

import { chapterScenarioSpecs, getChapterScenarioSpec } from './chapterScenarioSpecs'
import { getKafkaReference, kafkaReferences } from './kafkaReferences'

describe('chapter scenario specifications', () => {
  it('defines Chapters 2 through 8 with three guided experiments each', () => {
    expect(chapterScenarioSpecs.map((scenario) => scenario.chapterId)).toEqual([2, 3, 4, 5, 6, 7, 8])

    for (const scenario of chapterScenarioSpecs) {
      expect(scenario.experiments).toHaveLength(3)
      expect(new Set(scenario.experiments.map((experiment) => experiment.id)).size).toBe(3)
    }
  })

  it('resolves every citation to the Kafka 4.3.1 reference manifest', () => {
    expect(kafkaReferences.length).toBeGreaterThan(0)

    for (const scenario of chapterScenarioSpecs) {
      for (const referenceId of scenario.references) {
        expect(getKafkaReference(referenceId).version).toBe('4.3.1')
      }
    }
  })

  it('looks up a scenario by chapter id', () => {
    expect(getChapterScenarioSpec(8).topic).toContain('transaction')
  })
})
