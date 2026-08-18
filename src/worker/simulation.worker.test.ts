import { beforeEach, describe, expect, it, vi } from 'vitest'

class FakeWorkerScope {
  messageHandler: ((event: MessageEvent<unknown>) => void) | null = null
  postedMessages: unknown[] = []

  addEventListener(type: string, handler: (event: MessageEvent<unknown>) => void) {
    if (type === 'message') this.messageHandler = handler
  }

  postMessage(message: unknown) {
    this.postedMessages.push(message)
  }
}

describe('simulation worker entry', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('malformed payload의 유효한 requestId를 오류 응답에 보존한다', async () => {
    const scope = new FakeWorkerScope()
    vi.stubGlobal('self', scope)
    await import('./simulation.worker')

    scope.messageHandler?.(new MessageEvent('message', {
      data: { type: 'RUN_SIMULATION', requestId: 'request-malformed', payload: { seed: 'wrong' } },
    }))

    expect(scope.postedMessages).toEqual([
      {
        type: 'SIMULATION_ERROR',
        requestId: 'request-malformed',
        error: '시뮬레이션 요청 형식이 올바르지 않습니다.',
      },
    ])
    vi.unstubAllGlobals()
  })
})
