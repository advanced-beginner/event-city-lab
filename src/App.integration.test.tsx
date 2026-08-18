import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { simulateProducerSend } from './domain/engine'
import { labStore } from './state/labStore'

const runSimulationMock = vi.hoisted(() => vi.fn())

vi.mock('./worker/client', () => ({
  runSimulation: runSimulationMock,
}))

vi.mock('./storage/workspaceDb', () => ({
  loadWorkspace: vi.fn().mockResolvedValue(null),
  parseWorkspaceJson: vi.fn(),
  saveWorkspace: vi.fn().mockResolvedValue(undefined),
  serializeWorkspace: vi.fn().mockReturnValue('{}'),
}))

vi.mock('./components/JavaConfigEditor', () => ({
  JavaConfigEditor: () => <div data-testid="java-config-editor" />,
}))

describe('Chapter 1 App integration', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    })
    labStore.setState(labStore.getInitialState(), true)
    runSimulationMock.mockReset()
    runSimulationMock.mockImplementation(async (input) => simulateProducerSend(input))
    window.location.hash = '#/chapter/1'
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('첫 실패를 분석하고 설정 변경 후 성공 실행을 비교하며 ACK 이전으로 되감는다', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /첫 메시지 보내기/ }))

    await waitFor(() => expect(runSimulationMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(labStore.getState().activeRunId).not.toBeNull())

    act(() => {
      const failedRun = labStore.getState().runs.at(-1)
      if (!failedRun) throw new Error('failed run was not recorded')
      labStore.getState().setIsPlaying(false)
      labStore.getState().setEventCursor(failedRun.events.length - 1)
    })

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '분석' })).toHaveAttribute('aria-selected', 'true')
    })
    expect(screen.getByText('메시지가 Broker에 도착하지 않았습니다.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('value.serializer'), { target: { value: 'json' } })
    expect(screen.getByText('재실행해야 새 설정이 적용됩니다.')).toBeInTheDocument()
    expect(screen.getByText('설정은 바뀌었지만 이 실행은 그대로입니다.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /같은 메시지 다시 보내기/ }))
    await waitFor(() => expect(runSimulationMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(labStore.getState().runs).toHaveLength(2))

    act(() => {
      const succeededRun = labStore.getState().runs.at(-1)
      if (!succeededRun) throw new Error('succeeded run was not recorded')
      labStore.getState().setIsPlaying(false)
      labStore.getState().setEventCursor(succeededRun.events.length - 1)
    })

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '비교' })).toHaveAttribute('aria-selected', 'true')
    })
    expect(screen.getByText('바뀐 설정')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Producer 도착 문자/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '처음으로 되감기' }))

    expect(screen.getByRole('heading', { name: '실행 전' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Producer 도착 문자/ })).not.toBeInTheDocument()
    expect(labStore.getState().eventCursor).toBe(-1)
  })
})
