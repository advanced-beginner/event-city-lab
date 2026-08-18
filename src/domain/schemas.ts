import { z } from 'zod'

import {
  STORAGE_SCHEMA_VERSION,
} from './simulation'

export const serializerKindSchema = z.enum(['string', 'json'])

export const producerConfigSchema = z.strictObject({
  serializer: serializerKindSchema,
  acks: z.literal('all'),
  topic: z.string().min(1).max(249),
})

export const labMessageSchema = z.strictObject({
  messageId: z.string().min(1),
  key: z.string().min(1),
  value: z.strictObject({
    orderId: z.string().min(1),
    amount: z.number().finite().nonnegative(),
    customer: z.string().min(1),
  }),
})

export const simulationInputSchema = z.strictObject({
  runId: z.string().min(1),
  seed: z.number().int().nonnegative(),
  message: labMessageSchema,
  config: producerConfigSchema,
})

const simulationEventSchema = z.strictObject({
  id: z.string(),
  sequence: z.number().int().nonnegative(),
  atMs: z.number().int().nonnegative(),
  kind: z.enum([
    'command.accepted',
    'producer.preparing',
    'serializer.inspecting',
    'serializer.rejected',
    'serializer.completed',
    'network.dispatched',
    'broker.received',
    'broker.appended',
    'ack.returned',
    'run.completed',
  ]),
  component: z.enum(['producer', 'serializer', 'rail', 'broker', 'ack']),
  state: z.enum(['idle', 'active', 'blocked', 'failed', 'complete']),
  title: z.string(),
  detail: z.string(),
  log: z.string(),
  setting: z.enum(['serializer', 'acks', 'topic']).optional(),
})

const diagnosisSchema = z.strictObject({
  symptom: z.string(),
  rootCause: z.string(),
  evidence: z.array(z.string()),
  setting: z.enum(['serializer', 'acks', 'topic']),
  currentValue: z.string(),
  recommendedValue: z.string(),
  tradeOff: z.string(),
})

export const simulationRunSchema = z.strictObject({
  runId: z.string(),
  seed: z.number().int().nonnegative(),
  messageId: z.string(),
  status: z.enum(['failed', 'succeeded']),
  config: producerConfigSchema,
  events: z.array(simulationEventSchema),
  diagnosis: diagnosisSchema.nullable(),
  summary: z.string(),
})

export const learningProgressSchema = z.strictObject({
  completedExperiments: z.record(z.string(), z.array(z.string())),
  attempts: z.record(z.string(), z.number().int().nonnegative()),
})

export const workspaceSnapshotSchema = z.strictObject({
  storageSchemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
  appVersion: z.string().min(1),
  contentVersion: z.string().min(1),
  kafkaRuleVersion: z.string().min(1),
  savedAt: z.iso.datetime(),
  config: producerConfigSchema,
  message: labMessageSchema,
  runs: z.array(simulationRunSchema).max(20),
  hintLevel: z.number().int().min(0).max(4),
  chapterCompleted: z.boolean(),
  learningProgress: learningProgressSchema,
})
