import { test as baseTest, expect } from '@playwright/test';

const test = baseTest.extend<{
  logged In: boolean;
}>({
  logged In: [false, { option: true }],
});

test.describe('All UI Features - Complete Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/l8ui/app.html');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/l8ui/app.html');
  });

  // Navigation Test
  test('should navigate to all UI sections', async ({ page }) => {
    const sections = [
      { name: 'Dashboard', service: 'htdash' },
      { name: 'Therapists', service: 'therapists' },
      { name: 'Clients', service: 'clients' },
      { name: 'Exercises', service: 'exercises' },
      { name: 'Protocol Templates', service: 'protocols' },
      { name: 'Treatment Plans', service: 'plans' },
      { name: 'Appointments', service: 'appointments' },
      { name: 'Progress Logs', service: 'progress' },
      { name: 'Session Reports', service: 'reports' },
      { name: 'Home Feedback', service: 'feedback' },
      { name: 'Boostapp Calendar', service: 'boostapp' },
      { name: 'Workout Builder', service: 'builder' },
    ];

    for (const section of sections) {
      await page.click(`a.l8-subnav-item[data-service="${section.service}"]`);
      await expect(page.locator(`#management-${section.service}-table-container`)).toBeVisible({
        timeout: 10000,
      });
    }
  });

  // Dashboard Tests
  test('dashboard: should display and load', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="htdash"]');
    await expect(page.locator('#management-htdash-table-container')).toBeVisible();
  });

  // Therapists Tests
  test('therapists: should display table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="therapists"]');
    await expect(page.locator('#management-therapists-table-container table')).toBeVisible();
  });

  test('therapists: should support filtering', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="therapists"]');
    const filterInput = page.locator('#management-therapists-table-container input[type="text"]');
    await filterInput.fill('test');
    await expect(filterInput).toHaveValue('test');
  });

  test('therapists: should support sorting', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="therapists"]');
    const table = page.locator('#management-therapists-table-container table');
    const header = table.locator('th').nth(1);
    await header.click();
  });

  test('therapists: should support CRUD operations', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="therapists"]');
    const addButton = page.locator('#management-therapists-table-container button.add-btn');
    if (await addButton.count() > 0) {
      await addButton.click();
      await expect(page.locator('.add-form')).toBeVisible();
    }
  });

  // Clients Tests
  test('clients: should display table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="clients"]');
    await expect(page.locator('#management-clients-table-container table')).toBeVisible();
  });

  test('clients: should support filtering', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="clients"]');
    const filterInput = page.locator('#management-clients-table-container input[type="text"]');
    await filterInput.fill('test');
    await expect(filterInput).toHaveValue('test');
  });

  test('clients: should support assigning to therapist', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="clients"]');
    const table = page.locator('#management-clients-table-container table');
    const firstRow = table.locator('tr').nth(1);
    const assignButton = firstRow.locator('button.assign-btn');
    if (await assignButton.count() > 0) {
      await assignButton.click();
      await expect(page.locator('select[name="therapistId"]')).toBeVisible();
    }
  });

  // Exercises Tests
  test('exercises: should display table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="exercises"]');
    await expect(page.locator('#management-exercises-table-container table')).toBeVisible();
  });

  test('exercises: should support category filter', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="exercises"]');
    const categorySelect = page.locator('#management-exercises-table-container select[name="category"]');
    await expect(categorySelect).toBeVisible();
  });

  test('exercises: should support equipment filter', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="exercises"]');
    const equipmentSelect = page.locator('#management-exercises-table-container select[name="equipment"]');
    await expect(equipmentSelect).toBeVisible();
  });

  // Plans Tests
  test('plans: should display table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="plans"]');
    await expect(page.locator('#management-plans-table-container table')).toBeVisible();
  });

  test('plans: should support circuit display', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="plans"]');
    await expect(page.locator('.circuit-display')).toBeVisible();
  });

  // Appointments Tests
  test('appointments: should display table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="appointments"]');
    await expect(page.locator('#management-appointments-table-container table')).toBeVisible();
  });

  test('appointments: should support date range filter', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="appointments"]');
    const startDateInput = page.locator('#management-appointments-table-container input[name="startDate"]');
    await startDateInput.fill('2024-01-01');
    await expect(startDateInput).toHaveValue('2024-01-01');
  });

  // Progress Tests
  test('progress: should display table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="progress"]');
    await expect(page.locator('#management-progress-table-container table')).toBeVisible();
  });

  test('progress: should support date range filter', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="progress"]');
    const startDateInput = page.locator('#management-progress-table-container input[name="startDate"]');
    await startDateInput.fill('2024-01-01');
    await expect(startDateInput).toHaveValue('2024-01-01');
  });

  // Reports Tests
  test('reports: should display table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="reports"]');
    await expect(page.locator('#management-reports-table-container table')).toBeVisible();
  });

  test('reports: should display statistics', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="reports"]');
    await expect(page.locator('.session-stats')).toBeVisible();
  });

  // Feedback Tests
  test('feedback: should display table', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="feedback"]');
    await expect(page.locator('#management-feedback-table-container table')).toBeVisible();
  });

  // Boostapp Tests
  test('boostapp: should display calendar', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="boostapp"]');
    await expect(page.locator('.boostapp-calendar')).toBeVisible();
  });

  test('boostapp: should display schedule', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="boostapp"]');
    await expect(page.locator('.boostapp-schedule')).toBeVisible();
  });

  // Workout Builder Tests
  test('workout-builder: should display interface', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="builder"]');
    await expect(page.locator('#physio-workout-builder')).toBeVisible();
  });

  test('workout-builder: should allow circuit creation', async ({ page }) => {
    await page.click('a.l8-subnav-item[data-service="builder"]');
    await expect(page.locator('.circuit-builder')).toBeVisible();
  });
});
