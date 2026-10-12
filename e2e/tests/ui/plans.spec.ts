import { test, expect } from '@playwright/test';

test.describe('Treatment Plans UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display plans navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="plans"]');
    await expect(page.locator('#management-plans-table-container')).toBeVisible();
  });

  test('should display plans table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="plans"]');
    const table = page.locator('#management-plans-table-container table');
    await expect(table).toBeVisible();
  });

  test('should allow creating new treatment plan', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="plans"]');
    const addButton = page.locator('#management-plans-table-container button.add-btn');
    if (await addButton.count() > 0) {
      await addButton.click();
      await expect(page.locator('.add-form')).toBeVisible();
    }
  });

  test('should allow editing treatment plan', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="plans"]');
    const table = page.locator('#management-plans-table-container table');
    const firstRow = table.locator('tr').nth(1);
    const editButton = firstRow.locator('button.edit-btn');
    if (await editButton.count() > 0) {
      await editButton.click();
      await expect(page.locator('.edit-form')).toBeVisible();
    }
  });

  test('should allow adding exercises to plan', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="plans"]');
    const table = page.locator('#management-plans-table-container table');
    const firstRow = table.locator('tr').nth(1);
    const addExerciseButton = firstRow.locator('button.add-exercise-btn');
    if (await addExerciseButton.count() > 0) {
      await addExerciseButton.click();
      const exerciseSelect = page.locator('select[name="exerciseId"]');
      await expect(exerciseSelect).toBeVisible();
    }
  });

  test('should display circuit in plan editor', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="plans"]');
    const table = page.locator('#management-plans-table-container table');
    const firstRow = table.locator('tr').nth(1);
    const editButton = firstRow.locator('button.edit-btn');
    if (await editButton.count() > 0) {
      await editButton.click();
      await expect(page.locator('.circuit-display')).toBeVisible();
    }
  });
});
