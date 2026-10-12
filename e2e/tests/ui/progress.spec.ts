import { test, expect } from '@playwright/test';

test.describe('Progress Logs UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display progress navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="progress"]');
    await expect(page.locator('#management-progress-table-container')).toBeVisible();
  });

  test('should display progress logs table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="progress"]');
    const table = page.locator('#management-progress-table-container table');
    await expect(table).toBeVisible();
  });

  test('should allow creating new progress log', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="progress"]');
    const addButton = page.locator('#management-progress-table-container button.add-btn');
    if (await addButton.count() > 0) {
      await addButton.click();
      await expect(page.locator('.add-form')).toBeVisible();
    }
  });

  test('should allow filtering by client', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="progress"]');
    const clientSelect = page.locator('#management-progress-table-container select[name="clientId"]');
    await expect(clientSelect).toBeVisible();
  });

  test('should allow filtering by exercise', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="progress"]');
    const exerciseSelect = page.locator('#management-progress-table-container select[name="exerciseId"]');
    await expect(exerciseSelect).toBeVisible();
  });

  test('should allow filtering by date range', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="progress"]');
    const startDateInput = page.locator('#management-progress-table-container input[name="startDate"]');
    await startDateInput.fill('2024-01-01');
    await expect(startDateInput).toHaveValue('2024-01-01');
  });
});
