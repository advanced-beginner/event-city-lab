import { expect, test, type Page } from '@playwright/test'

const chapters = [2, 3, 4, 5, 6, 7, 8] as const
const complexChapters = new Set<number>([2, 4, 6, 8])

async function settleVisuals(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

async function seekToTerminalEvent(page: Page) {
  const timeline = page.getByRole('region', { name: '이벤트 타임라인' })
  await expect(timeline.locator('div > button').first()).toBeVisible()
  // Selecting a timeline event pauses playback itself. Avoid racing the
  // transient play/pause label when a short run reaches its terminal event.
  await timeline.locator('div > button').last().click()
  await settleVisuals(page)
}

async function expectWorldScreenshot(page: Page, name: string) {
  await expect(page.locator('[data-city-world]')).toHaveScreenshot(name, {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  })
}

for (const chapterId of chapters) {
  test(`Chapter ${chapterId} city visual states`, async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.CI), 'Darwin visual baselines are reviewed locally; semantic bounds remain enforced in CI.')
    const isChromium = testInfo.project.name.startsWith('chromium-')
    const isPrimary = testInfo.project.name === 'chromium-1440x900'
    const isAdditional = complexChapters.has(chapterId)
      && (testInfo.project.name === 'chromium-1280x720'
        || testInfo.project.name === 'chromium-1920x1080')
    test.skip(!isChromium || (!isPrimary && !isAdditional), 'Visual baselines are scoped to approved Chromium viewports.')

    await page.addInitScript(() => localStorage.setItem('ecl:reduced-motion', 'true'))
    await page.goto(`#/chapter/${chapterId}`)
    await settleVisuals(page)

    if (isPrimary) await expectWorldScreenshot(page, `chapter-${chapterId}-initial.png`)

    await page.getByRole('button', { name: '실패한다' }).click()
    await page.getByRole('button', { name: /예측한 조건 실행|같은 조건으로 재실행/ }).click()
    await seekToTerminalEvent(page)
    await expect(page.locator('[data-city-barrier="closed"]')).toBeVisible()
    await expectWorldScreenshot(page, `chapter-${chapterId}-failed.png`)

    await page.getByRole('button', { name: '권장 설정 적용' }).click({ force: true })
    await page.getByRole('button', { name: '같은 조건으로 재실행' }).click()
    await seekToTerminalEvent(page)
    await expect(page.locator('[data-city-signal]')).toBeVisible()
    await expectWorldScreenshot(page, `chapter-${chapterId}-succeeded.png`)
  })
}
