/// <reference lib="webworker" />

import { simulateProducerSend } from '../domain/engine'
import { simulateChapterExperiment } from '../domain/chapterEngine'
import {
  readWorkerRequestId,
  simulationWorkerRequestSchema,
  type SimulationWorkerResponse,
} from './protocol'

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope

workerScope.addEventListener('message', (event: MessageEvent<unknown>) => {
  const parsed = simulationWorkerRequestSchema.safeParse(event.data)

  if (!parsed.success) {
    const response: SimulationWorkerResponse = {
      type: 'SIMULATION_ERROR',
      requestId: readWorkerRequestId(event.data) ?? 'invalid-request',
      error: '시뮬레이션 요청 형식이 올바르지 않습니다.',
    }
    workerScope.postMessage(response)
    return
  }

  try {
    const response: SimulationWorkerResponse = parsed.data.type === 'RUN_SIMULATION'
      ? {
          type: 'SIMULATION_COMPLETE',
          requestId: parsed.data.requestId,
          payload: simulateProducerSend(parsed.data.payload),
        }
      : {
          type: 'CHAPTER_SIMULATION_COMPLETE',
          requestId: parsed.data.requestId,
          payload: simulateChapterExperiment(parsed.data.payload),
        }
    workerScope.postMessage(response)
  } catch (error) {
    const response: SimulationWorkerResponse = {
      type: 'SIMULATION_ERROR',
      requestId: parsed.data.requestId,
      error: error instanceof Error ? error.message : '알 수 없는 엔진 오류',
    }
    workerScope.postMessage(response)
  }
})

export {}
