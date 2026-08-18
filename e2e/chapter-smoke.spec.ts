import { expect, test } from '@playwright/test'

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

  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    vertical: document.documentElement.scrollHeight > document.documentElement.clientHeight,
  }))
  expect(overflow).toEqual({ horizontal: false, vertical: false })

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

  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    vertical: document.documentElement.scrollHeight > document.documentElement.clientHeight,
  }))
  expect(overflow).toEqual({ horizontal: false, vertical: false })
})

test('Chapter 2–8 routes expose three runnable experiments and Chapter 8 can be repaired', async ({ page }) => {
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

    const overflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      vertical: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    }))
    expect(overflow).toEqual({ horizontal: false, vertical: false })
  }

  await page.getByRole('button', { name: '실패한다' }).click()
  await page.getByRole('button', { name: /예측한 조건 실행/ }).click()
  await expect(page.getByRole('button', { name: '권장 설정 적용' })).toBeVisible()

  await page.getByRole('button', { name: '권장 설정 적용' }).click()
  await page.getByRole('button', { name: /같은 조건으로 재실행/ }).click()
  await expect(page.getByText('실험 통과')).toBeVisible()
  await expect(page.getByText('1 / 3 완료')).toBeVisible()
})
