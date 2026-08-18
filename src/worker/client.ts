import type { SimulationInput, SimulationRun } from '../domain/simulation'
import { simulationInputSchema } from '../domain/schemas'
import {
  readWorkerRequestId,
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

function discardWorker(candidate: Worker) {
  if (worker !== candidate) return
  candidate.terminate()
  worker = null
}

export function runSimulation(input: SimulationInput): Promise<SimulationRun> {
  const parsedInput = simulationInputSchema.safeParse(input)
  if (!parsedInput.success) {
    return Promise.reject(new Error('시뮬레이션 입력 형식이 올바르지 않습니다.'))
  }

  const requestId = crypto.randomUUID()
  const request: SimulationWorkerRequest = {
    type: 'RUN_SIMULATION',
    requestId,
    payload: parsedInput.data,
  }

  return new Promise((resolve, reject) => {
    const activeWorker = getWorker()

    const cleanup = () => {
      activeWorker.removeEventListener('message', handleMessage)
      activeWorker.removeEventListener('error', handleError)
    }

    const handleMessage = (event: MessageEvent<unknown>) => {
      const parsed = simulationWorkerResponseSchema.safeParse(event.data)
      if (!parsed.success) {
        if (readWorkerRequestId(event.data) !== requestId) return
        cleanup()
        reject(new Error('Worker 응답 형식이 올바르지 않습니다.'))
        return
      }
      if (parsed.data.requestId !== requestId) return

      cleanup()

      if (parsed.data.type === 'SIMULATION_COMPLETE') {
        resolve(parsed.data.payload)
      } else {
        reject(new Error(parsed.data.error))
      }
    }

    const handleError = (event: ErrorEvent) => {
      cleanup()
      discardWorker(activeWorker)
      reject(new Error(event.message || 'Worker 실행에 실패했습니다.'))
    }

    activeWorker.addEventListener('message', handleMessage)
    activeWorker.addEventListener('error', handleError)
    try {
      activeWorker.postMessage(request)
    } catch (error) {
      cleanup()
      reject(error instanceof Error ? error : new Error('Worker 요청을 전송하지 못했습니다.'))
    }
  })
}
