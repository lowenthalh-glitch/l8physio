import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { MobileShell } from '../../pages/mobile.page';
import { trackPageErrors } from '../../fixtures/errors';

test.describe('mobile login', () => {
  test('mobile user agent is redirected to the mobile bundle after login', async ({ page }) => {
    const errors = trackPageErrors(page);
    const login = new LoginPage(page);
    await login.goto();
    await login.login();
    await page.waitForURL('**/m/app.html');
    const m = new MobileShell(page);
    await expect(page.locator('.mobile-header')).toBeVisible();
    await expect(page.locator('#user-name')).not.toHaveText('User');
    expect(errors, errors.join('\n')).toEqual([]);
    await m.openSidebar();
  });

  test('invalid credentials are rejected on mobile too', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('admin', 'nope');
    await expect(login.error()).toBeVisible();
    await expect(page).toHaveURL(/login/);
  });

  test('mobile app without a token returns to login', async ({ page }) => {
    await page.goto('/m/app.html');
    await page.waitForURL(/login/, { timeout: 20_000 });
  });

  test('logout from the sidebar clears the token', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login();
    await page.waitForURL('**/m/app.html');
    const m = new MobileShell(page);
    await m.openSidebar();
    await m.logout().click();
    await page.waitForURL(/login/);
    expect(await page.evaluate(() => sessionStorage.getItem('bearerToken') || localStorage.getItem('bearerToken'))).toBeNull();
  });
});
