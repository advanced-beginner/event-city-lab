import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CONFIG, DEFAULT_MESSAGE, type SimulationRun } from '../domain/simulation'
import { simulateProducerSend } from '../domain/engine'
import { KafkaWorld } from './KafkaWorld'

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
