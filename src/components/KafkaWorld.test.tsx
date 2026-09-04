import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CONFIG, DEFAULT_MESSAGE, type SimulationRun } from '../domain/simulation'
import { simulateProducerSend } from '../domain/engine'
import { KafkaWorld } from './KafkaWorld'

const SAFE_LEFT = 120
const SAFE_RIGHT = 880

function translateX(element: Element | null | undefined): number {
  const match = /translate\(\s*(-?[\d.]+)/.exec(element?.getAttribute('transform') ?? '')
  if (!match) throw new Error('Expected a translated overlay group.')
  return Number(match[1])
}

function groupSpan(text: string): { left: number; right: number } {
  const label = [...document.querySelectorAll('[data-city-world] text')]
    .find((node) => node.textContent?.includes(text))
  const group = label?.parentElement
  const width = Number(group?.querySelector('rect')?.getAttribute('width') ?? NaN)
  const left = translateX(group)
  return { left, right: left + width }
}

function pathSpan(selector: string): { left: number; right: number } {
  const commands = document.querySelector(selector)?.getAttribute('d') ?? ''
  const xs = [...commands.matchAll(/[MH]\s*(-?[\d.]+)/g)].map((match) => Number(match[1]))
  if (xs.length === 0) throw new Error('Expected horizontal coordinates in the hit area path.')
  return { left: Math.min(...xs), right: Math.max(...xs) }
}

function makeRun(serializer: 'string' | 'json'): SimulationRun {
  return simulateProducerSend({
    runId: `run-${serializer}`,
    seed: 2401,
    message: DEFAULT_MESSAGE,
    config: { ...DEFAULT_CONFIG, serializer },
  })
}

function renderWorld({
  run = null,
  cursor = -1,
  pendingRerun = false,
  onInspect = vi.fn(),
}: {
  run?: SimulationRun | null
  cursor?: number
  pendingRerun?: boolean
  onInspect?: (component: 'producer' | 'serializer' | 'rail' | 'broker' | 'ack') => void
} = {}) {
  render(
    <KafkaWorld
      run={run}
      activeEvent={run?.events[cursor] ?? null}
      cursor={cursor}
      attempt={run ? 1 : 0}
      reducedMotion={false}
      focusedSetting={null}
      pendingRerun={pendingRerun}
      onInspect={onInspect}
    />,
  )
}

describe('KafkaWorld', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders every facility as idle before the first run starts', () => {
    renderWorld()

    expect(screen.getByRole('button', { name: 'Producer 출발센터, 대기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Serializer 검사소, 대기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Broker 기록센터, 대기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Producer 도착 문자/ })).not.toBeInTheDocument()
  })

  it('renders the Serializer failure marker without an ACK when serialization fails', () => {
    const failedRun = makeRun('string')

    renderWorld({ run: failedRun, cursor: failedRun.events.length - 1 })

    expect(screen.getByRole('button', { name: 'Serializer 검사소, 실패' })).toBeInTheDocument()
    expect(screen.getByText('2 · OrderEvent ≠ StringSerializer')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Producer 도착 문자/ })).not.toBeInTheDocument()
  })

  it('keeps the failure marker visible while a repaired setting is pending rerun', () => {
    const failedRun = makeRun('string')

    renderWorld({ run: failedRun, cursor: failedRun.events.length - 1, pendingRerun: true })

    expect(screen.getByRole('button', { name: 'Serializer 검사소, 실패' })).toBeInTheDocument()
    expect(screen.getByText('2 · OrderEvent ≠ StringSerializer')).toBeInTheDocument()
  })

  it('renders the ACK only after the ACK event has occurred', () => {
    const succeededRun = makeRun('json')

    renderWorld({ run: succeededRun, cursor: 8 })

    expect(screen.getByRole('button', { name: 'Producer 도착 문자, 완료' })).toBeInTheDocument()
  })

  it('hides the ACK when the cursor is before the ACK event', () => {
    const succeededRun = makeRun('json')

    renderWorld({ run: succeededRun, cursor: 6 })

    expect(screen.queryByRole('button', { name: /Producer 도착 문자/ })).not.toBeInTheDocument()
  })

  it('fills the Chapter 1 panel by cropping the approved background instead of letterboxing it', () => {
    renderWorld()

    expect(document.querySelector('[data-city-world]')).toHaveAttribute(
      'preserveAspectRatio',
      'xMidYMid slice',
    )
  })

  it('keeps the city label inside the horizontal safe zone that survives cropping', () => {
    renderWorld()

    const label = groupSpan('EVENT CITY · BUILDING MAP')

    expect(label.left).toBeGreaterThanOrEqual(SAFE_LEFT)
    expect(label.right).toBeLessThanOrEqual(SAFE_RIGHT)
  })

  it('keeps the arrival message and its hit area inside the horizontal safe zone', () => {
    const succeededRun = makeRun('json')

    renderWorld({ run: succeededRun, cursor: 8 })

    const bubble = groupSpan('기록 완료 문자가 도착했습니다')
    const hitArea = pathSpan('[data-city-node="ack"] > path')

    expect(bubble.left).toBeGreaterThanOrEqual(SAFE_LEFT)
    expect(bubble.right).toBeLessThanOrEqual(SAFE_RIGHT)
    expect(hitArea.left).toBeGreaterThanOrEqual(SAFE_LEFT)
    expect(hitArea.right).toBeLessThanOrEqual(SAFE_RIGHT)
  })

  it('calls inspection for Enter and Space on a facility', () => {
    const onInspect = vi.fn()
    const failedRun = makeRun('string')
    renderWorld({ run: failedRun, cursor: failedRun.events.length - 1, onInspect })

    const serializer = screen.getByRole('button', { name: 'Serializer 검사소, 실패' })
    fireEvent.keyDown(serializer, { key: 'Enter' })
    fireEvent.keyDown(serializer, { key: ' ' })

    expect(onInspect).toHaveBeenNthCalledWith(1, 'serializer')
    expect(onInspect).toHaveBeenNthCalledWith(2, 'serializer')
  })
})
