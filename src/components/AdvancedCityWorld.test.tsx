import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAdvancedChapterScene } from '../city/chapterScenes'
import { getChapterRule, simulateChapterExperiment } from '../domain/chapterEngine'
import type { ChapterSimulationRun } from '../domain/chapterSimulation'
import { AdvancedCityWorld } from './AdvancedCityWorld'

function makeRun(choiceId: string): ChapterSimulationRun {
  const experiment = getChapterRule(2).experiments[0]
  if (!experiment) throw new Error('Chapter 2 first experiment is required for the city world test.')

  return simulateChapterExperiment({
    runId: `city-world-${choiceId}`,
    seed: 2401,
    chapterId: 2,
    experimentId: experiment.id,
    choiceId,
  })
}

function renderWorld({
  run = null,
  cursor = -1,
  motionDurationMs = 0,
  onInspect = vi.fn(),
  reducedMotion = false,
}: {
  run?: ChapterSimulationRun | null
  cursor?: number
  motionDurationMs?: number
  onInspect?: (nodeId: string) => void
  reducedMotion?: boolean
} = {}) {
  return render(
    <AdvancedCityWorld
      scene={getAdvancedChapterScene(2)}
      events={run?.events ?? []}
      cursor={cursor}
      motionDurationMs={motionDurationMs}
      pendingRerun={false}
      reducedMotion={reducedMotion}
      onInspect={onInspect}
    />,
  )
}

describe('AdvancedCityWorld', () => {
  afterEach(() => cleanup())

  it('exposes every facility as a named keyboard-operable button', () => {
    const onInspect = vi.fn()
    renderWorld({ onInspect })

    const producer = screen.getByRole('button', { name: 'Producer 출발센터, 대기' })
    expect(producer).toHaveAttribute('data-city-node', 'producer')
    expect(producer).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(producer, { key: 'Enter' })
    fireEvent.keyDown(producer, { key: ' ' })

    expect(onInspect).toHaveBeenNthCalledWith(1, 'producer')
    expect(onInspect).toHaveBeenNthCalledWith(2, 'producer')
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('renders a stopped carrier and closed barrier at a failed terminal event', () => {
    const failedRun = makeRun('random-key-per-record')
    renderWorld({ run: failedRun, cursor: failedRun.events.length - 1 })

    expect(document.querySelector('[data-city-carrier="result"]')).toHaveAttribute(
      'data-carrier-kind',
      'ghost-record',
    )
    expect(document.querySelector('[data-city-barrier="closed"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Application 처리공장, 실패/ })).toBeInTheDocument()
  })

  it('renders the return signal and completed facilities after the recommended run', () => {
    const succeededRun = makeRun('stable-customer-key')
    renderWorld({ run: succeededRun, cursor: succeededRun.events.length - 1 })

    expect(document.querySelector('[data-city-signal="ack"]')).toBeInTheDocument()
    expect(document.querySelector('[data-city-barrier="open"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Application 처리공장, 완료/ })).toBeInTheDocument()
  })

  it('marks the world as reduced motion when the app preference is enabled', () => {
    renderWorld({ reducedMotion: true })

    expect(document.querySelector('[data-city-world]')).toHaveAttribute('data-reduced-motion', 'true')
    expect(document.querySelector('[data-city-world]')).toHaveClass('city-world-reduced-motion')
  })

  it('animates an arriving carrier along its declared road path', () => {
    const succeededRun = makeRun('stable-customer-key')
    renderWorld({ run: succeededRun, cursor: succeededRun.events.length - 1, motionDurationMs: 420 })

    const carrier = document.querySelector('[data-city-carrier^="receipt-"]')
    const routeId = carrier?.getAttribute('data-carrier-route')
    const route = getAdvancedChapterScene(2).routes.find((candidate) => candidate.id === routeId)

    expect(carrier).toHaveAttribute('data-motion-mode', 'road-path')
    expect(carrier?.querySelector('animateMotion')).toHaveAttribute('path', route?.path)
  })
})
