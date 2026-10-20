import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { token } from '../../fixtures/env';

test.describe('Appointments', () => {
  test('list resolves client and therapist ids to names', async ({ authedPage, seed }) => {
    const c = await seed.client(token('ApC'));
    const th = await seed.therapist(token('ApT'));
    const a = await seed.appointment(c.id, th.id, token('ApL'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('appointments');
    await table.filterBy('Location', a.marker);
    const row = table.rowByText(a.marker);
    await expect(row).toContainText(c.marker);
    await expect(row).toContainText(th.marker);
  });

  test('add form requires client, therapist, start and end', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    const table = await shell.openService('appointments');
    await table.addButton().click();
    await shell.popup.expectOpen();
    for (const k of ['clientId', 'therapistId', 'planId', 'startTime', 'endTime', 'status', 'location', 'therapistNotes', 'clientNotes']) {
      await expect(shell.popup.field(k), k).toBeAttached();
    }
  });
});
