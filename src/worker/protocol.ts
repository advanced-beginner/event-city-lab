import { z } from 'zod'

import type { ChapterSimulationInput, ChapterSimulationRun } from '../domain/chapterSimulation'
import { chapterSimulationInputSchema, chapterSimulationRunSchema } from '../domain/chapterSchemas'
import type { SimulationInput, SimulationRun } from '../domain/simulation'
import { simulationInputSchema, simulationRunSchema } from '../domain/schemas'

export type SimulationWorkerRequest =
  | {
      type: 'RUN_SIMULATION'
      requestId: string
      payload: SimulationInput
    }
  | {
      type: 'RUN_CHAPTER_SIMULATION'
      requestId: string
      payload: ChapterSimulationInput
    }

export type SimulationWorkerResponse =
  | {
      type: 'SIMULATION_COMPLETE'
      requestId: string
      payload: SimulationRun
    }
  | {
      type: 'SIMULATION_ERROR'
      requestId: string
      error: string
    }
  | {
      type: 'CHAPTER_SIMULATION_COMPLETE'
      requestId: string
      payload: ChapterSimulationRun
    }

export const simulationWorkerRequestSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('RUN_SIMULATION'),
    requestId: z.string().min(1),
    payload: simulationInputSchema,
  }),
  z.strictObject({
    type: z.literal('RUN_CHAPTER_SIMULATION'),
    requestId: z.string().min(1),
    payload: chapterSimulationInputSchema,
  }),
])

export const simulationWorkerResponseSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('SIMULATION_COMPLETE'),
    requestId: z.string().min(1),
    payload: simulationRunSchema,
  }),
  z.strictObject({
    type: z.literal('SIMULATION_ERROR'),
    requestId: z.string().min(1),
    error: z.string(),
  }),
  z.strictObject({
    type: z.literal('CHAPTER_SIMULATION_COMPLETE'),
    requestId: z.string().min(1),
    payload: chapterSimulationRunSchema,
  }),
])

export function readWorkerRequestId(candidate: unknown): string | null {
  if (typeof candidate !== 'object' || candidate === null || !('requestId' in candidate)) {
    return null
  }

  const { requestId } = candidate as { requestId?: unknown }
  return typeof requestId === 'string' && requestId.length > 0 ? requestId : null
}
