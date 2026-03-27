import { test, expect, type Page } from '@playwright/test'

const ADMIN_USER = 'admin'
const ADMIN_PASS = 'changeme'

async function login(page: Page) {
  await page.goto('/login')
  await page.locator('input[autocomplete="username"]').fill(ADMIN_USER)
  await page.locator('input[type="password"]').fill(ADMIN_PASS)
  await page.locator('button[type="submit"]').click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
}

async function ensureSiteExists(page: Page) {
  const onboarding = page.locator('text=ลงทะเบียนเว็บไซต์แรก')
  if (await onboarding.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.locator('input').nth(0).fill('Test Site E2E')
    await page.locator('input').nth(1).fill('e2e-test.example.com')
    await page.locator('button[type="submit"], button:has-text("ลงทะเบียน")').click()
    await page.waitForTimeout(3000)
  }
}

test.describe('Sites Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await ensureSiteExists(page)
  })

  test('settings page renders with site info', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('funnels page renders', async ({ page }) => {
    await page.goto('/funnels')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Admin Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await ensureSiteExists(page)
  })

  test('activity log page renders for admin', async ({ page }) => {
    await page.goto('/activity-log')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('user management page renders for admin', async ({ page }) => {
    await page.goto('/users')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })
})
