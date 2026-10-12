import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/login/index.html');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should reject empty credentials', async ({ page }) => {
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error-message')).toBeVisible();
  });

  test('should redirect to app on successful login', async ({ page }) => {
    const email = process.env.TEST_EMAIL || 'test@example.com';
    const password = process.env.TEST_PASSWORD || 'password123';
    
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/l8ui/app.html');
    await expect(page).toHaveURL(/app\.html$/);
  });

  test('should maintain session after page reload', async ({ page }) => {
    const email = process.env.TEST_EMAIL || 'test@example.com';
    const password = process.env.TEST_PASSWORD || 'password123';
    
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
    
    await page.reload();
    await expect(page).toHaveURL(/app\.html$/);
  });
});
