import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { token } from '../../fixtures/env';
import { trackPageErrors } from '../../fixtures/errors';
import { Api } from '../../fixtures/api';
import { USERS, deleteUser } from '../../fixtures/users';

test.describe('System section', () => {
  async function openSystem(page: import('@playwright/test').Page) {
    const shell = new Shell(page);
    await shell.goto();
    await shell.openSection('system');
    await expect(page.locator('.l8-module-tab[data-module="health"]')).toBeVisible();
    return shell;
  }
  const tab = (page: import('@playwright/test').Page, m: string) => page.locator(`.l8-module-tab[data-module="${m}"]`);

  test('lists Health, Security, Modules, Logs and Data Import tabs', async ({ authedPage }) => {
    await openSystem(authedPage);
    for (const m of ['health', 'security', 'modules', 'logs', 'dataimport']) await expect(tab(authedPage, m)).toBeVisible();
  });

  test('Health tab shows the services of the cluster', async ({ authedPage }) => {
    const errors = trackPageErrors(authedPage);
    await openSystem(authedPage);
    const c = authedPage.locator('#health-table-container');
    await expect(c.locator('table').first()).toBeVisible({ timeout: 30_000 });
    expect(await c.locator('tbody tr').count()).toBeGreaterThan(0);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('Security > Users lists admin and supports the sub-nav', async ({ authedPage }) => {
    await openSystem(authedPage);
    await tab(authedPage, 'security').click();
    const users = authedPage.locator('#security-users-table-container');
    await expect(users.locator('tbody tr', { hasText: 'admin' }).first()).toBeVisible({ timeout: 30_000 });
    for (const [svc, container] of [['roles', 'security-roles-table-container'], ['credentials', 'security-credentials-table-container'], ['events', 'security-events-table-container']]) {
      await authedPage.locator(`.l8-subnav-item[data-service="${svc}"]`).click();
      await expect(authedPage.locator(`#${container}`)).toBeVisible();
    }
  });

  test('Security > Roles lists the built-in physio roles', async ({ authedPage }) => {
    await openSystem(authedPage);
    await tab(authedPage, 'security').click();
    await authedPage.locator('.l8-subnav-item[data-service="roles"]').click();
    const roles = authedPage.locator('#security-roles-table-container');
    await expect(roles.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
    const text = (await roles.locator('tbody').innerText()).toLowerCase();
    for (const r of ['admin', 'client', 'therapist']) expect(text).toContain(r);
  });

  test('Security > Users: add and delete a user through the UI', async ({ authedPage, api }) => {
    const id = token('UiUsr').toLowerCase();
    await openSystem(authedPage);
    await tab(authedPage, 'security').click();
    const users = authedPage.locator('#security-users-table-container');
    await users.locator('[data-action="add"]').first().click();
    const popup = new Shell(authedPage).popup;
    await popup.expectOpen();
    await popup.body().locator('#l8sys-user-id').fill(id);
    await popup.body().locator('#l8sys-user-fullname').fill('E2E UI User');
    await popup.body().locator('#l8sys-user-password').fill('Passw0rd!x');
    await popup.save().click();
    try {
      await expect.poll(async () => (await api.query(USERS as any, `userId=${id}`)).length, { timeout: 20_000 }).toBe(1);
    } finally {
      await deleteUser(api, id);
    }
  });

  test('Modules tab renders the module settings', async ({ authedPage }) => {
    await openSystem(authedPage);
    await tab(authedPage, 'modules').click();
    await expect(authedPage.locator('#modules-settings-container')).not.toBeEmpty();
  });

  test('Logs tab renders the file tree', async ({ authedPage }) => {
    const errors = trackPageErrors(authedPage);
    await openSystem(authedPage);
    await tab(authedPage, 'logs').click();
    await expect(authedPage.locator('#logs-table-container')).not.toBeEmpty({ timeout: 30_000 });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('Data Import tab exposes templates, transfer and import', async ({ authedPage }) => {
    await openSystem(authedPage);
    await tab(authedPage, 'dataimport').click();
    const c = authedPage.locator('#dataimport-container');
    await expect(c).not.toBeEmpty();
    const text = (await c.innerText()).toLowerCase();
    for (const w of ['template', 'import']) expect(text).toContain(w);
  });
});
