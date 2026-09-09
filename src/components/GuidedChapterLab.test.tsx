import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getChapter } from '../chapters/registry'
import { getChapterRule, simulateChapterExperiment } from '../domain/chapterEngine'
import { DEFAULT_LEARNING_PROGRESS } from '../domain/simulation'
import { labStore } from '../state/labStore'
import { GuidedChapterLab } from './GuidedChapterLab'

const mocks = vi.hoisted(() => ({
  loadWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
  runChapterSimulation: vi.fn(),
}))

vi.mock('../storage/workspaceDb', () => ({
  loadWorkspace: mocks.loadWorkspace,
  saveWorkspace: mocks.saveWorkspace,
}))

vi.mock('../worker/client', () => ({
  runChapterSimulation: mocks.runChapterSimulation,
}))

describe('GuidedChapterLab', () => {
  beforeEach(() => {
    mocks.loadWorkspace.mockReset().mockResolvedValue(null)
    mocks.saveWorkspace.mockReset().mockResolvedValue(undefined)
    mocks.runChapterSimulation.mockReset().mockImplementation(simulateChapterExperiment)
    labStore.setState({
      hydrated: true,
      learningProgress: {
        completedExperiments: { ...DEFAULT_LEARNING_PROGRESS.completedExperiments },
        attempts: { ...DEFAULT_LEARNING_PROGRESS.attempts },
      },
    })
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() { return storage.size },
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    })
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows a facility role for Enter and Space without moving an empty timeline', () => {
    render(<GuidedChapterLab chapter={getChapter(2)} />)

    const producer = screen.getByRole('button', { name: /출발지 \(Source \/ Producer\), 대기/ })
    fireEvent.keyDown(producer, { key: 'Enter' })
    expect(screen.getAllByText('Kafka record를 만들고 전송하는 출발 시설입니다.')[0]).toBeVisible()
    expect(screen.getByRole('region', { name: '이벤트 타임라인' })).toHaveTextContent('0ms')

    fireEvent.keyDown(producer, { key: ' ' })
    expect(screen.getAllByText('Kafka record를 만들고 전송하는 출발 시설입니다.')[0]).toBeVisible()
    expect(screen.getByRole('region', { name: '이벤트 타임라인' })).toHaveTextContent('0ms')
  })

  it('moves from an observable failure to the recommended successful repair and saves progress', async () => {
    render(<GuidedChapterLab chapter={getChapter(2)} />)

    fireEvent.click(screen.getByRole('button', { name: '실패한다' }))
    fireEvent.click(screen.getByRole('button', { name: '예측한 조건 실행' }))
    await waitFor(() => expect(mocks.runChapterSimulation).toHaveBeenCalledTimes(1))
    fireEvent.click(await screen.findByTitle('업무 ordering key가 불안정하다'))
    expect(screen.getByRole('button', { name: '권장 설정 적용' })).toBeVisible()
    expect(document.querySelector('[data-city-barrier="closed"]')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '권장 설정 적용' }))
    expect(screen.getByText('설정은 바뀌었지만 이 실행은 그대로입니다.')).toBeVisible()
    expect(document.querySelector('[data-city-barrier="closed"]')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '같은 조건으로 재실행' }))
    await waitFor(() => expect(mocks.runChapterSimulation).toHaveBeenCalledTimes(2))
    fireEvent.click(await screen.findByTitle('고객별 순서 경계가 만들어졌다'))

    expect(screen.getByText('실험 통과')).toBeVisible()
    expect(document.querySelector('[data-city-signal="ack"]')).toBeInTheDocument()
    expect(screen.getByText('1 / 3 완료')).toBeVisible()
    expect(labStore.getState().learningProgress.completedExperiments['2']).toEqual([
      'same-key-same-partition',
    ])
    expect(mocks.saveWorkspace).toHaveBeenCalledTimes(2)
  })

  it('pauses and resumes the single playback clock without losing carrier progress', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    }))
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(
      () => callback(Date.now()),
      16,
    )
    window.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle)
    render(<GuidedChapterLab chapter={getChapter(2)} />)

    fireEvent.click(screen.getByLabelText(/customerId를 key로 사용/))
    fireEvent.click(screen.getByRole('button', { name: '성공한다' }))
    fireEvent.click(screen.getByRole('button', { name: '예측한 조건 실행' }))
    await act(async () => { await Promise.resolve() })
    expect(mocks.runChapterSimulation).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
    fireEvent.click(screen.getByTitle('세 레코드가 p1로 향한다'))
    expect(document.querySelector('[data-city-carrier="vehicle"]')).toHaveAttribute(
      'data-carrier-progress',
      '0.500',
    )

    fireEvent.click(screen.getByRole('button', { name: '재생' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })
    const movingProgress = document.querySelector('[data-city-carrier="vehicle"]')?.getAttribute('data-carrier-progress')
    expect(Number(movingProgress)).toBeGreaterThan(0.5)

    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    expect(document.querySelector('[data-city-carrier="vehicle"]')).toHaveAttribute(
      'data-carrier-progress',
      movingProgress,
    )

    fireEvent.click(screen.getByRole('button', { name: '재생' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    const resumedProgress = document.querySelector('[data-city-carrier="vehicle"]')?.getAttribute('data-carrier-progress')
    expect(Number(resumedProgress)).toBeGreaterThan(Number(movingProgress))
  })

  it('ignores a stale run response after switching experiments', async () => {
    let resolveRun: ((value: ReturnType<typeof simulateChapterExperiment>) => void) | null = null
    mocks.runChapterSimulation.mockReturnValueOnce(new Promise((resolve) => {
      resolveRun = resolve
    }))
    render(<GuidedChapterLab chapter={getChapter(2)} />)

    fireEvent.click(screen.getByRole('button', { name: '실패한다' }))
    fireEvent.click(screen.getByRole('button', { name: '예측한 조건 실행' }))
    expect(screen.getByRole('button', { name: '도시 실행 중…' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /key 없는 주문의 분산/ }))
    expect(screen.getByRole('button', { name: '예측한 조건 실행' })).toBeDisabled()

    const experiment = getChapterRule(2).experiments[0]!
    await act(async () => {
      resolveRun?.(simulateChapterExperiment({
        runId: 'stale-run',
        seed: 2401,
        chapterId: 2,
        experimentId: experiment.id,
        choiceId: 'random-key-per-record',
      }))
      await Promise.resolve()
    })

    expect(screen.getByRole('region', { name: '이벤트 타임라인' })).toHaveTextContent('0ms')
    expect(screen.queryByTitle('업무 ordering key가 불안정하다')).not.toBeInTheDocument()
  })

  it('ignores a stale run response after the chapter prop changes', async () => {
    let resolveRun: ((value: ReturnType<typeof simulateChapterExperiment>) => void) | null = null
    mocks.runChapterSimulation.mockReturnValueOnce(new Promise((resolve) => {
      resolveRun = resolve
    }))
    const { rerender } = render(<GuidedChapterLab chapter={getChapter(2)} />)

    fireEvent.click(screen.getByRole('button', { name: '실패한다' }))
    fireEvent.click(screen.getByRole('button', { name: '예측한 조건 실행' }))
    expect(screen.getByRole('button', { name: '도시 실행 중…' })).toBeDisabled()

    rerender(<GuidedChapterLab chapter={getChapter(3)} />)
    expect(screen.getByRole('heading', { name: '재시도는 왜 중복을 남길까?' })).toBeVisible()

    const experiment = getChapterRule(2).experiments[0]!
    await act(async () => {
      resolveRun?.(simulateChapterExperiment({
        runId: 'stale-chapter-run',
        seed: 2401,
        chapterId: 2,
        experimentId: experiment.id,
        choiceId: 'random-key-per-record',
      }))
      await Promise.resolve()
    })

    expect(screen.getByRole('region', { name: '이벤트 타임라인' })).toHaveTextContent('0ms')
    expect(screen.queryByTitle('업무 ordering key가 불안정하다')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '예측한 조건 실행' })).toBeDisabled()
  })
})
