import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { SERVICES } from '../../fixtures/services';
import { token } from '../../fixtures/env';

// Regression: l8ui used to collect `reference` fields with parseInt(refId, 10), so a UUID such as "741a..."
// was saved as the number 741 and the PUT failed with 400 "invalid value for string field clientId".
// About 10/16 of generated ids start with a digit, so the client is seeded with exactly such an id.
test.describe('reference ids that start with a digit', () => {
  test('editing a plan through the UI keeps its client reference', async ({ authedPage, seed, api }) => {
    const c = await seed.client(token('DigC'), undefined, true);
    expect(c.id).toMatch(/^[0-9]/);
    const p = await seed.plan(c.id, token('DigP'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('plans');
    await table.filterBy('Title', p.marker);
    await table.clickEdit(p.marker);
    await shell.popup.expectOpen();
    await shell.popup.fill({ title: p.marker + 'Z' });
    await shell.popup.save().click();
    await expect.poll(async () => (await api.findOne(SERVICES.plans, `planId=${p.id}`))?.title).toBe(p.marker + 'Z');
    expect((await api.findOne(SERVICES.plans, `planId=${p.id}`))?.clientId).toBe(c.id);
  });
});
