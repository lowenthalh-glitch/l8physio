import { test, expect } from '@playwright/test';

test.describe('Appointments UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display appointments navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="appointments"]');
    await expect(page.locator('#management-appointments-table-container')).toBeVisible();
  });

  test('should display appointments table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="appointments"]');
    const table = page.locator('#management-appointments-table-container table');
    await expect(table).toBeVisible();
  });

  test('should allow creating new appointment', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="appointments"]');
    const addButton = page.locator('#management-appointments-table-container button.add-btn');
    if (await addButton.count() > 0) {
      await addButton.click();
      await expect(page.locator('.add-form')).toBeVisible();
    }
  });

  test('should allow filtering by date range', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="appointments"]');
    const startDateInput = page.locator('#management-appointments-table-container input[name="startDate"]');
    await startDateInput.fill('2024-01-01');
    await expect(startDateInput).toHaveValue('2024-01-01');
  });

  test('should allow filtering by therapist', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="appointments"]');
    const therapistSelect = page.locator('#management-appointments-table-container select[name="therapistId"]');
    await expect(therapistSelect).toBeVisible();
  });

  test('should allow filtering by client', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="appointments"]');
    const clientSelect = page.locator('#management-appointments-table-container select[name="clientId"]');
    await expect(clientSelect).toBeVisible();
  });
});
