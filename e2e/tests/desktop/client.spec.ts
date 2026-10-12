import { test, expect } from '@playwright/test';

test.describe('Client Management', () => {
  test.beforeEach(async ({ page }) => {
    const email = process.env.TEST_EMAIL || 'test@example.com';
    const password = process.env.TEST_PASSWORD || 'password123';
    
    await page.goto('/l8ui/login/index.html');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display clients table', async ({ page }) => {
    await page.click('text=Clients');
    await expect(page.locator('.client-table')).toBeVisible();
  });

  test('should create new client', async ({ page }) => {
    await page.click('text=Clients');
    await page.click('.add-btn');
    
    await page.fill('.modal-container input[name="firstName"]', 'Jane');
    await page.fill('.modal-container input[name="lastName"]', 'Smith');
    await page.fill('.modal-container input[name="email"]', 'jane.smith@test.com');
    await page.fill('.modal-container input[name="phone"]', '555-1234');
    
    await page.click('.modal-container .save-btn');
    await expect(page.locator('.client-table tr:has-text("Smith")')).toBeVisible();
  });

  test('should assign client to therapist', async ({ page }) => {
    await page.click('text=Clients');
    await page.click('.add-btn');
    
    await page.fill('.modal-container input[name="firstName"]', 'Test');
    await page.fill('.modal-container input[name="lastName"]', 'User');
    await page.fill('.modal-container input[name="email"]', 'test.user@test.com');
    
    await page.selectOption('.modal-container select[name="therapistId"]', 'therapist-1');
    
    await page.click('.modal-container .save-btn');
    await expect(page.locator('.client-table tr:has-text("User")')).toBeVisible();
  });

  test('should filter clients by name', async ({ page }) => {
    await page.click('text=Clients');
    await page.fill('.filter-input', 'Smith');
    await expect(page.locator('.client-table tr')).toHaveCount(1);
  });

  test('should open client detail modal', async ({ page }) => {
    await page.click('text=Clients');
    await page.click('.client-table tr:first-child .detail-btn');
    await expect(page.locator('.modal-container')).toBeVisible();
  });

  test('should view client plans', async ({ page }) => {
    await page.click('text=Clients');
    await page.click('.client-table tr:first-child .detail-btn');
    await expect(page.locator('.plan-list')).toBeVisible();
  });
});
