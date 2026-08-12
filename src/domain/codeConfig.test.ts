import { describe, expect, it } from 'vitest'

import { configToJava, javaToConfig } from './codeConfig'
import { DEFAULT_CONFIG } from './simulation'

describe('Java configuration bridge', () => {
  it('reflects a panel serializer change in generated code', () => {
    expect(configToJava({ ...DEFAULT_CONFIG, serializer: 'json' })).toContain('JsonSerializer.class')
  })

  it('reflects a supported code change back into the panel config', () => {
    const code = configToJava(DEFAULT_CONFIG).replace('StringSerializer.class', 'JsonSerializer.class')
    const parsed = javaToConfig(code, DEFAULT_CONFIG)

    expect(parsed.config.serializer).toBe('json')
    expect(parsed.warnings).toEqual([])
  })

  it('keeps the previous setting and reports unsupported code', () => {
    const parsed = javaToConfig('producer.send(event);', DEFAULT_CONFIG)

    expect(parsed.config).toEqual(DEFAULT_CONFIG)
    expect(parsed.warnings).toHaveLength(2)
  })
})
