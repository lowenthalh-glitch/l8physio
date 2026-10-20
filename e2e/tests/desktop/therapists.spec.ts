import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { SERVICES } from '../../fixtures/services';
import { token } from '../../fixtures/env';
import { deleteUser, DEFAULT_PASSWORD } from '../../fixtures/users';
import { Api } from '../../fixtures/api';

test.describe('Therapists', () => {
  test('creating a therapist with an email provisions a therapist-portal user', async ({ authedPage, api, baseURL }) => {
    const t = token('UiThr');
    const email = `${t.toLowerCase()}@example.com`;
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('therapists');
    await table.addButton().click();
    await shell.popup.expectOpen();
    await shell.popup.fill({ firstName: 'E2E', lastName: t, email });
    await shell.popup.save().click();
    await shell.popup.expectClosed();
    let id: string | undefined;
    try {
      await expect.poll(async () => {
        id = (await api.findOne(SERVICES.therapists, `lastName=${t}`))?.therapistId;
        return !!id;
      }).toBeTruthy();
      await expect.poll(async () => {
        const r = await Api.login(baseURL!, email, DEFAULT_PASSWORD);
        return r.status === 200 ? r.body.portal : `HTTP ${r.status}`;
      }, { timeout: 30_000 }).toBe('therapist-app.html');
    } finally {
      await api.tryDelete(SERVICES.therapists, id);
      if (id) await deleteUser(api, id);
    }
  });

  test('detail popup lists the therapist\'s clients', async ({ authedPage, seed }) => {
    const th = await seed.therapist(token('Cl'));
    const cl = await seed.client(token('Mine'), th.id);
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('therapists');
    await table.filterBy('Last', th.marker);
    await table.openRow(th.marker);
    await shell.popup.expectOpen();
    const tab = shell.popup.body().getByText(/clients/i).first();
    if (await tab.count()) await tab.click();
    await expect(shell.popup.body()).toContainText(cl.marker, { timeout: 20_000 });
  });

  test('active flag can be toggled off', async ({ authedPage, seed, api }) => {
    const th = await seed.therapist(token('Act'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('therapists');
    await table.filterBy('Last', th.marker);
    await table.clickEdit(th.marker);
    await shell.popup.expectOpen();
    await shell.popup.check('isActive', false);
    await shell.popup.save().click();
    await expect.poll(async () => (await api.findOne(SERVICES.therapists, `therapistId=${th.id}`))?.isActive ?? false).toBe(false);
  });
});
