import { z } from 'zod'

export const advancedChapterIdSchema = z.union([
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
])

export const chapterSimulationInputSchema = z.strictObject({
  runId: z.string().min(1),
  seed: z.number().int().nonnegative(),
  chapterId: advancedChapterIdSchema,
  experimentId: z.string().min(1),
  choiceId: z.string().min(1),
})

const chapterDiagnosisSchema = z.strictObject({
  symptom: z.string(),
  rootCause: z.string(),
  evidence: z.array(z.string()),
  recommendedChoiceId: z.string(),
  tradeOff: z.string(),
})

const chapterEventSchema = z.strictObject({
  id: z.string(),
  sequence: z.number().int().nonnegative(),
  atMs: z.number().int().nonnegative(),
  kind: z.enum([
    'experiment.started',
    'configuration.applied',
    'record.dispatched',
    'state.changed',
    'evidence.observed',
    'experiment.failed',
    'experiment.succeeded',
  ]),
  component: z.enum([
    'producer',
    'partition',
    'broker',
    'replica',
    'consumer',
    'coordinator',
    'offset',
    'retry',
    'application',
    'transaction',
  ]),
  state: z.enum(['active', 'blocked', 'failed', 'complete']),
  title: z.string(),
  detail: z.string(),
  log: z.string(),
})

export const chapterSimulationRunSchema = z.strictObject({
  runId: z.string(),
  seed: z.number().int().nonnegative(),
  chapterId: advancedChapterIdSchema,
  experimentId: z.string(),
  choiceId: z.string(),
  status: z.enum(['failed', 'succeeded']),
  events: z.array(chapterEventSchema),
  diagnosis: chapterDiagnosisSchema.nullable(),
  summary: z.string(),
})
