import { expect, test } from '@playwright/test'

async function pageOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    vertical: document.documentElement.scrollHeight > document.documentElement.clientHeight,
  }))
}

async function seekToTerminalEvent(page: import('@playwright/test').Page) {
  const timeline = page.getByRole('region', { name: '이벤트 타임라인' })
  await expect(timeline.locator('div > button').first()).toBeVisible()
  const pause = timeline.getByRole('button', { name: '일시정지' })
  if (await pause.isVisible()) await pause.click()
  await timeline.locator('div > button').last().click()
}

async function expectWorldElementsInsideSvg(page: import('@playwright/test').Page) {
  const result = await page.evaluate(() => {
    const world = document.querySelector<SVGSVGElement>('[data-city-world]')
    if (!world) return { bounds: ['Kafka city world SVG is missing.'], overlaps: [] }
    const rootGeometry = (element: SVGGraphicsElement) => {
      const local = element.getBBox()
      const elementMatrix = element.getCTM()
      const worldMatrix = world.getCTM()
      const matrix = elementMatrix && worldMatrix
        ? worldMatrix.inverse().multiply(elementMatrix)
        : null
      const points = matrix
        ? [
            new DOMPoint(local.x, local.y).matrixTransform(matrix),
            new DOMPoint(local.x + local.width, local.y).matrixTransform(matrix),
            new DOMPoint(local.x, local.y + local.height).matrixTransform(matrix),
            new DOMPoint(local.x + local.width, local.y + local.height).matrixTransform(matrix),
          ]
        : []
      const x = Math.min(...points.map((point) => point.x))
      const y = Math.min(...points.map((point) => point.y))
      const right = Math.max(...points.map((point) => point.x))
      const bottom = Math.max(...points.map((point) => point.y))
      return { x, y, right, bottom, width: right - x, height: bottom - y }
    }
    const selectors = [
      '[data-city-node]',
      '[data-city-carrier]',
      '[data-city-signal]',
      '[data-city-barrier]',
    ]
    const bounds = [...document.querySelectorAll<SVGGraphicsElement>(selectors.join(','))]
      .map((element) => {
        const box = rootGeometry(element)
        const id = element.getAttribute('data-city-node')
          ?? element.getAttribute('data-city-carrier')
          ?? element.getAttribute('data-city-signal')
          ?? element.getAttribute('data-city-barrier')
          ?? element.tagName
        const visible = box.width > 0 && box.height > 0
        // Transform fill geometry into the root viewBox. This excludes
        // Firefox's filter expansion while preserving carrier transforms.
        const viewBox = world.viewBox.baseVal
        const inside = box.x >= viewBox.x - 1
          && box.y >= viewBox.y - 1
          && box.right <= viewBox.x + viewBox.width + 1
          && box.bottom <= viewBox.y + viewBox.height + 1
        return visible && inside
          ? null
          : `${id}: visible=${visible}, inside=${inside}, box=${box.x.toFixed(1)}/${box.y.toFixed(1)}/${box.right.toFixed(1)}/${box.bottom.toFixed(1)}, viewBox=${viewBox.x}/${viewBox.y}/${viewBox.width}/${viewBox.height}`
      })
      .filter((violation): violation is string => violation !== null)

    const labels = [...document.querySelectorAll<SVGGraphicsElement>([
      '[data-city-node] > g',
      '[data-city-carrier] > g:last-child',
      '[data-city-signal] > g',
      '[data-city-barrier] > g',
    ].join(','))]
      .map((element, index) => ({
        id: `${element.parentElement?.getAttribute('data-city-node')
          ?? element.parentElement?.getAttribute('data-city-carrier')
          ?? element.parentElement?.getAttribute('data-city-signal')
          ?? element.parentElement?.getAttribute('data-city-barrier')
          ?? element.tagName}-${index}`,
        box: rootGeometry(element),
      }))
      .filter(({ box }) => box.width > 0 && box.height > 0)
    const overlaps: string[] = []
    for (let leftIndex = 0; leftIndex < labels.length; leftIndex += 1) {
      const left = labels[leftIndex]
      if (!left) continue
      for (let rightIndex = leftIndex + 1; rightIndex < labels.length; rightIndex += 1) {
        const right = labels[rightIndex]
        if (!right) continue
        const width = Math.max(0, Math.min(left.box.right, right.box.right) - Math.max(left.box.x, right.box.x))
        const height = Math.max(0, Math.min(left.box.bottom, right.box.bottom) - Math.max(left.box.y, right.box.y))
        const intersection = width * height
        const smallerArea = Math.min(left.box.width * left.box.height, right.box.width * right.box.height)
        if (smallerArea > 0 && intersection / smallerArea > 0.55) {
          overlaps.push(`${left.id} overlaps ${right.id}`)
        }
      }
    }
    return { bounds, overlaps }
  })
  expect(result.bounds).toEqual([])
  expect(result.overlaps).toEqual([])
}

test('Chapter 1 production assets, Worker, lazy editor and viewport remain healthy', async ({ page }) => {
  const browserErrors: string[] = []
  const failedRequests: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown error'}`)
  })

  await page.goto('#/chapter/1')

  await expect(
    page.getByRole('heading', { name: '첫 메시지는 왜 출발하지 못했을까?' }),
  ).toBeVisible()

  expect(await pageOverflow(page)).toEqual({ horizontal: false, vertical: false })

  await page.getByRole('button', { name: /첫 메시지 보내기/ }).click()
  await expect(page.getByRole('tab', { name: '분석' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('메시지가 Broker에 도착하지 않았습니다.')).toBeVisible()

  await page.getByRole('tab', { name: '코드' }).click()
  await expect(page.locator('.cm-editor')).toBeVisible()

  expect(failedRequests).toEqual([])
  expect(browserErrors).toEqual([])
})

test('direct and invalid chapter hashes resolve without page overflow', async ({ page }) => {
  await page.goto('#/chapter/8')
  await expect(
    page.getByRole('heading', { level: 1, name: '읽고 바꿔 쓰는 전체를 하나로 묶을 수 있을까?' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /Chapter 8:/ })).toHaveAttribute('aria-current', 'page')

  await page.goto('#/chapter/99')
  await expect(page).toHaveURL(/#\/chapter\/1$/)
  await expect(
    page.getByRole('heading', { name: '첫 메시지는 왜 출발하지 못했을까?' }),
  ).toBeVisible()

  expect(await pageOverflow(page)).toEqual({ horizontal: false, vertical: false })
})

test('Chapter 2–8 each expose a spatial failure, recommended repair, and successful return signal', async ({ page }) => {
  const browserErrors: string[] = []
  const failedRequests: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown error'}`)
  })

  const chapterTitles = [
    '메시지는 어느 파티션으로 갈까?',
    '재시도는 왜 중복을 남길까?',
    'Leader가 중단되면 기록은 안전할까?',
    'Consumer는 어디까지 읽었을까?',
    '파티션의 담당자는 어떻게 바뀐까?',
    '실패한 메시지는 어디로 보내야 할까?',
    '읽고 바꿔 쓰는 전체를 하나로 묶을 수 있을까?',
  ]

  for (const [index, title] of chapterTitles.entries()) {
    const chapterId = index + 2
    await page.goto(`#/chapter/${chapterId}`)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page.getByRole('button', { name: /예측한 조건 실행/ })).toBeDisabled()
    await expect(page.locator('aside[aria-label="실험 설정"] input[type="radio"]')).toHaveCount(2)
    await expect(page.locator('[data-city-world]')).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet')
    await expect(page.locator('[data-city-node]')).not.toHaveCount(0)
    await expect(page.locator('[data-city-node]').first()).toHaveAttribute('role', 'button')
    await expect(page.locator('[data-city-node]').first()).toHaveAttribute('tabindex', '0')

    await page.getByRole('button', { name: '실패한다' }).click()
    await page.getByRole('button', { name: /예측한 조건 실행|같은 조건으로 재실행/ }).click()
    await seekToTerminalEvent(page)
    await expect(page.locator('[data-city-barrier="closed"]')).toBeVisible()
    if (chapterId === 8) {
      await expect(page.locator('[data-city-boundary="consume-transform-produce-tx"]')).toHaveAttribute(
        'data-boundary-state',
        'failed',
      )
    }
    await expect(page.getByRole('button', { name: '권장 설정 적용' })).toBeVisible()
    await expectWorldElementsInsideSvg(page)

    await page.getByRole('button', { name: '권장 설정 적용' }).click()
    await expect(page.getByText('설정은 바뀌었지만 이 실행은 그대로입니다.')).toBeVisible()
    await page.getByRole('button', { name: /같은 조건으로 재실행/ }).click()
    await seekToTerminalEvent(page)
    await expect(page.getByText('실험 통과')).toBeVisible()
    await expect(page.locator('[data-city-signal]')).toBeVisible()
    if (chapterId === 8) {
      await expect(page.locator('[data-city-boundary="consume-transform-produce-tx"]')).toHaveAttribute(
        'data-boundary-state',
        'complete',
      )
    }
    await expectWorldElementsInsideSvg(page)

    expect(await pageOverflow(page)).toEqual({ horizontal: false, vertical: false })
  }

  expect(failedRequests).toEqual([])
  expect(browserErrors).toEqual([])
})
