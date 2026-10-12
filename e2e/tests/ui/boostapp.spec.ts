import { test, expect } from '@playwright/test';

test.describe('Boostapp Calendar UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display boostapp navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="boostapp"]');
    await expect(page.locator('#management-boostapp-table-container')).toBeVisible();
  });

  test('should display boostapp calendar', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="boostapp"]');
    await expect(page.locator('.boostapp-calendar')).toBeVisible();
  });

  test('should display boostapp schedule', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="boostapp"]');
    await expect(page.locator('.boostapp-schedule')).toBeVisible();
  });

  test('should allow creating boostapp event', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="boostapp"]');
    const addButton = page.locator('#management-boostapp-table-container button.add-btn');
    if (await addButton.count() > 0) {
      await addButton.click();
      await expect(page.locator('.add-form')).toBeVisible();
    }
  });
});
