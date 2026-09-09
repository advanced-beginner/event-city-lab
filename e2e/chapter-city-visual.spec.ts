import { expect, test, type Page } from '@playwright/test'

declare const process: { env: Record<string, string | undefined> }

const chapters = [2, 3, 4, 5, 6, 7, 8] as const
const complexChapters = new Set<number>([2, 4, 6, 8])

async function settleVisuals(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

async function pageOverflow(page: Page) {
  return page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    vertical: document.documentElement.scrollHeight > document.documentElement.clientHeight,
  }))
}

async function seekToTerminalEvent(page: Page) {
  const timeline = page.getByRole('region', { name: '이벤트 타임라인' })
  await expect(timeline.locator('div > button').first()).toBeVisible()
  await timeline.locator('div > button').last().click()
  await settleVisuals(page)
}

async function expectWorldScreenshot(page: Page, name: string) {
  await expect(page.locator('[data-advanced-city]')).toHaveScreenshot(name, {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  })
}

async function advancedCityGeometry(page: Page) {
  return page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>('[data-advanced-city]')
    const svg = document.querySelector<SVGSVGElement>('[data-city-world]')
    const hud = document.querySelector<HTMLElement>('[data-city-hud]')
    const background = svg
      ? [...svg.children].find((child): child is SVGImageElement => child.tagName.toLowerCase() === 'image') ?? null
      : null
    const nodes = svg ? [...svg.querySelectorAll<SVGGraphicsElement>('[data-city-node]')] : []
    const wrapperBox = wrapper?.getBoundingClientRect()
    const svgBox = svg?.getBoundingClientRect()
    const hudBox = hud?.getBoundingClientRect()
    const nodeBoxes = nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return {
        id: node.getAttribute('data-city-node') ?? '',
        bottom: box.bottom,
        left: box.left,
        right: box.right,
        top: box.top,
      }
    })
    const nodeBoundsViolations = svgBox
      ? nodeBoxes
        .filter((box) => (
          box.left < svgBox.left - 1
          || box.top < svgBox.top - 1
          || box.right > svgBox.right + 1
          || box.bottom > svgBox.bottom + 1
        ))
        .map((box) => box.id)
      : ['missing-svg']
    const nodeOverlaps: string[] = []
    for (let leftIndex = 0; leftIndex < nodeBoxes.length; leftIndex += 1) {
      const left = nodeBoxes[leftIndex]
      if (!left) continue
      for (let rightIndex = leftIndex + 1; rightIndex < nodeBoxes.length; rightIndex += 1) {
        const right = nodeBoxes[rightIndex]
        if (!right) continue
        const width = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
        const height = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top))
        const leftArea = Math.max(1, (left.right - left.left) * (left.bottom - left.top))
        const rightArea = Math.max(1, (right.right - right.left) * (right.bottom - right.top))
        if ((width * height) / Math.min(leftArea, rightArea) > 0.55) {
          nodeOverlaps.push(`${left.id}/${right.id}`)
        }
      }
    }
    return {
      background: {
        height: background?.getAttribute('height') ?? null,
        width: background?.getAttribute('width') ?? null,
      },
      hudOutsideSvg: hud ? !hud.closest('svg') : true,
      hudSeparatedFromMap: !hudBox || !svgBox || hudBox.bottom <= svgBox.top + 1,
      hudWithinWrapper: hud ? Boolean(
          hudBox
          && wrapperBox
          && hudBox.left >= wrapperBox.left - 1
          && hudBox.right <= wrapperBox.right + 1
          && hudBox.top >= wrapperBox.top - 1
          && hudBox.bottom <= wrapperBox.bottom + 1,
        ) : true,
      nodeBoundsViolations,
      nodeCount: nodes.length,
      nodeOverlaps,
      svgWithinWrapper: Boolean(
        svgBox
        && wrapperBox
        && svgBox.left >= wrapperBox.left - 1
        && svgBox.right <= wrapperBox.right + 1
        && svgBox.top >= wrapperBox.top - 1
        && svgBox.bottom <= wrapperBox.bottom + 1,
      ),
      viewBox: svg?.getAttribute('viewBox') ?? null,
    }
  })
}

async function expectCityReadableAndContained(page: Page) {
  const geometry = await advancedCityGeometry(page)
  expect(geometry.background).toEqual({ width: '1920', height: '1047' })
  expect(geometry.hudOutsideSvg).toBe(true)
  expect(geometry.hudSeparatedFromMap).toBe(true)
  expect(geometry.hudWithinWrapper).toBe(true)
  expect(geometry.svgWithinWrapper).toBe(true)
  expect(geometry.nodeCount).toBeGreaterThanOrEqual(3)
  expect(geometry.nodeCount).toBeLessThanOrEqual(5)
  expect(geometry.nodeBoundsViolations).toEqual([])
  expect(geometry.nodeOverlaps).toEqual([])
}

async function expectPrimaryFacilityLabelsReadable(page: Page) {
  const labels = await page.locator('[data-city-node]').evaluateAll((nodes) => nodes
    .flatMap((node) => [
      node.querySelector<SVGTextElement>('text'),
      [...node.querySelectorAll<SVGTextElement>('text')]
        .find((text) => text.getAttribute('class')?.includes('facilityStateText')) ?? null,
    ])
    .map((label) => {
      if (!label?.textContent?.trim()) return null
      const matrix = label.getScreenCTM()
      const scale = matrix ? Math.hypot(matrix.a, matrix.b) : 1
      return {
        size: Number.parseFloat(getComputedStyle(label).fontSize) * scale,
        text: label.textContent.trim(),
      }
    })
    .filter((label): label is { size: number; text: string } => label !== null))
  expect(labels.length).toBeGreaterThan(0)
  for (const label of labels) {
    expect(label.size, label.text).toBeGreaterThanOrEqual(12)
  }
}

async function expectGroupedLogicalNodesExposed(page: Page) {
  const facilityId = await page.locator('[data-city-node]').evaluateAll((nodes) => nodes
    .find((node) => (node.getAttribute('aria-label') ?? '').split(',').length >= 3)
    ?.getAttribute('data-city-node'))
  expect(facilityId).toBeTruthy()
  await page.locator(`[data-city-node="${facilityId}"]`).click()
  const picker = page.getByRole('group', { name: '건물 내부 논리 노드' })
  await expect(picker).toBeVisible()
  expect(await picker.getByRole('button').count()).toBeGreaterThanOrEqual(2)
}

for (const chapterId of chapters) {
  test(`Chapter ${chapterId} city visual states`, async ({ page }, testInfo) => {
    test.setTimeout(90_000)
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

  test(`Chapter ${chapterId} focus camera and city HUD stay readable`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ecl:reduced-motion', 'true'))
    await page.goto(`#/chapter/${chapterId}`)
    await settleVisuals(page)

    await expect(page.locator('[data-advanced-city]')).toBeVisible()
    await expect(page.getByRole('button', { name: '핵심 도로' })).toHaveAttribute('aria-pressed', 'true')
    const focusViewBox = await page.locator('[data-city-world]').getAttribute('viewBox')
    expect(focusViewBox).not.toBe('0 0 1920 1047')
    await expectCityReadableAndContained(page)
    await expectPrimaryFacilityLabelsReadable(page)
    expect(await pageOverflow(page)).toEqual({ horizontal: false, vertical: false })

    await page.getByRole('button', { name: '전체 지도' }).click()
    await expect(page.locator('[data-city-world]')).toHaveAttribute('viewBox', '0 0 1920 1047')
    await expect(page.getByRole('button', { name: '전체 지도' })).toHaveAttribute('aria-pressed', 'true')
    await expectCityReadableAndContained(page)
    expect(await pageOverflow(page)).toEqual({ horizontal: false, vertical: false })
  })
}

for (const chapterId of complexChapters) {
  test(`Chapter ${chapterId} terminal and dense facilities stay contained`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ecl:reduced-motion', 'true'))
    await page.goto(`#/chapter/${chapterId}`)
    await settleVisuals(page)

    if (chapterId !== 8) await expectGroupedLogicalNodesExposed(page)
    await expectCityReadableAndContained(page)

    await page.getByRole('button', { name: '실패한다' }).click()
    await page.getByRole('button', { name: /예측한 조건 실행|같은 조건으로 재실행/ }).click()
    await seekToTerminalEvent(page)
    await expect(page.locator('[data-advanced-city]')).toHaveAttribute('data-city-run-status', 'failed')
    await expect(page.locator('[data-city-barrier="closed"]')).toBeVisible()
    await expectCityReadableAndContained(page)
  })
}
