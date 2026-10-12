import { test, expect } from '@playwright/test';

test.describe('Dashboard (htdash)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    // Login
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display dashboard navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="htdash"]');
    await expect(page.locator('#management-htdash-table-container')).toBeVisible();
  });

  test('should display dashboard data', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="htdash"]');
    const table = page.locator('#management-htdash-table-container table');
    await expect(table).toBeVisible();
  });
});
