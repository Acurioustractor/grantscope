import { expect, test } from '@playwright/test';

test('public home page renders without database credentials', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/CivicGraph/);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('body')).toContainText(/CivicGraph/);
  await expect(
    page.locator('a[href="/grants"], a[href="/register"], a[href="/tender-intelligence"]').first(),
  ).toBeVisible();
});
