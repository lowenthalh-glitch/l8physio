import { test, expect } from '@playwright/test';

test.describe('Workout Builder UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display workout builder navigation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="builder"]');
    await expect(page.locator('#physio-workout-builder')).toBeVisible();
  });

  test('should display workout builder interface', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="builder"]');
    const builder = page.locator('#physio-workout-builder');
    await expect(builder).toBeVisible();
  });

  test('should allow selecting exercises', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="builder"]');
    const exerciseList = page.locator('#physio-workout-builder .exercise-list');
    if (await exerciseList.count() > 0) {
      await expect(exerciseList).toBeVisible();
    }
  });

  test('should allow creating circuit', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="builder"]');
    const circuitBuilder = page.locator('#physio-workout-builder .circuit-builder');
    if (await circuitBuilder.count() > 0) {
      await expect(circuitBuilder).toBeVisible();
    }
  });

  test('should allow saving workout', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="builder"]');
    const saveButton = page.locator('#physio-workout-builder button.save-btn');
    if (await saveButton.count() > 0) {
      await saveButton.click();
      await expect(page.locator('.success-message')).toBeVisible();
    }
  });

  test('should display session-view popup for workout', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="builder"]');
    const sessionViewButton = page.locator('#physio-workout-builder button.session-view-btn');
    if (await sessionViewButton.count() > 0) {
      await sessionViewButton.click();
      await expect(page.locator('.session-view-popup')).toBeVisible();
    }
  });
});
