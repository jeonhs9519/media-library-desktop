import { test, expect } from '@playwright/test'

// E2E tests require the dev server to be running (`npm run dev`).
// These tests validate the renderer UI via the Vite dev server URL.

test('app loads and shows library page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Media Library')).toBeVisible()
  await expect(page.getByText('All Types')).toBeVisible()
  await expect(page.getByText('All Languages')).toBeVisible()
})

test('add file button is visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('+ Add File')).toBeVisible()
})
