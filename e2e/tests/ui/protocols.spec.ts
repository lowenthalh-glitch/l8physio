import { test, expect } from '@playwright/test';

test.describe('Protocol Templates UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display protocols navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="protocols"]');
    await expect(page.locator('#management-protocols-table-container')).toBeVisible();
  });

  test('should display protocols table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="protocols"]');
    const table = page.locator('#management-protocols-table-container table');
    await expect(table).toBeVisible();
  });

  test('should allow creating new protocol template', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="protocols"]');
    const addButton = page.locator('#management-protocols-table-container button.add-btn');
    if (await addButton.count() > 0) {
      await addButton.click();
      await expect(page.locator('.add-form')).toBeVisible();
    }
  });

  test('should allow editing protocol template', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="protocols"]');
    const table = page.locator('#management-protocols-table-container table');
    const firstRow = table.locator('tr').nth(1);
    const editButton = firstRow.locator('button.edit-btn');
    if (await editButton.count() > 0) {
      await editButton.click();
      await expect(page.locator('.edit-form')).toBeVisible();
    }
  });
});
