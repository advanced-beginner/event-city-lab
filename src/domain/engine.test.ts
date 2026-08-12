import { describe, expect, it } from 'vitest'

import { simulateProducerSend } from './engine'
import { DEFAULT_CONFIG, DEFAULT_MESSAGE } from './simulation'

describe('simulateProducerSend', () => {
  it('fails before network dispatch when the serializer is incompatible', () => {
    const result = simulateProducerSend({
      runId: 'run-1',
      seed: 2401,
      message: DEFAULT_MESSAGE,
      config: DEFAULT_CONFIG,
    })

    expect(result.status).toBe('failed')
    expect(result.events.at(-1)?.kind).toBe('serializer.rejected')
    expect(result.events.some((event) => event.kind === 'broker.received')).toBe(false)
    expect(result.diagnosis?.setting).toBe('serializer')
  })

  it('replays deterministically with the same input', () => {
    const input = {
      runId: 'run-stable',
      seed: 2401,
      message: DEFAULT_MESSAGE,
      config: { ...DEFAULT_CONFIG, serializer: 'json' as const },
    }

    expect(simulateProducerSend(input)).toEqual(simulateProducerSend(input))
  })

  it('appends and acknowledges a JSON-serialized message', () => {
    const result = simulateProducerSend({
      runId: 'run-2',
      seed: 2401,
      message: DEFAULT_MESSAGE,
      config: { ...DEFAULT_CONFIG, serializer: 'json' },
    })

    expect(result.status).toBe('succeeded')
    expect(result.events.map((event) => event.kind)).toContain('broker.appended')
    expect(result.events.map((event) => event.kind)).toContain('ack.returned')
    expect(result.diagnosis).toBeNull()
  })
})
