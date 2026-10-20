import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { SERVICES } from '../../fixtures/services';
import { token } from '../../fixtures/env';

// Upstream l8ui bug: layer8d-forms-data.js collects `reference` fields with parseInt(refId, 10).
// A UUID such as "741a..." becomes the number 741, the PUT body then carries clientId: 741 and the
// server answers 400 "invalid value for string field clientId". ~10/16 of generated ids start with a digit.
// test.fail() keeps the suite green while the bug is open and turns red the day l8ui is fixed (remove it then).
test.describe('reference ids that start with a digit', () => {
  test.fail(true, 'l8ui parseInt() corrupts reference ids starting with a digit (upstream l8ui fix pending)');

  test('editing an appointment through the UI keeps its client reference', async ({ authedPage, seed, api }) => {
    const c = await seed.client(token('DigC'), undefined, true);
    const th = await seed.therapist();
    const a = await seed.appointment(c.id, th.id, token('DigA'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('appointments');
    await table.filterBy('Location', a.marker);
    await table.clickEdit(a.marker);
    await shell.popup.expectOpen();
    await shell.popup.fill({ location: a.marker + 'Z' });
    await shell.popup.save().click();
    await shell.popup.expectClosed();
    await expect.poll(async () => (await api.findOne(SERVICES.appointments, `apptId=${a.id}`))?.clientId).toBe(c.id);
  });
});
