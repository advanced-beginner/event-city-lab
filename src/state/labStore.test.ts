import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_LEARNING_PROGRESS } from '../domain/simulation'
import { labStore } from './labStore'

describe('labStore learning progress', () => {
  beforeEach(() => {
    labStore.setState({
      learningProgress: {
        completedExperiments: { ...DEFAULT_LEARNING_PROGRESS.completedExperiments },
        attempts: { ...DEFAULT_LEARNING_PROGRESS.attempts },
      },
    })
  })

  it('counts every attempt but completes an experiment only once', () => {
    const store = labStore.getState()
    store.recordExperimentAttempt(2, 'same-key-same-partition', false)
    store.recordExperimentAttempt(2, 'same-key-same-partition', true)
    store.recordExperimentAttempt(2, 'same-key-same-partition', true)

    expect(labStore.getState().learningProgress).toEqual({
      completedExperiments: { '2': ['same-key-same-partition'] },
      attempts: { '2:same-key-same-partition': 3 },
    })
  })
})
