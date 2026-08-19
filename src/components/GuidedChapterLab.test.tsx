import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getChapter } from '../chapters/registry'
import { simulateChapterExperiment } from '../domain/chapterEngine'
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
    vi.unstubAllGlobals()
  })

  it('shows a facility role for Enter and Space without moving an empty timeline', () => {
    render(<GuidedChapterLab chapter={getChapter(2)} />)

    const producer = screen.getByRole('button', { name: 'Producer 출발센터, 대기' })
    fireEvent.keyDown(producer, { key: 'Enter' })
    expect(screen.getByText('Kafka record를 만들고 전송하는 출발 시설입니다.')).toBeVisible()
    expect(screen.getByRole('region', { name: '이벤트 타임라인' })).toHaveTextContent('0ms')

    fireEvent.keyDown(producer, { key: ' ' })
    expect(screen.getByText('Kafka record를 만들고 전송하는 출발 시설입니다.')).toBeVisible()
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
})
