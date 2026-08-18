import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

const workspaceDbMocks = vi.hoisted(() => ({
  loadWorkspace: vi.fn(),
  parseWorkspaceJson: vi.fn(),
  saveWorkspace: vi.fn(),
  serializeWorkspace: vi.fn(),
}))

vi.mock('./storage/workspaceDb', () => ({
  loadWorkspace: workspaceDbMocks.loadWorkspace,
  parseWorkspaceJson: workspaceDbMocks.parseWorkspaceJson,
  saveWorkspace: workspaceDbMocks.saveWorkspace,
  serializeWorkspace: workspaceDbMocks.serializeWorkspace,
}))

describe('App chapter shell', () => {
  beforeEach(() => {
    workspaceDbMocks.loadWorkspace.mockReset().mockResolvedValue(null)
    workspaceDbMocks.parseWorkspaceJson.mockReset()
    workspaceDbMocks.saveWorkspace.mockReset().mockResolvedValue(undefined)
    workspaceDbMocks.serializeWorkspace.mockReset().mockReturnValue('{}')
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() { return storage.size },
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    })
    window.history.replaceState(null, '', '#/chapter/2')
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '#/chapter/1')
  })

  it('renders all chapters as unlocked hash navigation destinations', () => {
    render(<App />)

    const navigation = screen.getByRole('navigation', { name: '챕터 이동' })
    const links = navigation.querySelectorAll('a')

    expect(links).toHaveLength(8)
    expect(links[0]).toHaveAttribute('href', '#/chapter/1')
    expect(links[7]).toHaveAttribute('href', '#/chapter/8')
    expect(screen.getByRole('link', { name: /Chapter 2:/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 1, name: '메시지는 어느 파티션으로 갈까\?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '세 가지 실험' })).toBeInTheDocument()
  })

  it('updates implemented chapter content after a hash navigation event', () => {
    render(<App />)

    act(() => {
      window.location.hash = '#/chapter/8'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(screen.getByRole('heading', { level: 1, name: '읽고 바꿔 쓰는 전체를 하나로 묶을 수 있을까\?' })).toBeInTheDocument()
    expect(screen.getAllByText('출력은 쓰고 offset은 잃은 처리')).toHaveLength(2)
    expect(screen.getByRole('radio', { name: /출력과 offset을 따로 commit/ })).toBeChecked()
    expect(screen.getByRole('link', { name: /Chapter 8:/ })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps the implemented Chapter 1 lab on its established route', () => {
    window.history.replaceState(null, '', '#/chapter/1')
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: '첫 메시지는 왜 출발하지 못했을까?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /첫 메시지 보내기/ })).toBeInTheDocument()
  })

  it('blocks autosave when persisted data needs recovery', async () => {
    vi.useFakeTimers()
    window.history.replaceState(null, '', '#/chapter/1')
    workspaceDbMocks.loadWorkspace.mockRejectedValue({
      result: { reason: 'unsupported-newer-version' },
    })

    render(<App />)
    await act(async () => {})

    expect(screen.getByText('더 새로운 저장 데이터 · 가져오기로 복구 필요')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(500))
    expect(workspaceDbMocks.saveWorkspace).not.toHaveBeenCalled()
  })
})
