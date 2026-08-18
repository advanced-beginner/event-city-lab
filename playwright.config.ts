import { defineConfig, devices } from '@playwright/test'

const viewports = [
  { name: '1280x720', viewport: { width: 1280, height: 720 } },
  { name: '1440x900', viewport: { width: 1440, height: 900 } },
  { name: '1920x1080', viewport: { width: 1920, height: 1080 } },
] as const

const browsers = [
  { name: 'chromium', use: devices['Desktop Chrome'] },
  { name: 'firefox', use: devices['Desktop Firefox'] },
  { name: 'webkit', use: devices['Desktop Safari'] },
] as const

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173/event-city-lab/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: browsers.flatMap((browser) =>
    viewports.map(({ name, viewport }) => ({
      name: `${browser.name}-${name}`,
      use: {
        ...browser.use,
        viewport,
      },
    })),
  ),
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/event-city-lab/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
