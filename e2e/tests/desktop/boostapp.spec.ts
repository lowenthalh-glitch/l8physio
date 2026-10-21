import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { token } from '../../fixtures/env';
import { trackPageErrors } from '../../fixtures/errors';

test.describe('Boostapp Calendar', () => {
  test('seeded calendar event is listed', async ({ authedPage, seed }) => {
    const e = await seed.boostapp(token('Bst'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('boostapp');
    await table.expectLoaded();
    await table.filterBy('Title', e.marker);
    await expect(table.rowByText(e.marker)).toBeVisible();
  });

  test('clicking an event opens the session view or warns that no clients are linked', async ({ authedPage, seed }) => {
    const errors = trackPageErrors(authedPage);
    const e = await seed.boostapp(token('BstClick'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('boostapp');
    await table.filterBy('Title', e.marker);
    await table.openRow(e.marker);
    // session-view.js: a popup with one tab per linked client, an info toast when no participants, a warning when none is linked
    await expect(authedPage.locator('.probler-popup-container, .layer8d-notification-info, .layer8d-notification-warning').first()).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('table shows the expected columns', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('boostapp');
    await table.expectLoaded();
    const heads = (await table.headers().allTextContents()).join('|');
    for (const h of ['Title', 'Start', 'End', 'Coach', 'Location']) expect(heads).toContain(h);
  });
});
