import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAdvancedChapterScene } from '../city/chapterScenes'
import { getChapterRule, simulateChapterExperiment } from '../domain/chapterEngine'
import type { ChapterSimulationEvent, ChapterSimulationRun } from '../domain/chapterSimulation'
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

    const producer = screen.getByRole('button', { name: 'Source / Producer, 대기' })
    expect(producer).toHaveAttribute('data-city-node', 'producer')
    expect(producer).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(producer, { key: 'Enter' })
    fireEvent.keyDown(producer, { key: ' ' })

    expect(onInspect).toHaveBeenNthCalledWith(1, 'producer')
    expect(onInspect).toHaveBeenNthCalledWith(2, 'producer')
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(document.querySelectorAll('[data-logical-node^="partition-"]')).toHaveLength(3)
    expect(document.querySelectorAll('[data-city-carrier="vehicle"]')).toHaveLength(1)
    expect(document.querySelector('[data-city-main-road]')).toHaveAttribute(
      'data-city-main-road',
      'downtown-main-arterial',
    )
    expect(document.querySelector('[data-city-main-road] path:last-of-type')).toHaveAttribute(
      'd',
      getAdvancedChapterScene(2).mainRoad.path,
    )
    expect(document.querySelectorAll('[data-city-facility-slot]')).toHaveLength(3)
  })

  it('renders a stopped carrier and closed barrier at a failed terminal event', () => {
    const failedRun = makeRun('random-key-per-record')
    renderWorld({ run: failedRun, cursor: failedRun.events.length - 1 })

    expect(document.querySelector('[data-city-carrier="vehicle"]')).toHaveAttribute(
      'data-carrier-kind',
      'record',
    )
    expect(document.querySelector('[data-city-carrier="vehicle"]')).toHaveAttribute('data-carrier-batch-size', '3')
    expect(document.querySelectorAll('[data-city-carrier]')).toHaveLength(1)
    expect(document.querySelector('[data-city-barrier="closed"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Application \/ Sink, 실패/ })).toBeInTheDocument()
  })

  it('renders the return signal and completed facilities after the recommended run', () => {
    const succeededRun = makeRun('stable-customer-key')
    renderWorld({ run: succeededRun, cursor: succeededRun.events.length - 1 })

    expect(document.querySelector('[data-city-signal="ack"]')).toBeInTheDocument()
    expect(document.querySelector('[data-city-barrier="open"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Application \/ Sink, 완료/ })).toBeInTheDocument()
  })

  it('shows the whole Chapter 2-8 atlas without cropping it', () => {
    renderWorld()

    expect(document.querySelector('[data-city-world]')).toHaveAttribute(
      'preserveAspectRatio',
      'xMidYMid meet',
    )
  })

  it('marks the world as reduced motion when the app preference is enabled', () => {
    renderWorld({ reducedMotion: true })

    expect(document.querySelector('[data-city-world]')).toHaveAttribute('data-reduced-motion', 'true')
    expect(document.querySelector('[data-city-world]')).toHaveClass('city-world-reduced-motion')
  })

  it('animates an arriving carrier along the one declared main road', () => {
    const succeededRun = makeRun('stable-customer-key')
    renderWorld({ run: succeededRun, cursor: succeededRun.events.length - 1, motionDurationMs: 420 })

    const carrier = document.querySelector('[data-city-carrier="vehicle"]')
    expect(carrier).toHaveAttribute('data-motion-mode', 'road-path')
    expect(carrier).toHaveAttribute('data-carrier-direction', 'forward')
    expect(carrier?.querySelector('animateMotion')).toHaveAttribute('path', getAdvancedChapterScene(2).mainRoad.path)
  })

  it('continues from the previous world position when the carrier changes routes', () => {
    const scene = getAdvancedChapterScene(2)
    const events = [
      {
        cityCue: {
          focusNodeIds: ['partition-p1'],
          carrierChanges: {
            record: {
              kind: 'record' as const,
              routeId: 'producer-p1',
              checkpointId: 'producer-p1:end',
              progress: 1,
              state: 'active' as const,
            },
          },
        },
      },
      {
        cityCue: {
          focusNodeIds: ['application'],
          carrierChanges: {
            record: {
              kind: 'record' as const,
              routeId: 'p1-application',
              checkpointId: 'p1-application:end',
              progress: 1,
              state: 'complete' as const,
            },
          },
        },
      },
    ] as unknown as readonly ChapterSimulationEvent[]
    const { rerender } = render(
      <AdvancedCityWorld
        scene={scene}
        events={events}
        cursor={0}
        motionDurationMs={0}
        pendingRerun={false}
        reducedMotion={false}
        onInspect={vi.fn()}
      />,
    )

    rerender(
      <AdvancedCityWorld
        scene={scene}
        events={events}
        cursor={1}
        motionDurationMs={420}
        pendingRerun={false}
        reducedMotion={false}
        onInspect={vi.fn()}
      />,
    )

    const motion = document.querySelector('[data-city-carrier="vehicle"] animateMotion')
    expect(motion).toHaveAttribute('path', scene.mainRoad.path)
    expect(motion).toHaveAttribute('keyPoints', '0.5;1')
  })

  it('keeps each physical facility inspection target stable as logical states change', () => {
    const run = makeRun('random-key-per-record')
    const scene = getAdvancedChapterScene(2)
    const { rerender } = render(
      <AdvancedCityWorld
        scene={scene}
        events={run.events}
        cursor={-1}
        motionDurationMs={0}
        pendingRerun={false}
        reducedMotion={false}
        onInspect={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-city-node="partition-p0"]')).toBeInTheDocument()
    rerender(
      <AdvancedCityWorld
        scene={scene}
        events={run.events}
        cursor={run.events.length - 1}
        motionDurationMs={0}
        pendingRerun={false}
        reducedMotion={false}
        onInspect={vi.fn()}
      />,
    )
    expect(document.querySelector('[data-city-node="partition-p0"]')).toBeInTheDocument()
    expect(document.querySelector('[data-city-node="partition-p2"]')).not.toBeInTheDocument()
  })

  it('parks every chapter vehicle at the shared 8 o’clock road origin', () => {
    for (const chapterId of [2, 3, 4, 5, 6, 7, 8] as const) {
      const scene = getAdvancedChapterScene(chapterId)
      const { unmount } = render(
        <AdvancedCityWorld
          scene={scene}
          events={[]}
          cursor={-1}
          motionDurationMs={0}
          pendingRerun={false}
          reducedMotion={false}
          onInspect={vi.fn()}
        />,
      )
      expect(document.querySelector('[data-city-carrier="vehicle"]')).toHaveAttribute('data-carrier-progress', '0.000')
      unmount()
    }
  })
})
