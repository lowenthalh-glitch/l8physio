import { test, expect } from '@playwright/test';

test.describe('Therapist Management', () => {
  test.beforeEach(async ({ page }) => {
    const email = process.env.TEST_EMAIL || 'test@example.com';
    const password = process.env.TEST_PASSWORD || 'password123';
    
    await page.goto('/l8ui/login/index.html');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  test('should display therapist table', async ({ page }) => {
    await page.click('text=Therapists');
    await expect(page.locator('.therapist-table')).toBeVisible();
  });

  test('should filter therapists by name', async ({ page }) => {
    await page.click('text=Therapists');
    await page.fill('.filter-input', 'Smith');
    await expect(page.locator('.therapist-table tr')).toHaveCount(1);
  });

  test('should sort therapists by last name', async ({ page }) => {
    await page.click('text=Therapists');
    await page.click('th:has-text("Last Name")');
    await expect(page.locator('.therapist-table tr:first-child td:nth-child(2)')).toContainText(/^A/);
  });

  test('should open therapist edit modal', async ({ page }) => {
    await page.click('text=Therapists');
    await page.click('.therapist-table tr:first-child .edit-btn');
    await expect(page.locator('.modal-container')).toBeVisible();
  });

  test('should create new therapist', async ({ page }) => {
    await page.click('text=Therapists');
    await page.click('.add-btn');
    
    await page.fill('.modal-container input[name="firstName"]', 'John');
    await page.fill('.modal-container input[name="lastName"]', 'Doe');
    await page.fill('.modal-container input[name="email"]', 'john.doe@test.com');
    await page.fill('.modal-container input[name="specialty"]', 'Sports Medicine');
    
    await page.click('.modal-container .save-btn');
    await expect(page.locator('.therapist-table tr:has-text("Doe")')).toBeVisible();
  });

  test('should display therapist count', async ({ page }) => {
    await page.click('text=Therapists');
    await expect(page.locator('.therapist-count')).toContainText(/\d+/);
  });
});
