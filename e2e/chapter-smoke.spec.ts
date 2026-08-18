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
    page.getByRole('heading', { level: 2, name: '읽고 바꿔 쓰는 전체를 하나로 묶을 수 있을까?' }),
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
