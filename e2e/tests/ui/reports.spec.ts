import { test, expect } from '@playwright/test';

test.describe('Session Reports UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display session reports navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="reports"]');
    await expect(page.locator('#management-reports-table-container')).toBeVisible();
  });

  test('should display session reports table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="reports"]');
    const table = page.locator('#management-reports-table-container table');
    await expect(table).toBeVisible();
  });

  test('should display session report statistics', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="reports"]');
    await expect(page.locator('.session-stats')).toBeVisible();
  });

  test('should allow viewing session details', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="reports"]');
    const table = page.locator('#management-reports-table-container table');
    const firstRow = table.locator('tr').nth(1);
    const viewButton = firstRow.locator('button.view-btn');
    if (await viewButton.count() > 0) {
      await viewButton.click();
      await expect(page.locator('.session-details')).toBeVisible();
    }
  });
});
