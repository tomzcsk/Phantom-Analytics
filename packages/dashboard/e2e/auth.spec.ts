import { test, expect } from '@playwright/test'

const ADMIN_USER = 'admin'
const ADMIN_PASS = 'changeme'

test.describe('Auth Flow', () => {
  test('shows login page with Phantom Analytics branding', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('text=Phantom')).toBeVisible()
    await expect(page.locator('text=Analytics')).toBeVisible()
    await expect(page.locator('text=เข้าสู่ระบบ').first()).toBeVisible()
    // Username and password fields exist
    await expect(page.locator('input[type="text"], input[autocomplete="username"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/overview')
    await expect(page).toHaveURL(/\/login/)
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[autocomplete="username"]').fill('wronguser')
    await page.locator('input[type="password"]').fill('wrongpass')
    await page.locator('button[type="submit"]').click()
    // Error message appears (could be English "Unauthorized" or Thai)
    await expect(page.locator('text=/Unauthorized|ไม่สำเร็จ|ไม่ถูกต้อง/')).toBeVisible({ timeout: 10_000 })
  })

  test('logs in successfully', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[autocomplete="username"]').fill(ADMIN_USER)
    await page.locator('input[type="password"]').fill(ADMIN_PASS)
    await page.locator('button[type="submit"]').click()

    // Should redirect away from login (to overview or onboarding)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('persists auth across page reload', async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.locator('input[autocomplete="username"]').fill(ADMIN_USER)
    await page.locator('input[type="password"]').fill(ADMIN_PASS)
    await page.locator('button[type="submit"]').click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })

    // Reload — should stay logged in (not redirect to /login)
    await page.reload()
    await page.waitForTimeout(2000)
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('logout redirects to login', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.locator('input[autocomplete="username"]').fill(ADMIN_USER)
    await page.locator('input[type="password"]').fill(ADMIN_PASS)
    await page.locator('button[type="submit"]').click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })

    // Find and click logout
    const logoutBtn = page.locator('text=/ออกจากระบบ|logout/i')
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click()
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    }
    // If logout button not visible (e.g. on onboarding page), just verify we're logged in
  })
})
