import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getChapterOneScene, getChapterScene } from '../city/chapterScenes'
import { createChapterOneCuedEvents } from '../city/projection'
import { getChapterRule, simulateChapterExperiment } from '../domain/chapterEngine'
import { simulateProducerSend } from '../domain/engine'
import { DEFAULT_CONFIG, DEFAULT_MESSAGE } from '../domain/simulation'
import { IsometricDioramaStage } from './IsometricDioramaStage'

describe('IsometricDioramaStage', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders Chapter 1 facilities, cutaway base, and failed serializer error marker', () => {
    const scene = getChapterOneScene()
    const failedRun = simulateProducerSend({
      runId: 'ch1-fail',
      seed: 2401,
      message: DEFAULT_MESSAGE,
      config: { ...DEFAULT_CONFIG, serializer: 'string' },
    })
    const events = createChapterOneCuedEvents(failedRun)

    render(
      <IsometricDioramaStage
        scene={scene}
        events={events}
        cursor={events.length - 1}
        pendingRerun={false}
        reducedMotion={false}
        onInspect={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Producer 출발센터, 완료' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Serializer 검사소, 실패' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Broker 기록센터, 비활성' })).toBeInTheDocument()
    expect(screen.getByText('2 · OrderEvent ≠ StringSerializer')).toBeInTheDocument()
    expect(document.querySelector('[data-city-barrier="closed"]')).toBeInTheDocument()
    expect(document.querySelector('[data-city-world] > image')).not.toBeInTheDocument()
  })

  it('renders Chapter 1 ACK signal and clickable arrival card only when showChapterOneAckBubble is true', () => {
    const scene = getChapterOneScene()
    const successRun = simulateProducerSend({
      runId: 'ch1-ok',
      seed: 2401,
      message: DEFAULT_MESSAGE,
      config: { ...DEFAULT_CONFIG, serializer: 'json' },
    })
    const events = createChapterOneCuedEvents(successRun)
    const onInspect = vi.fn()

    const { rerender } = render(
      <IsometricDioramaStage
        scene={scene}
        events={events}
        cursor={6}
        pendingRerun={false}
        reducedMotion={false}
        showChapterOneAckBubble={false}
        onInspect={onInspect}
      />,
    )

    expect(screen.queryByRole('button', { name: /Producer 도착 문자/ })).not.toBeInTheDocument()

    rerender(
      <IsometricDioramaStage
        scene={scene}
        events={events}
        cursor={8}
        pendingRerun={false}
        reducedMotion={false}
        showChapterOneAckBubble={true}
        onInspect={onInspect}
      />,
    )

    const ackButton = screen.getByRole('button', { name: 'Producer 도착 문자, 완료' })
    expect(ackButton).toBeInTheDocument()
    fireEvent.click(ackButton)
    expect(onInspect).toHaveBeenCalledWith('ack')
  })

  it('renders multiple branching postal vans simultaneously for Chapter 2 partition scatter', () => {
    const scene = getChapterScene(2)
    const experiment = getChapterRule(2).experiments[0]!
    const run = simulateChapterExperiment({
      runId: 'ch2-scatter',
      seed: 2401,
      chapterId: 2,
      experimentId: experiment.id,
      choiceId: 'random-key-per-record',
    })

    render(
      <IsometricDioramaStage
        scene={scene}
        events={run.events}
        cursor={2}
        pendingRerun={false}
        reducedMotion={false}
        onInspect={vi.fn()}
      />,
    )

    const vans = document.querySelectorAll('[data-city-carrier]')
    expect(vans).toHaveLength(3)
    expect(document.querySelector('[data-city-carrier="vehicle"]')).toHaveAttribute('data-carrier-route', 'producer-p0')
    expect(document.querySelector('[data-city-carrier="branch-1"]')).toHaveAttribute('data-carrier-route', 'producer-p2')
    expect(document.querySelector('[data-city-carrier="branch-2"]')).toHaveAttribute('data-carrier-route', 'producer-p1')
  })

  it('supports exploded view toggle, focus/overview camera toggle, and keyboard inspection', () => {
    const scene = getChapterScene(6)
    const onInspect = vi.fn()
    const onToggleExploded = vi.fn()
    const onViewModeChange = vi.fn()

    render(
      <IsometricDioramaStage
        scene={scene}
        events={[]}
        cursor={-1}
        exploded={true}
        viewMode="overview"
        pendingRerun={false}
        reducedMotion={true}
        onInspect={onInspect}
        onToggleExploded={onToggleExploded}
        onViewModeChange={onViewModeChange}
      />,
    )

    expect(document.querySelector('[data-diorama-stage]')).toHaveAttribute('data-diorama-exploded', 'true')
    expect(document.querySelector('[data-city-world]')).toHaveAttribute('viewBox', '0 0 1600 900')
    expect(document.querySelector('[data-city-world]')).toHaveAttribute('data-reduced-motion', 'true')

    fireEvent.click(screen.getByRole('button', { name: '조립 뷰' }))
    expect(onToggleExploded).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '핵심 도로' }))
    expect(onViewModeChange).toHaveBeenCalledWith('focus')

    const partitions = screen.getByRole('button', { name: /Partitions p0–p2 파티션 터미널/ })
    fireEvent.keyDown(partitions, { key: 'Enter' })
    fireEvent.keyDown(partitions, { key: ' ' })
    expect(onInspect).toHaveBeenNthCalledWith(1, 'slot-partitions')
    expect(onInspect).toHaveBeenNthCalledWith(2, 'slot-partitions')
  })
})
