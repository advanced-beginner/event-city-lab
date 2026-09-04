import { afterEach, describe, expect, it, vi } from 'vitest'

type PreviewTarget = {
  use?: { baseURL?: string }
  webServer?: { url?: string; command?: string }
}

const loadPreviewTarget = async (): Promise<PreviewTarget> => {
  vi.resetModules()
  const loaded = (await import('./playwright.config')) as { default: PreviewTarget }
  return loaded.default
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('playwright preview target', () => {
  it('falls back to port 4173 when ECL_PORT is unset', async () => {
    vi.stubEnv('ECL_PORT', undefined)

    const config = await loadPreviewTarget()

    expect(config.use?.baseURL).toBe('http://127.0.0.1:4173/event-city-lab/')
    expect(config.webServer?.url).toBe('http://127.0.0.1:4173/event-city-lab/')
    expect(config.webServer?.command).toContain('--port 4173')
  })

  it('uses ECL_PORT for baseURL, webServer url and webServer command', async () => {
    vi.stubEnv('ECL_PORT', '4199')

    const config = await loadPreviewTarget()

    expect(config.use?.baseURL).toBe('http://127.0.0.1:4199/event-city-lab/')
    expect(config.webServer?.url).toBe('http://127.0.0.1:4199/event-city-lab/')
    expect(config.webServer?.command).toContain('--port 4199')
  })

  it('pins the preview server to the requested port with --strictPort', async () => {
    vi.stubEnv('ECL_PORT', '4199')

    const config = await loadPreviewTarget()

    expect(config.webServer?.command).toContain('--strictPort')
  })
})
