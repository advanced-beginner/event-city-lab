import { expect, test, type Page } from '@playwright/test'

const chapters = [1, 2, 3, 4, 5, 6, 7, 8] as const

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
  const events = timeline.locator('[data-timeline-events] > button')
  await expect(events.first()).toBeVisible()
  const pause = timeline.getByRole('button', { name: '일시정지' })
  if (await pause.isVisible()) await pause.click()
  await events.last().click()
  await settleVisuals(page)
}

async function dioramaGeometry(page: Page) {
  return page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>('[data-diorama-stage]')
    const svg = document.querySelector<SVGSVGElement>('[data-city-world]')
    const hud = document.querySelector<HTMLElement>('[data-city-hud]')
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
          box.left < svgBox.left - 4
          || box.top < svgBox.top - 4
          || box.right > svgBox.right + 4
          || box.bottom > svgBox.bottom + 4
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
        if ((width * height) / Math.min(leftArea, rightArea) > 0.45) {
          nodeOverlaps.push(`${left.id}/${right.id}`)
        }
      }
    }

    return {
      bitmapImages: svg ? svg.querySelectorAll('image').length : -1,
      hudOutsideSvg: hud ? !hud.closest('svg') : true,
      hudSeparatedFromMap: !hudBox || !svgBox || hudBox.bottom <= svgBox.top + 4,
      hudWithinWrapper: hud
        ? Boolean(
            hudBox
            && wrapperBox
            && hudBox.left >= wrapperBox.left - 1
            && hudBox.right <= wrapperBox.right + 1
            && hudBox.top >= wrapperBox.top - 1
            && hudBox.bottom <= wrapperBox.bottom + 1,
          )
        : true,
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

async function expectDioramaHealthy(page: Page) {
  const geometry = await dioramaGeometry(page)
  expect(geometry.bitmapImages).toBe(0)
  expect(geometry.hudOutsideSvg).toBe(true)
  expect(geometry.hudSeparatedFromMap).toBe(true)
  expect(geometry.hudWithinWrapper).toBe(true)
  expect(geometry.svgWithinWrapper).toBe(true)
  expect(geometry.nodeCount).toBeGreaterThanOrEqual(3)
  expect(geometry.nodeBoundsViolations).toEqual([])
  expect(geometry.nodeOverlaps).toEqual([])
}

for (const chapterId of chapters) {
  test(`Chapter ${chapterId} isometric diorama layout, focus/overview, and HUD remain clean`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ecl:reduced-motion', 'true'))
    await page.goto(`#/chapter/${chapterId}`)
    await settleVisuals(page)

    await expect(page.locator('[data-diorama-stage]')).toBeVisible()
    await expect(page.getByRole('button', { name: '핵심 도로' })).toHaveAttribute('aria-pressed', 'true')
    const focusViewBox = await page.locator('[data-city-world]').getAttribute('viewBox')
    expect(focusViewBox).toBeTruthy()
    await expectDioramaHealthy(page)
    expect(await pageOverflow(page)).toEqual({ horizontal: false, vertical: false })

    await page.getByRole('button', { name: '전체 지도' }).click()
    await expect(page.locator('[data-city-world]')).toHaveAttribute('viewBox', '0 0 1600 900')
    await expect(page.getByRole('button', { name: '전체 지도' })).toHaveAttribute('aria-pressed', 'true')
    await expectDioramaHealthy(page)
    expect(await pageOverflow(page)).toEqual({ horizontal: false, vertical: false })

    if (chapterId >= 2) {
      await page.getByRole('button', { name: '핵심 도로' }).click()
      await page.getByRole('button', { name: '실패한다' }).click()
      await page.getByRole('button', { name: /예측한 조건 실행|같은 조건으로 재실행/ }).click()
      await seekToTerminalEvent(page)
      await expect(page.locator('[data-city-barrier="closed"]')).toBeVisible()
      await expectDioramaHealthy(page)
    }
  })
}
