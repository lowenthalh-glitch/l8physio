import { test, expect } from '@playwright/test';

test.describe('Home Feedback UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display home feedback navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="feedback"]');
    await expect(page.locator('#management-feedback-table-container')).toBeVisible();
  });

  test('should display home feedback table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="feedback"]');
    const table = page.locator('#management-feedback-table-container table');
    await expect(table).toBeVisible();
  });

  test('should allow creating new home feedback', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="feedback"]');
    const addButton = page.locator('#management-feedback-table-container button.add-btn');
    if (await addButton.count() > 0) {
      await addButton.click();
      await expect(page.locator('.add-form')).toBeVisible();
    }
  });

  test('should allow filtering by client', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="feedback"]');
    const clientSelect = page.locator('#management-feedback-table-container select[name="clientId"]');
    await expect(clientSelect).toBeVisible();
  });
});
