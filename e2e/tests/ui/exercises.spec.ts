import { test, expect } from '@playwright/test';

test.describe('Exercises UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display exercises navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="exercises"]');
    await expect(page.locator('#management-exercises-table-container')).toBeVisible();
  });

  test('should display exercises table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="exercises"]');
    const table = page.locator('#management-exercises-table-container table');
    await expect(table).toBeVisible();
  });

  test('should allow filtering exercises by category', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="exercises"]');
    const categorySelect = page.locator('#management-exercises-table-container select[name="category"]');
    await expect(categorySelect).toBeVisible();
  });

  test('should allow filtering exercises by equipment', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="exercises"]');
    const equipmentSelect = page.locator('#management-exercises-table-container select[name="equipment"]');
    await expect(equipmentSelect).toBeVisible();
  });

  test('should allow creating new exercise', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="exercises"]');
    const addButton = page.locator('#management-exercises-table-container button.add-btn');
    if (await addButton.count() > 0) {
      await addButton.click();
      await expect(page.locator('.add-form')).toBeVisible();
    }
  });

  test('should allow editing exercise', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="exercises"]');
    const table = page.locator('#management-exercises-table-container table');
    const firstRow = table.locator('tr').nth(1);
    const editButton = firstRow.locator('button.edit-btn');
    if (await editButton.count() > 0) {
      await editButton.click();
      await expect(page.locator('.edit-form')).toBeVisible();
    }
  });
});
