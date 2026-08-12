import type { SimulationInput, SimulationRun } from '../domain/simulation'
import {
  simulationWorkerResponseSchema,
  type SimulationWorkerRequest,
} from './protocol'

let worker: Worker | null = null

function getWorker(): Worker {
  worker ??= new Worker(new URL('./simulation.worker.ts', import.meta.url), {
    type: 'module',
    name: 'event-city-simulation',
  })
  return worker
}

export function runSimulation(input: SimulationInput): Promise<SimulationRun> {
  const requestId = crypto.randomUUID()
  const request: SimulationWorkerRequest = {
    type: 'RUN_SIMULATION',
    requestId,
    payload: input,
  }

  return new Promise((resolve, reject) => {
    const activeWorker = getWorker()

    const handleMessage = (event: MessageEvent<unknown>) => {
      const parsed = simulationWorkerResponseSchema.safeParse(event.data)
      if (!parsed.success || parsed.data.requestId !== requestId) return

      activeWorker.removeEventListener('message', handleMessage)
      activeWorker.removeEventListener('error', handleError)

      if (parsed.data.type === 'SIMULATION_COMPLETE') {
        resolve(parsed.data.payload)
      } else {
        reject(new Error(parsed.data.error))
      }
    }

    const handleError = (event: ErrorEvent) => {
      activeWorker.removeEventListener('message', handleMessage)
      activeWorker.removeEventListener('error', handleError)
      reject(new Error(event.message || 'Worker 실행에 실패했습니다.'))
    }

    activeWorker.addEventListener('message', handleMessage)
    activeWorker.addEventListener('error', handleError)
    activeWorker.postMessage(request)
  })
}
