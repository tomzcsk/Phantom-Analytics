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

/**
 * After login, the app may show onboarding (no sites) or dashboard (has sites).
 * We need to register a site first if we're on onboarding.
 */
async function ensureSiteExists(page: Page) {
  // Check if we're on onboarding page
  const onboarding = page.locator('text=ลงทะเบียนเว็บไซต์แรก')
  if (await onboarding.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Register a test site
    await page.locator('input').nth(0).fill('Test Site E2E')
    await page.locator('input').nth(1).fill('e2e-test.example.com')
    await page.locator('button[type="submit"], button:has-text("ลงทะเบียน")').click()
    // Wait for redirect to dashboard
    await page.waitForTimeout(3000)
  }
}

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await ensureSiteExists(page)
  })

  test('sidebar shows navigation items', async ({ page }) => {
    await page.goto('/overview')
    await page.waitForTimeout(2000)
    // Check for sidebar nav links
    const sidebar = page.locator('aside, nav').first()
    await expect(sidebar).toBeVisible({ timeout: 10_000 })
  })

  test('overview page renders main content', async ({ page }) => {
    await page.goto('/overview')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('pages route renders', async ({ page }) => {
    await page.goto('/pages')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('engagement route renders', async ({ page }) => {
    await page.goto('/engagement')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('sources route renders', async ({ page }) => {
    await page.goto('/sources')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('funnels route renders', async ({ page }) => {
    await page.goto('/funnels')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('journeys route renders', async ({ page }) => {
    await page.goto('/journeys')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('settings route renders', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
  })

  test('all pages render without crash', async ({ page }) => {
    const routes = ['/overview', '/pages', '/engagement', '/sources', '/funnels', '/journeys']

    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible({ timeout: 10_000 })
    }
  })
})
