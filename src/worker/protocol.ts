import { z } from 'zod'

import type { SimulationInput, SimulationRun } from '../domain/simulation'
import { simulationInputSchema, simulationRunSchema } from '../domain/schemas'

export type SimulationWorkerRequest = {
  type: 'RUN_SIMULATION'
  requestId: string
  payload: SimulationInput
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

export const simulationWorkerRequestSchema = z.strictObject({
  type: z.literal('RUN_SIMULATION'),
  requestId: z.string().min(1),
  payload: simulationInputSchema,
})

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
])
