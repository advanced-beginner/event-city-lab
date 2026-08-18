import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { simulateProducerSend } from '../domain/engine'
import { simulateChapterExperiment } from '../domain/chapterEngine'
import type { ChapterSimulationInput } from '../domain/chapterSimulation'
import { DEFAULT_CONFIG, DEFAULT_MESSAGE, type SimulationInput } from '../domain/simulation'

class FakeWorker {
  static instances: FakeWorker[] = []

  readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  postedMessage: unknown = null
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.get(type)?.delete(listener)
  }

  postMessage(message: unknown) {
    this.postedMessage = message
  }

  terminate() {
    this.terminated = true
  }

  emit(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0
  }
}

const validInput: SimulationInput = {
  runId: 'run-worker-test',
  seed: 2401,
  message: DEFAULT_MESSAGE,
  config: DEFAULT_CONFIG,
}

const validChapterInput: ChapterSimulationInput = {
  runId: 'run-chapter-worker-test',
  seed: 8001,
  chapterId: 8,
  experimentId: 'partial-transform',
  choiceId: 'use-atomic-transform-boundary',
}

async function loadClient() {
  return import('./client')
}

function requestIdOf(worker: FakeWorker) {
  return (worker.postedMessage as { requestId: string }).requestId
}

function currentWorker() {
  const worker = FakeWorker.instances.at(-1)
  if (!worker) throw new Error('Worker was not created')
  return worker
}

describe('simulation worker client', () => {
  beforeEach(() => {
    vi.resetModules()
    FakeWorker.instances = []
    vi.stubGlobal('Worker', FakeWorker)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('완료 응답 후 message와 error listener를 모두 정리한다', async () => {
    const { runSimulation } = await loadClient()
    const resultPromise = runSimulation(validInput)
    const worker = currentWorker()
    const result = simulateProducerSend(validInput)

    worker.emit('message', new MessageEvent('message', {
      data: { type: 'SIMULATION_COMPLETE', requestId: requestIdOf(worker), payload: result },
    }))

    await expect(resultPromise).resolves.toEqual(result)
    expect(worker.listenerCount('message')).toBe(0)
    expect(worker.listenerCount('error')).toBe(0)
    expect(worker.terminated).toBe(false)
  })

  it('현재 요청의 malformed 응답을 거절하고 listener를 정리한다', async () => {
    const { runSimulation } = await loadClient()
    const resultPromise = runSimulation(validInput)
    const worker = currentWorker()

    worker.emit('message', new MessageEvent('message', {
      data: { type: 'SIMULATION_COMPLETE', requestId: requestIdOf(worker), payload: { broken: true } },
    }))

    await expect(resultPromise).rejects.toThrow('Worker 응답 형식이 올바르지 않습니다.')
    expect(worker.listenerCount('message')).toBe(0)
    expect(worker.listenerCount('error')).toBe(0)
    expect(worker.terminated).toBe(false)
  })

  it('엔진 오류 응답을 전달하고 listener를 정리한다', async () => {
    const { runSimulation } = await loadClient()
    const resultPromise = runSimulation(validInput)
    const worker = currentWorker()

    worker.emit('message', new MessageEvent('message', {
      data: { type: 'SIMULATION_ERROR', requestId: requestIdOf(worker), error: 'engine exploded' },
    }))

    await expect(resultPromise).rejects.toThrow('engine exploded')
    expect(worker.listenerCount('message')).toBe(0)
    expect(worker.listenerCount('error')).toBe(0)
    expect(worker.terminated).toBe(false)
  })

  it('Worker 오류를 전달하고 listener를 정리한다', async () => {
    const { runSimulation } = await loadClient()
    const resultPromise = runSimulation(validInput)
    const worker = currentWorker()

    worker.emit('error', new ErrorEvent('error', { message: 'worker crashed' }))

    await expect(resultPromise).rejects.toThrow('worker crashed')
    expect(worker.listenerCount('message')).toBe(0)
    expect(worker.listenerCount('error')).toBe(0)
    expect(worker.terminated).toBe(true)

    const nextPromise = runSimulation(validInput)
    expect(FakeWorker.instances).toHaveLength(2)
    const nextWorker = currentWorker()
    nextWorker.emit('message', new MessageEvent('message', {
      data: {
        type: 'SIMULATION_COMPLETE',
        requestId: requestIdOf(nextWorker),
        payload: simulateProducerSend(validInput),
      },
    }))
    await expect(nextPromise).resolves.toMatchObject({ status: 'failed' })
  })

  it('malformed 입력은 Worker를 만들기 전에 거절한다', async () => {
    const { runSimulation } = await loadClient()

    await expect(runSimulation({ ...validInput, seed: Number.NaN })).rejects.toThrow(
      '시뮬레이션 입력 형식이 올바르지 않습니다.',
    )
    expect(FakeWorker.instances).toHaveLength(0)
  })

  it('Chapter 완료 응답을 검증하고 listener를 정리한다', async () => {
    const { runChapterSimulation } = await loadClient()
    const resultPromise = runChapterSimulation(validChapterInput)
    const worker = currentWorker()
    const result = simulateChapterExperiment(validChapterInput)

    expect(worker.postedMessage).toMatchObject({ type: 'RUN_CHAPTER_SIMULATION' })
    worker.emit('message', new MessageEvent('message', {
      data: {
        type: 'CHAPTER_SIMULATION_COMPLETE',
        requestId: requestIdOf(worker),
        payload: result,
      },
    }))

    await expect(resultPromise).resolves.toEqual(result)
    expect(worker.listenerCount('message')).toBe(0)
    expect(worker.listenerCount('error')).toBe(0)
  })

  it('Chapter 요청에 일반 시뮬레이션 응답이 오면 거절한다', async () => {
    const { runChapterSimulation } = await loadClient()
    const resultPromise = runChapterSimulation(validChapterInput)
    const worker = currentWorker()

    worker.emit('message', new MessageEvent('message', {
      data: {
        type: 'SIMULATION_COMPLETE',
        requestId: requestIdOf(worker),
        payload: simulateProducerSend(validInput),
      },
    }))

    await expect(resultPromise).rejects.toThrow('Worker가 다른 종류의 시뮬레이션 응답을 반환했습니다.')
    expect(worker.listenerCount('message')).toBe(0)
    expect(worker.listenerCount('error')).toBe(0)
  })
})
