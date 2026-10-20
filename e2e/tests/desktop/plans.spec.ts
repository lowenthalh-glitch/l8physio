import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { SERVICES } from '../../fixtures/services';
import { token } from '../../fixtures/env';

test.describe('Treatment Plans', () => {
  test('plan seeded for a client is listed with title and client', async ({ authedPage, seed }) => {
    const c = await seed.client(token('PlCli'));
    const p = await seed.plan(c.id, token('PlTitle'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('plans');
    await table.filterBy('Title', p.marker);
    await expect(table.rowByText(p.marker)).toBeVisible();
  });

  test('opening a plan shows the plan editor / detail with its title', async ({ authedPage, seed }) => {
    const c = await seed.client(token('PlCli'));
    const p = await seed.plan(c.id, token('PlOpen'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('plans');
    await table.filterBy('Title', p.marker);
    await table.openRow(p.marker);
    await shell.popup.expectOpen();
    await expect(shell.popup.title()).toContainText(p.marker);
    await expect(shell.popup.body()).toContainText(/exercises/i);
  });

  test('plan title can be edited', async ({ authedPage, seed, api }) => {
    const c = await seed.client(token('PlCli'));
    const p = await seed.plan(c.id, token('PlEd'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('plans');
    await table.filterBy('Title', p.marker);
    await table.clickEdit(p.marker);
    await shell.popup.expectOpen();
    const edited = p.marker + 'Z';
    await shell.popup.fill({ ['title']: edited });
    await shell.popup.save().click();
    await expect.poll(async () => (await api.findOne(SERVICES.plans, `planId=${p.id}`))?.title).toBe(edited);
  });

  test('plan can be deleted', async ({ authedPage, seed, api }) => {
    const c = await seed.client(token('PlCli'));
    const p = await seed.plan(c.id, token('PlDel'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('plans');
    await table.filterBy('Title', p.marker);
    await table.clickDelete(p.marker);
    await shell.popup.confirmDelete();
    await expect.poll(async () => api.findOne(SERVICES.plans, `planId=${p.id}`)).toBeUndefined();
  });

  test('add form requires a client reference and opens the reference picker', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('plans');
    await table.addButton().click();
    await shell.popup.expectOpen();
    await expect(shell.popup.field('title')).toBeVisible();
    // reference fields render a picker trigger; clicking opens the l8ui reference picker overlay
    const trigger = shell.popup.body().locator('input.reference-input[name="clientId"]').first();
    await trigger.click({ force: true });
    await expect(authedPage.locator('.layer8d-refpicker-overlay')).toBeVisible();
  });

  test('reference picker selects a client and filters by search', async ({ authedPage, seed }) => {
    const c = await seed.client(token('RefPick'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('plans');
    await table.addButton().click();
    await shell.popup.expectOpen();
    await shell.popup.body().locator('input.reference-input[name="clientId"]').first().click({ force: true });
    const overlay = authedPage.locator('.layer8d-refpicker-overlay');
    await expect(overlay).toBeVisible();
    await overlay.locator('.layer8d-refpicker-search input').first().fill(c.marker);
    const item = overlay.locator('.layer8d-refpicker-list').getByText(c.marker).first();
    await expect(item).toBeVisible();
    await item.click();
    await overlay.locator('.layer8d-refpicker-select-btn').click();
    await expect(overlay).toHaveCount(0);
  });
});
