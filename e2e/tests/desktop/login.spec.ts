import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { Shell } from '../../pages/shell.page';
import { PASS, USER } from '../../fixtures/env';

test.describe('login page', () => {
  test('root and /index.html redirect to the login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/l8ui\/login\/(index\.html)?$/);
    await page.goto('/index.html');
    await expect(page).toHaveURL(/login|\/$/);
  });

  test('renders branded login form from login.json', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(page.locator('#app-title')).toHaveText('Physio by Layer 8');
    await expect(page.locator('#app-description')).toHaveText('Physiotherapy Management');
    await expect(login.password()).toHaveAttribute('type', 'password');
    await expect(login.submit()).toBeVisible();
    await expect(page.locator('#remember-me')).toBeVisible();
  });

  test('login.json carries the physio api prefix (not /erp)', async ({ request }) => {
    const resp = await request.get('/login.json');
    expect(resp.ok()).toBeTruthy();
    const cfg = await resp.json();
    // the server normalises the prefix to a trailing slash (UpdateLoginJsonPrefix)
    expect(cfg.app.apiPrefix).toMatch(/^\/physio\/?$/);
    expect(cfg.login.authEndpoint).toBe('/physio-auth');
  });

  test('invalid credentials show an error and stay on the login page', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(USER, 'wrong-password');
    await expect(login.error()).toBeVisible();
    await expect(page).toHaveURL(/login/);
    expect(await page.evaluate(() => sessionStorage.getItem('bearerToken'))).toBeNull();
  });

  test('empty form is blocked by required validation', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.submit().click();
    await expect(page).toHaveURL(/login/);
    expect(await login.username().evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBeTruthy();
  });

  test('valid login lands on the desktop portal and stores the token', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login();
    await page.waitForURL('**/app.html');
    expect(await page.evaluate(() => sessionStorage.getItem('bearerToken'))).toBeTruthy();
    expect(await page.evaluate(() => sessionStorage.getItem('currentUser'))).toBe(USER);
    await expect(new Shell(page).username()).toBeVisible();
  });

  test('session survives a reload', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(USER, PASS);
    await page.waitForURL('**/app.html');
    await page.reload();
    await expect(page).toHaveURL(/app\.html/);
    await expect(page.locator('nav.sidebar')).toBeVisible();
  });

  test('app.html without a token sends the user to login', async ({ page }) => {
    await page.goto('/app.html');
    await page.waitForURL(/login/, { timeout: 20_000 });
  });

  test('logout clears the session and returns to login', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login();
    await page.waitForURL('**/app.html');
    const shell = new Shell(page);
    await shell.logout().click();
    await page.waitForURL(/login/);
    expect(await page.evaluate(() => sessionStorage.getItem('bearerToken'))).toBeNull();
  });

  test('a rejected token (401) forces re-login', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('bearerToken', 'stale.invalid.token'));
    await page.goto('/app.html');
    // the first data fetch gets a 401: the app shows a Session Error popup that leads back to login
    await expect(page.locator('.probler-popup-title', { hasText: 'Session Error' }).first()).toBeVisible({ timeout: 20_000 });
    // several 401s stack several popups (and re-render them), so dispatch the click instead of waiting for stability
    await page.getByRole('button', { name: 'Go to Login' }).first().dispatchEvent('click');
    await page.waitForURL(/login/);
  });
});
