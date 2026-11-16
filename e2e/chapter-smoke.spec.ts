import { expect, test, type Locator, type Page } from '@playwright/test'

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
}

async function readCarrierSample(carrier: Locator) {
  return carrier.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const transform = element.getAttribute('transform') ?? ''
    return {
      progress: Number(element.getAttribute('data-carrier-progress') ?? 0),
      heading: element.getAttribute('data-carrier-heading') ?? '',
      route: element.getAttribute('data-carrier-route') ?? '',
      transform,
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
    }
  })
}

async function expectWorldElementsInsideSvg(page: Page) {
  const result = await page.evaluate(() => {
    const world = document.querySelector<SVGSVGElement>('[data-city-world]')
    if (!world) return { bounds: ['Kafka city world SVG is missing.'], overlaps: [] }
    const rootGeometry = (element: SVGGraphicsElement) => {
      const local = element.getBBox()
      const elementMatrix = element.getScreenCTM()
      const worldMatrix = world.getScreenCTM()
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
    const viewBox = world.viewBox.baseVal
    const bounds = [...world.querySelectorAll<SVGGraphicsElement>(selectors.join(','))]
      .map((element) => {
        const box = rootGeometry(element)
        const id = element.getAttribute('data-city-node')
          ?? element.getAttribute('data-city-carrier')
          ?? element.getAttribute('data-city-signal')
          ?? element.getAttribute('data-city-barrier')
          ?? element.tagName
        const visible = box.width > 0 && box.height > 0
        const inside = box.x >= viewBox.x - 4
          && box.y >= viewBox.y - 4
          && box.right <= viewBox.x + viewBox.width + 4
          && box.bottom <= viewBox.y + viewBox.height + 4
        return visible && inside
          ? null
          : `${id}: visible=${visible}, inside=${inside}, box=${box.x.toFixed(1)}/${box.y.toFixed(1)}/${box.right.toFixed(1)}/${box.bottom.toFixed(1)}, viewBox=${viewBox.x}/${viewBox.y}/${viewBox.width}/${viewBox.height}`
      })
      .filter((violation): violation is string => violation !== null)

    return { bounds }
  })
  expect(result.bounds).toEqual([])
}

async function expectDioramaContract(page: Page) {
  const stage = page.locator('[data-diorama-stage]')
  await expect(stage).toBeVisible()
  await expect(page.locator('[data-city-world]')).toHaveCount(1)
  await expect(page.locator('[data-city-world]')).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet')
  await expect(page.locator('[data-city-world] > image')).toHaveCount(0)
  await expect(page.locator('[data-city-carrier="vehicle"]')).toHaveCount(1)
  await expect(page.locator('[data-city-carrier="vehicle"] animateMotion')).toHaveCount(0)
  await expect(page.locator('[data-city-carrier="vehicle"]')).toHaveAttribute('data-motion-mode', 'external')
  await expect(page.locator('[data-city-facility-slot]')).toHaveCount(await page.locator('[data-city-node]').count())
  await expect(page.locator('[data-city-node]').first()).toHaveAttribute('role', 'button')
  await expect(page.locator('[data-city-node]').first()).toHaveAttribute('tabindex', '0')
  await expect(page.getByRole('button', { name: '핵심 도로' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '전체 지도' })).toHaveAttribute('aria-pressed', 'false')
  await expect(stage).toHaveAttribute('data-diorama-exploded', 'false')
}

test('Chapter 1 isometric diorama, Worker, lazy editor, exploded view, and ACK remain healthy', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: '첫 메시지는 왜 출발하지 못했을까?' })).toBeVisible()
  await expectDioramaContract(page)
  expect(await pageOverflow(page)).toEqual({ horizontal: false, vertical: false })

  await page.getByRole('button', { name: '분해 뷰' }).click()
  await expect(page.locator('[data-diorama-stage]')).toHaveAttribute('data-diorama-exploded', 'true')
  await page.getByRole('button', { name: '조립 뷰' }).click()
  await expect(page.locator('[data-diorama-stage]')).toHaveAttribute('data-diorama-exploded', 'false')

  await page.getByRole('button', { name: /첫 메시지 보내기/ }).click()
  await expect(page.getByRole('tab', { name: '분석' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('메시지가 Broker에 도착하지 않았습니다.')).toBeVisible()
  await expect(page.locator('[data-city-barrier="closed"]')).toBeVisible()

  await page.getByRole('tab', { name: '코드' }).click()
  await expect(page.locator('.cm-editor')).toBeVisible()

  await page.getByRole('tab', { name: '설정' }).click()
  await page.getByLabel('value.serializer').selectOption('json')
  await page.getByRole('button', { name: /같은 메시지 다시 보내기/ }).click()
  await expect(page.getByRole('tab', { name: '비교' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: /Producer 도착 문자/ })).toBeVisible()

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

test('Chapter 2 carrier drives along connected isometric A->B->C lanes and branches cleanly', async ({ page }) => {
  await page.goto('#/chapter/2')
  await expectDioramaContract(page)
  await page.getByRole('button', { name: '실패한다' }).click()
  await page.getByRole('button', { name: '예측한 조건 실행' }).click()

  await page.waitForFunction(() => {
    const carrier = document.querySelector('[data-city-carrier="vehicle"]')
    return Number(carrier?.getAttribute('data-carrier-progress') ?? 0) > 0
  })

  const carrier = page.locator('[data-city-carrier="vehicle"]')
  const samples: Array<{ progress: number; x: number; y: number }> = []
  for (let index = 0; index < 8; index += 1) {
    samples.push(await readCarrierSample(carrier))
    await page.waitForTimeout(45)
  }
  for (let index = 1; index < samples.length; index += 1) {
    expect(samples[index]!.progress).toBeGreaterThanOrEqual(samples[index - 1]!.progress)
  }

  // Seek to record.dispatched (seq 2) where random-key-per-record splits into 3 partition lanes
  const pause = page.getByRole('button', { name: '일시정지' })
  if (await pause.isVisible()) await pause.click()
  await page.locator('[data-timeline-events] > button').nth(2).click()
  await expect(page.locator('[data-city-carrier]')).toHaveCount(3)
})

test('Chapter 2 playback pause, seek, rewind, and rerun reset use deterministic checkpoints', async ({ page }) => {
  await page.goto('#/chapter/2')
  await page.getByRole('button', { name: '실패한다' }).click()
  await page.getByRole('button', { name: '예측한 조건 실행' }).click()

  const carrier = page.locator('[data-city-carrier="vehicle"]')
  await page.waitForFunction(() => Number(document.querySelector('[data-city-carrier="vehicle"]')?.getAttribute('data-carrier-progress') ?? 0) > 0.05)
  await page.getByRole('button', { name: '일시정지' }).click()
  const paused = await readCarrierSample(carrier)
  await page.waitForTimeout(220)
  const held = await readCarrierSample(carrier)
  expect(held.progress).toBeCloseTo(paused.progress, 3)
  expect(Math.abs(held.x - paused.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(held.y - paused.y)).toBeLessThanOrEqual(1)

  await page.getByRole('button', { name: '재생' }).click()
  await page.waitForTimeout(220)
  const resumed = await readCarrierSample(carrier)
  expect(resumed.progress).toBeGreaterThanOrEqual(paused.progress)

  const timeline = page.getByRole('region', { name: '이벤트 타임라인' })
  await timeline.locator('[data-timeline-events] > button').nth(0).click()
  await expect(page.getByRole('button', { name: '재생' })).toBeVisible()
  await expect(carrier).toHaveAttribute('data-motion-mode', 'external')

  await page.getByRole('button', { name: '처음' }).click()
  await expect(page.locator('aside[aria-label="실행 증거"]').getByText('아직 이벤트가 없습니다.')).toBeVisible()
  expect((await readCarrierSample(carrier)).progress).toBe(0)

  await seekToTerminalEvent(page)
  const failedTerminal = await readCarrierSample(carrier)
  await page.getByRole('button', { name: '권장 설정 적용' }).click()
  await expect(page.getByText('설정은 바뀌었지만 이 실행은 그대로입니다.')).toBeVisible()
  const pendingScene = await readCarrierSample(carrier)
  expect(pendingScene.progress).toBeCloseTo(failedTerminal.progress, 3)

  await page.getByRole('button', { name: '같은 조건으로 재실행' }).click()
  await page.waitForFunction(() => Number(document.querySelector('[data-city-carrier="vehicle"]')?.getAttribute('data-carrier-progress') ?? 1) < 0.25)
  expect((await readCarrierSample(carrier)).progress).toBeLessThan(0.25)
})

test('Chapter 2–8 each expose failure, repair, return signal, and unified look & feel', async ({ page }) => {
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
    await expectDioramaContract(page)

    await page.getByRole('button', { name: '실패한다' }).click()
    await page.getByRole('button', { name: /예측한 조건 실행|같은 조건으로 재실행/ }).click()
    await seekToTerminalEvent(page)
    await expect(page.locator('[data-city-barrier="closed"]')).toBeVisible()
    await expect(page.locator('[data-diorama-stage]')).toHaveAttribute('data-city-run-status', 'failed')
    await expect(page.getByRole('button', { name: '권장 설정 적용' })).toBeVisible()
    await expectWorldElementsInsideSvg(page)

    await page.getByRole('button', { name: '권장 설정 적용' }).click()
    await expect(page.getByText('설정은 바뀌었지만 이 실행은 그대로입니다.')).toBeVisible()
    await page.getByRole('button', { name: /같은 조건으로 재실행/ }).click()
    await seekToTerminalEvent(page)
    await expect(page.getByText('실험 통과')).toBeVisible()
    await expect(page.locator('[data-city-signal]')).toBeVisible()
    await expect(page.locator('[data-diorama-stage]')).toHaveAttribute('data-city-run-status', 'succeeded')
    await expectWorldElementsInsideSvg(page)

    expect(await pageOverflow(page)).toEqual({ horizontal: false, vertical: false })
  }

  expect(failedRequests).toEqual([])
  expect(browserErrors).toEqual([])
})

test('Chapter 2 & Chapter 6 inspection, preview, and camera controls work cohesively', async ({ page }) => {
  await page.goto('#/chapter/2')
  await expectDioramaContract(page)

  await page.getByRole('button', { name: /Partition p1/ }).click()
  await expect(page.locator('aside[aria-label="실행 증거"]').getByText('시설 조사')).toBeVisible()
  await expect(page.locator('aside[aria-label="실행 증거"]').getByText('Partition p1 적재장')).toBeVisible()

  await page.getByRole('button', { name: '전체 지도' }).click()
  await expect(page.getByRole('button', { name: '전체 지도' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-city-world]')).toHaveAttribute('viewBox', '0 0 1600 900')

  await page.goto('#/chapter/6')
  await page.getByRole('button', { name: /Partitions p0–p2/ }).click()
  await expect(page.getByRole('group', { name: '건물 내부 논리 노드' })).toContainText('p0')
  await expect(page.getByRole('group', { name: '건물 내부 논리 노드' })).toContainText('p1')
  await expect(page.getByRole('group', { name: '건물 내부 논리 노드' })).toContainText('p2')
})
