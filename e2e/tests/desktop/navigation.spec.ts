import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { NAV_SERVICES } from '../../fixtures/services';
import { trackPageErrors } from '../../fixtures/errors';

test.describe('desktop shell & navigation', () => {
  test('sidebar exposes Physiotherapy, AI Agent and System', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    for (const s of ['physio', 'aia', 'system']) await expect(shell.section(s)).toBeVisible();
    await expect(shell.username()).toBeVisible();
  });

  test('app loads with no uncaught script errors (all l8ui scripts present)', async ({ authedPage }) => {
    const errors = trackPageErrors(authedPage);
    const shell = new Shell(authedPage);
    await shell.goto();
    await shell.openSection('aia');
    await shell.openSection('system');
    await shell.openSection('physio');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('all sub-nav entries are present in order', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    const labels = await authedPage.locator('.l8-subnav-item').allTextContents();
    for (const s of NAV_SERVICES) expect(labels.join('|')).toContain(s.label);
    expect(labels.join('|')).toContain('Workout Builder');
  });

  for (const s of NAV_SERVICES) {
    test(`opens ${s.label} and renders its table`, async ({ authedPage }) => {
      const errors = trackPageErrors(authedPage);
      const shell = new Shell(authedPage);
      await shell.goto();
      const table = await shell.openService(s.key);
      // the dashboard is a custom view, not a Layer8DTable
      if (s.key === 'htdash') await expect(table.root).not.toBeEmpty();
      else await table.expectLoaded();
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }

  test('deep link hash selects the service', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto('/app.html');
    await shell.openService('exercises');
    expect(authedPage.url()).toContain('#physio/exercises');
  });

  test('theme switcher toggles the theme menu', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    await authedPage.locator('.layer8d-theme-btn').click();
    await expect(authedPage.locator('.layer8d-theme-menu')).toBeVisible();
  });

  test('home link goes back to the landing redirect', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    await authedPage.locator('.home-btn').click();
    // /index.html is the public entry; it redirects to the login page (which may forward a live session on)
    await authedPage.waitForURL(/index\.html|l8ui\/login|\/$/);
  });
});
