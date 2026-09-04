import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const root = process.env.TICK_ROOT
const out = process.env.TICK_OUT
const port = process.env.TICK_PORT ?? '4199'
const chapters = (process.env.TICK_CHAPTERS ?? '1,2,6').split(',').map((value) => Number(value.trim())).filter(Boolean)

if (!root || !out) {
  console.error('TICK_ROOT and TICK_OUT are required')
  process.exit(2)
}

const require = createRequire(`${root}/package.json`)
const { chromium } = require('playwright')

const base = `http://127.0.0.1:${port}/event-city-lab/`
const viewports = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

const findings = []

async function settle(page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(200)
}

async function measure(page) {
  return page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    overflowY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
  }))
}

async function shot(page, chapter, state, errors) {
  const vp = page.viewportSize()
  const file = `${out}/ch${chapter}-${state}-${vp.width}x${vp.height}.png`
  await settle(page)
  await page.screenshot({ path: file })
  const overflow = await measure(page)
  findings.push({ chapter, state, viewport: `${vp.width}x${vp.height}`, file, ...overflow, errors: [...errors] })
  errors.length = 0
}

async function seekLast(page, regionName) {
  const nodes = page.locator(`section[aria-label="${regionName}"] button`).filter({ has: page.locator('small') })
  await nodes.first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(150)
  await nodes.last().click()
}

async function chapterOne(page, errors) {
  await page.goto(`${base}#/chapter/1`)
  await shot(page, 1, 'initial', errors)
  await page.getByRole('button', { name: /첫 메시지 보내기/ }).click()
  await seekLast(page, '실행 타임라인')
  await shot(page, 1, 'failed', errors)
  await page.locator('#serializer').selectOption('json')
  await shot(page, 1, 'pending', errors)
  await page.getByRole('button', { name: /같은 메시지 다시 보내기/ }).click()
  await seekLast(page, '실행 타임라인')
  await shot(page, 1, 'succeeded', errors)
}

async function guided(page, chapter, errors) {
  await page.goto(`${base}#/chapter/${chapter}`)
  await shot(page, chapter, 'initial', errors)
  await page.getByRole('button', { name: '실패한다' }).click()
  await page.getByRole('button', { name: /예측한 조건 실행|같은 조건으로 재실행/ }).click()
  await seekLast(page, '이벤트 타임라인')
  await shot(page, chapter, 'failed', errors)
  await page.getByRole('button', { name: '권장 설정 적용' }).click({ force: true })
  await shot(page, chapter, 'pending', errors)
  await page.getByRole('button', { name: '같은 조건으로 재실행' }).click()
  await seekLast(page, '이벤트 타임라인')
  await shot(page, chapter, 'succeeded', errors)
}

const browser = await chromium.launch()
let failed = false
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce', locale: 'ko-KR' })
    await context.addInitScript(() => {
      try { localStorage.setItem('ecl:reduced-motion', 'true') } catch {}
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
    try {
      for (const chapter of chapters) {
        if (chapter === 1) await chapterOne(page, errors)
        else await guided(page, chapter, errors)
      }
    } catch (error) {
      failed = true
      findings.push({ viewport: `${viewport.width}x${viewport.height}`, fatal: error instanceof Error ? error.message : String(error) })
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

const problems = findings.filter((finding) => finding.fatal || finding.overflowX || finding.overflowY || (finding.errors?.length ?? 0) > 0)
const result = {
  capturedAt: new Date().toISOString(),
  base,
  chapters,
  captures: findings.length,
  problems: problems.length,
  findings,
}
writeFileSync(`${out}/capture-result.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
process.exit(failed || problems.length > 0 ? 1 : 0)
