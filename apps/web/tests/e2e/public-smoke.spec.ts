import { expect, test } from '@playwright/test';

test('public home page renders without database credentials', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/CivicGraph/);
  await expect(
    page.getByRole('heading', {
      name: /See What Is Happening\.\s*Decide What To Do Next\./i,
    }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Start Free/i }).first()).toBeVisible();
});
