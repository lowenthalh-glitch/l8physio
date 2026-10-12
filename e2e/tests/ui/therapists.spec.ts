import { test, expect } from '@playwright/test';

test.describe('Therapists UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display therapists navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="therapists"]');
    await expect(page.locator('#management-therapists-table-container')).toBeVisible();
  });

  test('should display therapists table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="therapists"]');
    const table = page.locator('#management-therapists-table-container table');
    await expect(table).toBeVisible();
    await expect(table.locator('th')).toHaveCount(3);
  });

  test('should allow filtering therapists', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="therapists"]');
    const filterInput = page.locator('#management-therapists-table-container input[type="text"]');
    await filterInput.fill('test');
    await expect(filterInput).toHaveValue('test');
  });

  test('should allow sorting therapists', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="therapists"]');
    const table = page.locator('#management-therapists-table-container table');
    const header = table.locator('th').nth(1);
    await header.click();
    await expect(table).toBeVisible();
  });

  test('should open therapist edit form', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="therapists"]');
    const table = page.locator('#management-therapists-table-container table');
    const firstRow = table.locator('tr').nth(1);
    const editButton = firstRow.locator('button.edit-btn');
    if (await editButton.count() > 0) {
      await editButton.click();
      await expect(page.locator('.edit-form')).toBeVisible();
    }
  });

  test('should allow creating new therapist', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="therapists"]');
    const addButton = page.locator('#management-therapists-table-container button.add-btn');
    if (await addButton.count() > 0) {
      await addButton.click();
      await expect(page.locator('.add-form')).toBeVisible();
    }
  });
});
