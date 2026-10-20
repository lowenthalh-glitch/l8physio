import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { token } from '../../fixtures/env';

test.describe('shared table behaviour (exercises)', () => {
  test('filter narrows the list to the seeded row', async ({ authedPage, seed }) => {
    const a = await seed.exercise(token('FltA'));
    await seed.exercise(token('FltB'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const t = await shell.openService('exercises');
    await t.expectLoaded();
    await t.filterBy('Name', a.marker);
    await expect(t.rowByText(a.marker)).toBeVisible();
    await expect(t.rows()).toHaveCount(1);
  });

  test('filter with no match shows an empty table', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    const t = await shell.openService('exercises');
    await t.filterBy('Name', 'zzzNoSuchExerciseZzz' + Date.now());
    await expect(t.rows()).toHaveCount(0);
  });

  test('sorting by a column toggles the sort indicator', async ({ authedPage, seed }) => {
    await seed.exercise(token('SrtA'));
    const shell = new Shell(authedPage);
    await shell.goto();
    const t = await shell.openService('exercises');
    await t.expectLoaded();
    await t.sortBy('Name');
    await expect(t.root.locator('.l8-sort-indicator').first()).toBeVisible();
  });

  test('pagination controls and page-size selector exist and work', async ({ authedPage, seed }) => {
    for (let i = 0; i < 3; i++) await seed.exercise(token('Pg' + i));
    const shell = new Shell(authedPage);
    await shell.goto();
    const t = await shell.openService('exercises');
    await t.expectLoaded();
    await expect(t.pagination()).toBeVisible();
    await expect(t.pageInfo()).toBeVisible();
    await t.pageSize().selectOption({ index: 0 });
    await expect(t.rows().first()).toBeVisible();
  });

  test('export menu offers CSV, Excel and PDF', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    const t = await shell.openService('therapists');
    await t.expectLoaded();
    await t.root.locator('[data-action="export-menu"]').first().click();
    for (const k of ['export-csv', 'export-excel', 'export-pdf']) {
      await expect(t.root.locator(`[data-action="${k}"]`)).toBeVisible();
    }
  });

  test('CSV export downloads a file', async ({ authedPage, seed }) => {
    await seed.therapist();
    const shell = new Shell(authedPage);
    await shell.goto();
    const t = await shell.openService('therapists');
    await t.expectLoaded();
    await t.root.locator('[data-action="export-menu"]').first().click();
    const [dl] = await Promise.all([
      authedPage.waitForEvent('download'),
      t.root.locator('[data-action="export-csv"]').click(),
    ]);
    expect(dl.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('new rows appear after the table is reloaded', async ({ authedPage, seed }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    const t = await shell.openService('protocols');
    await t.expectLoaded();
    const p = await seed.protocol(token('Late'));
    await authedPage.reload();
    const t2 = await shell.openService('protocols');
    await t2.filterBy('Protocol Name', p.marker);
    await expect(t2.rowByText(p.marker)).toBeVisible();
  });
});
