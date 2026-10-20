import { test, expect } from '../../fixtures/auth';
import { LoginPage } from '../../pages/login.page';
import { Shell } from '../../pages/shell.page';
import { token } from '../../fixtures/env';
import { provisionUser, deleteUser, DEFAULT_PASSWORD } from '../../fixtures/users';
import { trackPageErrors } from '../../fixtures/errors';

test.describe('role portals (same web server, sub-pages)', () => {
  test('client logs in through the UI and lands on the client portal with only Clients', async ({ page, api, seed }) => {
    const errors = trackPageErrors(page);
    const c = await seed.client(token('PortCli'));
    await provisionUser(api, { userId: c.id, email: c.entity.email, fullName: 'E2E Portal', role: 'client' });
    try {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(c.entity.email, DEFAULT_PASSWORD);
      await page.waitForURL('**/client-app.html');
      const shell = new Shell(page);
      await expect(page.locator('.header-subtitle')).toHaveText('Client Portal');
      await expect(shell.section('physio')).toBeVisible();
      await expect(page.locator('.l8-subnav-item[data-service="clients"]')).toBeVisible();
      for (const hidden of ['therapists', 'exercises', 'protocols', 'plans', 'appointments', 'progress', 'reports', 'feedback', 'htdash']) {
        await expect(page.locator(`.l8-subnav-item[data-service="${hidden}"]`)).toBeHidden();
      }
      expect(errors, errors.join('\n')).toEqual([]);
    } finally {
      await deleteUser(api, c.id);
    }
  });

  test('client sees their own record and not another client\'s', async ({ page, api, seed }) => {
    const mine = await seed.client(token('OwnA'));
    const other = await seed.client(token('OwnB'));
    await provisionUser(api, { userId: mine.id, email: mine.entity.email, fullName: 'E2E Own', role: 'client' });
    try {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(mine.entity.email, DEFAULT_PASSWORD);
      await page.waitForURL('**/client-app.html');
      const table = page.locator('#management-clients-table-container');
      await expect(table.locator('tbody tr[data-row-index]', { hasText: mine.marker })).toBeVisible({ timeout: 30_000 });
      await expect(table.locator('tbody tr[data-row-index]', { hasText: other.marker })).toHaveCount(0);
    } finally {
      await deleteUser(api, mine.id);
    }
  });

  test('therapist logs in through the UI and sees Therapists, Clients and Boostapp only', async ({ page, api, seed }) => {
    const errors = trackPageErrors(page);
    const th = await seed.therapist(token('PortThr'));
    await provisionUser(api, { userId: th.id, email: th.entity.email, fullName: 'E2E Thr', role: 'therapist' });
    try {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(th.entity.email, DEFAULT_PASSWORD);
      await page.waitForURL('**/therapist-app.html');
      await page.waitForTimeout(500);
      for (const shown of ['therapists', 'clients', 'boostapp']) {
        await expect(page.locator(`.l8-subnav-item[data-service="${shown}"]`)).toBeVisible();
      }
      for (const hidden of ['exercises', 'protocols', 'plans', 'appointments', 'progress', 'reports', 'feedback']) {
        await expect(page.locator(`.l8-subnav-item[data-service="${hidden}"]`)).toBeHidden();
      }
      expect(errors, errors.join('\n')).toEqual([]);
    } finally {
      await deleteUser(api, th.id);
    }
  });

  test('client portal exposes no System section', async ({ page, api, seed }) => {
    const c = await seed.client(token('NoSys'));
    await provisionUser(api, { userId: c.id, email: c.entity.email, fullName: 'E2E', role: 'client' });
    try {
      const login = new LoginPage(page);
      await login.goto();
      await login.login(c.entity.email, DEFAULT_PASSWORD);
      await page.waitForURL('**/client-app.html');
      await expect(page.locator('.nav-link[data-section="system"]')).toHaveCount(0);
    } finally {
      await deleteUser(api, c.id);
    }
  });
});

test.describe('static pages', () => {
  for (const p of ['/landing.html', '/landing-treatment.html', '/landing-training.html']) {
    test(`${p} is served and links into the app`, async ({ page }) => {
      const resp = await page.goto(p);
      expect(resp!.status()).toBe(200);
      await expect(page.locator('a[href="app.html"]').first()).toBeAttached();
    });
  }

  for (const p of ['/app.html', '/client-app.html', '/therapist-app.html', '/m/app.html', '/m/client-app.html', '/m/therapist-app.html', '/login.json', '/m/login.json']) {
    test(`${p} is served`, async ({ request }) => {
      expect((await request.get(p)).status()).toBe(200);
    });
  }
});
