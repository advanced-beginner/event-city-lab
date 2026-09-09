import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getAdvancedChapterScene } from '../city/chapterScenes'
import { getAdvancedCityCamera } from '../city/camera'
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
  carrierProgress,
  onInspect = vi.fn(),
  reducedMotion = false,
  viewMode,
}: {
  run?: ChapterSimulationRun | null
  cursor?: number
  carrierProgress?: number
  onInspect?: (nodeId: string) => void
  reducedMotion?: boolean
  viewMode?: 'focus' | 'overview'
} = {}) {
  return render(
    <AdvancedCityWorld
      scene={getAdvancedChapterScene(2)}
      events={run?.events ?? []}
      cursor={cursor}
      pendingRerun={false}
      reducedMotion={reducedMotion}
      onInspect={onInspect}
      {...(carrierProgress === undefined ? {} : { carrierProgress })}
      {...(viewMode === undefined ? {} : { viewMode })}
    />,
  )
}

describe('AdvancedCityWorld', () => {
  afterEach(() => cleanup())

  it.each([
    { isPlaying: true, reducedMotion: false, terminal: false, active: 'true' },
    { isPlaying: false, reducedMotion: false, terminal: false, active: 'false' },
    { isPlaying: true, reducedMotion: true, terminal: false, active: 'false' },
    { isPlaying: true, reducedMotion: false, terminal: true, active: 'false' },
  ])('gates repeating effects for playback $isPlaying, reduced motion $reducedMotion, terminal $terminal', ({ isPlaying, reducedMotion, terminal, active }) => {
    render(<AdvancedCityWorld scene={getAdvancedChapterScene(2)} events={[]} cursor={-1}
      pendingRerun={false} isPlaying={isPlaying} reducedMotion={reducedMotion}
      {...(terminal ? { runStatus: 'succeeded' as const } : {})} onInspect={vi.fn()} />)
    expect(document.querySelector('[data-advanced-city]')).toHaveAttribute('data-city-motion-active', active)
  })

  it('exposes every facility as a named keyboard-operable button', () => {
    const onInspect = vi.fn()
    renderWorld({ onInspect })

    const producer = screen.getByRole('button', { name: '출발지 (Source / Producer), 대기' })
    expect(producer).toHaveAttribute('data-city-node', 'slot-source')
    expect(producer.getAttribute('class')).not.toContain('undefined')
    expect(producer).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(producer, { key: 'Enter' })
    fireEvent.keyDown(producer, { key: ' ' })

    expect(onInspect).toHaveBeenNthCalledWith(1, 'slot-source')
    expect(onInspect).toHaveBeenNthCalledWith(2, 'slot-source')
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
    expect(document.querySelector('[data-city-carrier="vehicle"]')).toHaveAttribute('data-carrier-cue-count', '3')
    expect(screen.getByText('메시지 흐름 요약')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-city-carrier]')).toHaveLength(1)
    expect(document.querySelector('[data-city-barrier="closed"]')).toBeInTheDocument()
    expect(document.querySelector('[data-city-hud-item="barrier-closed"]')).toBeInTheDocument()
    expect(document.querySelector('[data-city-barrier="closed"] text')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /애플리케이션 \(Application \/ Sink\), 실패/ })).toBeInTheDocument()
  })

  it('renders the return signal and completed facilities after the recommended run', () => {
    const succeededRun = makeRun('stable-customer-key')
    renderWorld({ run: succeededRun, cursor: succeededRun.events.length - 1 })

    expect(document.querySelector('[data-city-signal="ack"]')).toBeInTheDocument()
    expect(document.querySelector('[data-city-hud-item="signal-ack"]')).toBeInTheDocument()
    expect(document.querySelector('[data-city-hud-item="barrier-open"]')).toBeInTheDocument()
    expect(document.querySelector('[data-city-barrier="open"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /애플리케이션 \(Application \/ Sink\), 완료/ })).toBeInTheDocument()
  })

  it('defaults to a focused road camera and preserves full atlas in overview mode', () => {
    renderWorld()
    expect(document.querySelector('[data-advanced-city]')).toHaveAttribute('data-city-view-mode', 'focus')
    expect(document.querySelector('[data-city-world]')).not.toHaveAttribute('viewBox', '0 0 1920 1047')

    cleanup()
    renderWorld({ viewMode: 'overview' })

    expect(document.querySelector('[data-city-world]')).toHaveAttribute(
      'preserveAspectRatio',
      'xMidYMid meet',
    )
    expect(document.querySelector('[data-city-world]')).toHaveAttribute('viewBox', '0 0 1920 1047')
  })

  it('marks previewed physical facilities and logical nodes before execution', () => {
    const scene = getAdvancedChapterScene(2)
    render(
      <AdvancedCityWorld
        scene={scene}
        events={[]}
        cursor={-1}
        pendingRerun={false}
        reducedMotion={false}
        preview={{ nodeIds: ['partition-p1'], routeIds: ['producer-p1'] }}
        onInspect={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-city-facility-slot="slot-cluster"] [data-city-node="slot-cluster"]')).toHaveClass(/previewFacility/)
    expect(document.querySelector('[data-logical-node="partition-p1"]')).toHaveAttribute('data-logical-preview', 'true')
    expect(document.querySelector('[data-logical-node="partition-p0"]')).toHaveAttribute('data-logical-preview', 'false')
    expect(document.querySelector('[data-city-route="producer-p1"]')).toHaveClass(/previewRoute/)
  })

  it('keeps the consumer sign below its road checkpoint', () => {
    const scene = getAdvancedChapterScene(6)
    render(<AdvancedCityWorld scene={scene} events={[]} cursor={-1} pendingRerun={false} reducedMotion={true} onInspect={vi.fn()} />)
    const sign = document.querySelector('[data-city-node="slot-consumer"] g[class*="facilitySign"]')
    const y = Number(sign?.getAttribute('transform')?.match(/translate\([^ ]+ ([^)]+)\)/)?.[1])
    expect(y).toBeGreaterThan(scene.mainRoad.points[3]!.y + 80)
  })

  it('marks the world as reduced motion when the app preference is enabled', () => {
    renderWorld({ reducedMotion: true })

    expect(document.querySelector('[data-city-world]')).toHaveAttribute('data-reduced-motion', 'true')
    expect(document.querySelector('[data-city-world]')).toHaveClass('city-world-reduced-motion')
  })

  it('positions the carrier from externally provided road progress', () => {
    const succeededRun = makeRun('stable-customer-key')
    renderWorld({ run: succeededRun, cursor: succeededRun.events.length - 1, carrierProgress: 0.5 })

    const carrier = document.querySelector('[data-city-carrier="vehicle"]')
    expect(carrier).toHaveAttribute('data-motion-mode', 'external')
    expect(carrier).toHaveAttribute('data-carrier-direction', 'forward')
    expect(carrier).toHaveAttribute('data-carrier-progress', '0.500')
    expect(carrier?.querySelector('animateMotion')).not.toBeInTheDocument()
  })

  it('does not create local animation state when the carrier changes routes', () => {
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
        pendingRerun={false}
        reducedMotion={false}
        onInspect={vi.fn()}
      />,
    )

    const carrier = document.querySelector('[data-city-carrier="vehicle"]')
    expect(carrier).toHaveAttribute('data-motion-mode', 'external')
    expect(carrier?.querySelector('animateMotion')).not.toBeInTheDocument()
  })

  it('keeps each physical facility inspection target stable as logical states change', () => {
    const run = makeRun('random-key-per-record')
    const scene = getAdvancedChapterScene(2)
    const { rerender } = render(
      <AdvancedCityWorld
        scene={scene}
        events={run.events}
        cursor={-1}
        pendingRerun={false}
        reducedMotion={false}
        onInspect={vi.fn()}
      />,
    )

    expect(document.querySelector('[data-city-node="slot-cluster"]')).toBeInTheDocument()
    rerender(
      <AdvancedCityWorld
        scene={scene}
        events={run.events}
        cursor={run.events.length - 1}
        pendingRerun={false}
        reducedMotion={false}
        onInspect={vi.fn()}
      />,
    )
    expect(document.querySelector('[data-city-node="slot-cluster"]')).toBeInTheDocument()
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
