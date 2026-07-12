import { expect, test } from '@playwright/test';

test.describe('ACT Field Desk pilot workflow', () => {
  test('completes and restores the first Today action', async ({ page }) => {
    await page.route('**/api/org/act-fast-local/daily-actions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/org/act');

    const today = page.getByTestId('act-today-focus');
    await expect(today.getByTestId('today-primary')).toContainText('REAL Innovation Fund EOI');

    await today.getByLabel('Update today: REAL Innovation Fund EOI').selectOption('done');
    await expect(today).toContainText('1 handled today');
    await expect(today.getByTestId('today-primary')).not.toContainText('REAL Innovation Fund EOI');

    await today.getByRole('button', { name: 'Undo last' }).click();
    await expect(today.getByTestId('today-primary')).toContainText('REAL Innovation Fund EOI');
  });

  test('assigns a concrete Action plan and follows the warm relationship path', async ({ page }) => {
    let submittedPlan: Record<string, unknown> | null = null;
    await page.route('**/api/org/act-fast-local/pipeline', async (route) => {
      submittedPlan = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/org/act?view=pipeline&commitment=e2e-real-eoi#pipeline');

    const selected = page.getByTestId('action-selected');
    await expect(selected).toContainText('REAL Innovation Fund EOI');
    await expect(selected).toContainText('Alex Snow');
    await selected.getByRole('button', { name: 'Plan next step' }).click();
    await selected.getByLabel('Owner').fill('Benjamin');
    await selected.getByLabel('Next action').fill('Ask Alex for a 30 minute evidence call');
    await selected.getByLabel('Date').fill('2026-07-20');
    await selected.getByRole('button', { name: 'Save plan' }).click();

    await expect.poll(() => submittedPlan).toEqual({
      id: 'e2e-real-eoi',
      owner_name: 'Benjamin',
      next_action: 'Ask Alex for a 30 minute evidence call',
      next_action_at: '2026-07-20',
    });
    await expect(selected).toContainText('Plan saved');

    await selected.getByRole('link', { name: 'Open this relationship' }).click();
    await expect(page).toHaveURL(/view=relationships&relationship=e2e-snow-contact/);
    await expect(page.getByRole('heading', { name: 'Alex Snow' })).toBeVisible();
  });

  test('keeps the daily desk usable on a phone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/org/act');

    await expect(page.getByRole('heading', { name: 'What needs moving today' })).toBeVisible();
    await expect(page.getByTestId('today-primary')).toBeVisible();
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflows).toBe(false);
  });

  test('keeps production-style and legacy full links on the Field Desk', async ({ page }) => {
    await page.goto('/org/act?full=1');

    await expect(page.getByRole('heading', { name: 'What needs moving today' })).toBeVisible();
    await expect(page.getByTestId('act-today-focus')).toBeVisible();
    await expect(page.getByText('Calm view of opportunities, action, and growth work', { exact: true })).not.toBeVisible();
  });
});
