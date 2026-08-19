import { createChapterCityCue } from '../city/choreography'
import { getAdvancedChapterScene } from '../city/chapterScenes'
import type { ChapterCityCue } from '../city/types'
import { validateChapterCityCue } from '../city/validation'

export type AdvancedChapterId = 2 | 3 | 4 | 5 | 6 | 7 | 8
export type ChapterRunStatus = 'failed' | 'succeeded'
export type ChapterEventState = 'active' | 'blocked' | 'failed' | 'complete'

export type ChapterComponentId =
  | 'producer'
  | 'partition'
  | 'broker'
  | 'replica'
  | 'consumer'
  | 'coordinator'
  | 'offset'
  | 'retry'
  | 'application'
  | 'transaction'

export type ChapterEventKind =
  | 'experiment.started'
  | 'configuration.applied'
  | 'record.dispatched'
  | 'state.changed'
  | 'evidence.observed'
  | 'experiment.failed'
  | 'experiment.succeeded'

export interface ChapterEventTemplate {
  atMs: number
  kind: ChapterEventKind
  component: ChapterComponentId
  state: ChapterEventState
  title: string
  detail: string
  log: string
  cityCue?: ChapterCityCue
}

export interface ChapterSimulationEvent extends Omit<ChapterEventTemplate, 'cityCue'> {
  id: string
  sequence: number
  cityCue: ChapterCityCue
}

export interface ChapterDiagnosis {
  symptom: string
  rootCause: string
  evidence: readonly string[]
  recommendedChoiceId: string
  tradeOff: string
}

export interface ChapterChoiceOutcome {
  status: ChapterRunStatus
  summary: string
  events: readonly ChapterEventTemplate[]
  diagnosis: ChapterDiagnosis | null
}

export interface ChapterExperimentChoice {
  id: string
  label: string
  description: string
  outcome: ChapterChoiceOutcome
}

export interface ChapterExperimentDefinition {
  id: string
  title: string
  mission: string
  predictionPrompt: string
  successCriteria: string
  recommendedChoiceId: string
  choices: readonly ChapterExperimentChoice[]
  referenceIds: readonly string[]
}

export interface ChapterRuleModule {
  chapterId: AdvancedChapterId
  experiments: readonly ChapterExperimentDefinition[]
}

export interface ChapterSimulationInput {
  runId: string
  seed: number
  chapterId: AdvancedChapterId
  experimentId: string
  choiceId: string
}

export interface ChapterSimulationRun {
  runId: string
  seed: number
  chapterId: AdvancedChapterId
  experimentId: string
  choiceId: string
  status: ChapterRunStatus
  events: readonly ChapterSimulationEvent[]
  diagnosis: ChapterDiagnosis | null
  summary: string
}

export function runChapterRule(
  rule: ChapterRuleModule,
  input: ChapterSimulationInput,
): ChapterSimulationRun {
  if (input.chapterId !== rule.chapterId) {
    throw new Error(`Chapter ${input.chapterId} input cannot run with Chapter ${rule.chapterId} rules.`)
  }

  const experiment = rule.experiments.find((candidate) => candidate.id === input.experimentId)
  if (!experiment) throw new Error(`Unknown Chapter ${rule.chapterId} experiment: ${input.experimentId}`)

  const choice = experiment.choices.find((candidate) => candidate.id === input.choiceId)
  if (!choice) throw new Error(`Unknown choice for ${input.experimentId}: ${input.choiceId}`)

  return {
    runId: input.runId,
    seed: input.seed,
    chapterId: input.chapterId,
    experimentId: input.experimentId,
    choiceId: input.choiceId,
    status: choice.outcome.status,
    events: choice.outcome.events.map((event, sequence) => ({
      ...event,
      cityCue: event.cityCue ?? createChapterCityCue({
        chapterId: input.chapterId,
        experimentId: input.experimentId,
        choiceId: input.choiceId,
        outcomeStatus: choice.outcome.status,
        event,
        sequence,
        eventCount: choice.outcome.events.length,
      }),
      id: `${input.runId}:${sequence}`,
      sequence,
    })),
    diagnosis: choice.outcome.diagnosis,
    summary: choice.outcome.summary,
  }
}

export function validateChapterRule(rule: ChapterRuleModule): void {
  if (rule.experiments.length !== 3) {
    throw new Error(`Chapter ${rule.chapterId} must define exactly three guided experiments.`)
  }

  const experimentIds = new Set<string>()
  const scene = getAdvancedChapterScene(rule.chapterId)
  for (const experiment of rule.experiments) {
    if (experimentIds.has(experiment.id)) throw new Error(`Duplicate experiment id: ${experiment.id}`)
    experimentIds.add(experiment.id)

    if (!experiment.choices.some((choice) => choice.id === experiment.recommendedChoiceId)) {
      throw new Error(`Missing recommended choice for ${experiment.id}`)
    }
    if (!experiment.choices.some((choice) => choice.outcome.status === 'failed')) {
      throw new Error(`Experiment ${experiment.id} must include an observable failure.`)
    }
    if (
      experiment.choices.find((choice) => choice.id === experiment.recommendedChoiceId)?.outcome.status
      !== 'succeeded'
    ) {
      throw new Error(`Recommended choice for ${experiment.id} must succeed.`)
    }

    for (const choice of experiment.choices) {
      if (choice.outcome.events.length === 0) {
        throw new Error(`Choice ${experiment.id}/${choice.id} must define observable events.`)
      }
      const cues = choice.outcome.events.map((event, sequence) => {
        const cue = event.cityCue ?? createChapterCityCue({
          chapterId: rule.chapterId,
          experimentId: experiment.id,
          choiceId: choice.id,
          outcomeStatus: choice.outcome.status,
          event,
          sequence,
          eventCount: choice.outcome.events.length,
        })
        validateChapterCityCue(scene, cue)
        return cue
      })
      const terminalCue = cues.at(-1)
      if (choice.outcome.status === 'failed' && terminalCue?.barrier?.state !== 'closed') {
        throw new Error(`Failed choice ${experiment.id}/${choice.id} must close a city barrier.`)
      }
      if (choice.outcome.status === 'succeeded' && terminalCue?.signal?.state !== 'complete') {
        throw new Error(`Successful choice ${experiment.id}/${choice.id} must return an explicit city signal.`)
      }
    }
  }
}
