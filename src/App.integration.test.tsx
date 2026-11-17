import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  async function renderChapterOne() {
    render(<App />)
    await screen.findByRole('heading', { name: '실행 전' })
  }

  async function sendMessage() {
    fireEvent.click(screen.getByRole('button', { name: /메시지.*보내기/ }))
    await waitFor(() => expect(labStore.getState().activeRunId).not.toBeNull())
  }

  function moveCursorToEnd() {
    act(() => {
      const run = labStore.getState().runs.at(-1)
      if (!run) throw new Error('run was not recorded')
      labStore.getState().setIsPlaying(false)
      labStore.getState().setEventCursor(run.events.length - 1)
    })
  }

  async function completeFailedRun() {
    await sendMessage()
    await waitFor(() => expect(runSimulationMock).toHaveBeenCalledTimes(1))
    moveCursorToEnd()
  }

  async function completeSuccessfulRerun() {
    fireEvent.change(screen.getByLabelText('value.serializer'), { target: { value: 'json' } })
    fireEvent.click(screen.getByRole('button', { name: /같은 메시지 다시 보내기/ }))
    await waitFor(() => expect(runSimulationMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(labStore.getState().runs).toHaveLength(2))
    moveCursorToEnd()
  }

  function showSuccessfulRunAt(cursor: number) {
    act(() => {
      const succeededRun = simulateProducerSend({
        runId: 'run-success',
        seed: 2401,
        message: labStore.getState().message,
        config: { ...labStore.getState().config, serializer: 'json' },
      })
      labStore.getState().addRun(succeededRun)
      labStore.getState().setIsPlaying(false)
      labStore.getState().setEventCursor(cursor)
    })
  }

  it('shows the Chapter 1 pre-run state before any message is sent', async () => {
    await renderChapterOne()

    expect(screen.getByRole('heading', { name: '실행 전' })).toBeInTheDocument()
    expect(screen.getByText('첫 배송을 기다리는 중')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Producer 출발센터, 대기/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Serializer 검사소, 대기/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Broker 기록센터, 대기/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Producer 도착 문자/ })).not.toBeInTheDocument()
  })

  it('switches to analysis when the first run fails at the Serializer', async () => {
    await renderChapterOne()

    await completeFailedRun()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '분석' })).toHaveAttribute('aria-selected', 'true')
    })
    expect(screen.getByText('메시지가 Broker에 도착하지 않았습니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Serializer 검사소, 실패/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Producer 도착 문자/ })).not.toBeInTheDocument()
  })

  it('keeps the failed run visible as pending rerun after the Serializer setting changes', async () => {
    await renderChapterOne()
    await completeFailedRun()

    fireEvent.change(screen.getByLabelText('value.serializer'), { target: { value: 'json' } })

    expect(screen.getByText('재실행해야 새 설정이 적용됩니다.')).toBeInTheDocument()
    expect(screen.getByText('설정은 바뀌었지만 이 실행은 그대로입니다.')).toBeInTheDocument()
    expect(screen.getByText('2 · OrderEvent ≠ StringSerializer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Serializer 검사소, 실패/ })).toBeInTheDocument()
  })

  it('switches to comparison and shows the ACK after the repaired rerun succeeds', async () => {
    await renderChapterOne()
    await completeFailedRun()

    await completeSuccessfulRerun()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '비교' })).toHaveAttribute('aria-selected', 'true')
    })
    expect(screen.getByText('바뀐 설정')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Producer 도착 문자/ })).toBeInTheDocument()
  })

  it('hides the ACK when the successful run is rewound before the ACK event', async () => {
    await renderChapterOne()
    await completeFailedRun()
    await completeSuccessfulRerun()

    fireEvent.click(screen.getByRole('button', { name: '7. 로그 append 완료' }))

    expect(screen.getByRole('heading', { name: '로그 append 완료' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Producer 도착 문자/ })).not.toBeInTheDocument()
    expect(labStore.getState().eventCursor).toBe(6)
  })

  it('moves inspection focus with Enter and Space on facilities', async () => {
    await renderChapterOne()
    await completeFailedRun()

    fireEvent.keyDown(screen.getByRole('button', { name: /Serializer 검사소, 실패/ }), { key: 'Enter' })

    expect(labStore.getState().focusedSetting).toBe('serializer')

    fireEvent.keyDown(screen.getByRole('button', { name: /Producer 출발센터/ }), { key: ' ' })

    expect(labStore.getState().focusedSetting).toBeNull()
  })

  it('does not jump to a future event when a facility is clicked after the current cursor', async () => {
    await renderChapterOne()
    showSuccessfulRunAt(3)

    fireEvent.click(screen.getByRole('button', { name: /Broker 기록센터/ }))

    expect(screen.getByRole('heading', { name: 'JSON 직렬화 완료' })).toBeInTheDocument()
    expect(labStore.getState().eventCursor).toBe(3)
  })

  it('rewinds a completed run to the pre-run state', async () => {
    await renderChapterOne()
    await completeFailedRun()
    await completeSuccessfulRerun()

    fireEvent.click(screen.getByRole('button', { name: '처음으로 되감기' }))

    expect(screen.getByRole('heading', { name: '실행 전' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Producer 도착 문자/ })).not.toBeInTheDocument()
    expect(labStore.getState().eventCursor).toBe(-1)
  })

  it('shows Chapter 1 misconception, briefing card, quick serializer fix, and takeaway summary', async () => {
    await renderChapterOne()

    expect(screen.getByText('⚠️ 흔한 오해')).toBeVisible()
    expect(
      screen.getByText('Producer가 일단 네트워크로 메시지를 보낸 뒤 Broker가 타입을 검사한다고 생각한다.'),
    ).toBeVisible()
    expect(screen.getByLabelText('실험 학습 안내')).toHaveTextContent(
      'OrderEvent 객체와 맞지 않는 StringSerializer를 설정하면 메시지는 어디에서 멈추는가?',
    )
    expect(screen.getByText(/지금 할 일 · 현재 설정 그대로 첫 메시지를 보내 보세요/)).toBeVisible()

    await completeFailedRun()
    expect(screen.getByText(/지금 할 일 · 원인을 읽고 value\.serializer를 변경하세요/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '권장 설정(JsonSerializer) 바로 적용' }))

    expect(screen.getByText(/지금 할 일 · 바뀐 설정으로 다시 보내세요/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /같은 메시지 다시 보내기/ }))
    await waitFor(() => expect(labStore.getState().runs).toHaveLength(2))
    moveCursorToEnd()

    const takeaway = await screen.findByLabelText('핵심 깨달음 및 실무 주의사항')
    expect(takeaway).toBeVisible()
    expect(takeaway).toHaveTextContent('Serializer는 네트워크 전송 전 Producer 내부에서 실행되므로')
    expect(takeaway).toHaveTextContent('직렬화(Serialization) 실패는 네트워크 전송 이전에 발생하므로 Broker 로그에는 아무 기록도 남지 않는다.')
  })
})
