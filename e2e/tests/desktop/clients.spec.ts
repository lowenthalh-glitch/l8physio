import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { SERVICES } from '../../fixtures/services';
import { token } from '../../fixtures/env';
import { USERS, deleteUser, DEFAULT_PASSWORD } from '../../fixtures/users';
import { Api } from '../../fixtures/api';

test.describe('Clients', () => {
  test('add form exposes personal, medical and reference fields', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('clients');
    await table.addButton().click();
    await shell.popup.expectOpen();
    for (const k of ['alias', 'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'status', 'diagnosis', 'medicalHistory', 'emergencyContact']) {
      await expect(shell.popup.field(k), k).toBeAttached();
    }
  });

  test('creating a client in the UI provisions a client-portal user', async ({ authedPage, api, baseURL }) => {
    const t = token('UiCli');
    const email = `${t.toLowerCase()}@example.com`;
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('clients');
    await table.addButton().click();
    await shell.popup.expectOpen();
    await shell.popup.fill({ firstName: 'E2E', lastName: t, email });
    await shell.popup.save().click();
    await shell.popup.expectClosed();
    let clientId: string | undefined;
    try {
      await expect.poll(async () => {
        const c = await api.findOne(SERVICES.clients, `lastName=${t}`);
        clientId = c?.clientId;
        return !!c;
      }).toBeTruthy();
      // PhysioUserProvisioning posts to the Security API with the default password and client portal.
      await expect.poll(async () => {
        const r = await Api.login(baseURL!, email, DEFAULT_PASSWORD);
        return r.status === 200 ? r.body.portal : `HTTP ${r.status}`;
      }, { timeout: 30_000 }).toBe('client-app.html');
    } finally {
      await api.tryDelete(SERVICES.clients, clientId);
      if (clientId) await deleteUser(api, clientId);
      await deleteUser(api, email);
    }
  });

  test('clicking a client opens the client exercises / detail view', async ({ authedPage, seed }) => {
    const c = await seed.client(token('Det'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('clients');
    await table.filterBy('Last', c.marker);
    await table.openRow(c.marker);
    await shell.popup.expectOpen();
    // the client row opens the client workspace (workout plan, session reports, ...) titled with the client's name
    await expect(shell.popup.title()).toContainText(c.marker);
    for (const tab of ['Workout Plan', 'Session Reports', 'Statistics', 'Home Feedback', 'Appointments', 'Details']) {
      await expect(shell.popup.body().getByText(tab, { exact: true }).first(), tab).toBeVisible();
    }
  });

  test('client list resolves therapist id to a therapist name', async ({ authedPage, seed }) => {
    const th = await seed.therapist(token('Tn'));
    const c = await seed.client(token('Tc'), th.id);
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('clients');
    await table.filterBy('Last', c.marker);
    const row = table.rowByText(c.marker);
    await expect(row).toContainText(th.marker);
    await expect(row).not.toContainText(th.id);
  });

  test('editing a client alias persists', async ({ authedPage, seed, api }) => {
    const c = await seed.client(token('Al'));
    const alias = token('al').toLowerCase();
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('clients');
    await table.filterBy('Last', c.marker);
    await table.clickEdit(c.marker);
    await shell.popup.expectOpen();
    await shell.popup.fill({ ['alias']: alias });
    await shell.popup.save().click();
    await expect.poll(async () => (await api.findOne(SERVICES.clients, `clientId=${c.id}`))?.alias).toBe(alias);
  });
});
