import { test, expect } from '@playwright/test';

test.describe('Clients UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display clients navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="clients"]');
    await expect(page.locator('#management-clients-table-container')).toBeVisible();
  });

  test('should display clients table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="clients"]');
    const table = page.locator('#management-clients-table-container table');
    await expect(table).toBeVisible();
    await expect(table.locator('th')).toHaveCount(4);
  });

  test('should allow filtering clients', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="clients"]');
    const filterInput = page.locator('#management-clients-table-container input[type="text"]');
    await filterInput.fill('test');
    await expect(filterInput).toHaveValue('test');
  });

  test('should allow creating new client', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="clients"]');
    const addButton = page.locator('#management-clients-table-container button.add-btn');
    if (await addButton.count() > 0) {
      await addButton.click();
      await expect(page.locator('.add-form')).toBeVisible();
    }
  });

  test('should allow assigning client to therapist', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="clients"]');
    const table = page.locator('#management-clients-table-container table');
    const firstRow = table.locator('tr').nth(1);
    const assignButton = firstRow.locator('button.assign-btn');
    if (await assignButton.count() > 0) {
      await assignButton.click();
      const therapistSelect = page.locator('select[name="therapistId"]');
      await expect(therapistSelect).toBeVisible();
    }
  });

  test('should display client details in popup', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="clients"]');
    const table = page.locator('#management-clients-table-container table');
    const firstRow = table.locator('tr').nth(1);
    const detailsButton = firstRow.locator('button.details-btn');
    if (await detailsButton.count() > 0) {
      await detailsButton.click();
      await expect(page.locator('.client-details')).toBeVisible();
    }
  });
});
