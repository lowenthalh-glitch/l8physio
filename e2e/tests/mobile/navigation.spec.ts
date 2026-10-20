import { test, expect } from '../../fixtures/auth';
import { MobileShell } from '../../pages/mobile.page';
import { NAV_SERVICES } from '../../fixtures/services';
import { trackPageErrors } from '../../fixtures/errors';

test.describe('mobile navigation (card based, real mobile bundle)', () => {
  test('sidebar lists Physiotherapy, AI Agent and System', async ({ authedPage }) => {
    const m = new MobileShell(authedPage);
    await m.goto();
    await m.openSidebar();
    for (const label of ['Physiotherapy', 'AI Agent', 'System']) {
      await expect(authedPage.locator('#sidebar .sidebar-item', { hasText: label })).toBeVisible();
    }
  });

  test('Physiotherapy drills down to Management and shows every service card', async ({ authedPage }) => {
    const errors = trackPageErrors(authedPage);
    const m = new MobileShell(authedPage);
    await m.goto();
    await m.openModule('Physiotherapy');
    const mgmt = m.navCard('Management');
    if (await mgmt.count()) await mgmt.click();
    for (const s of NAV_SERVICES) await expect(m.navCard(s.label), s.label).toBeVisible();
    await expect(m.navCard('Workout Builder')).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  for (const s of NAV_SERVICES) {
    test(`${s.label} list opens`, async ({ authedPage }) => {
      const errors = trackPageErrors(authedPage);
      const m = new MobileShell(authedPage);
      await m.goto();
      await m.openService(s.label);
      await m.expectList();
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }

  test('back button returns from a list to the service cards', async ({ authedPage }) => {
    const m = new MobileShell(authedPage);
    await m.goto();
    await m.openService('Exercises');
    await m.expectList();
    await authedPage.locator('.data-list-back-btn, .nav-back-btn').first().click();
    await expect(m.navCard('Exercises')).toBeVisible();
  });

  test('refresh button reloads the current view', async ({ authedPage }) => {
    const m = new MobileShell(authedPage);
    await m.goto();
    await authedPage.locator('#refresh-btn').click();
    await expect(authedPage.locator('.mobile-header')).toBeVisible();
  });
});
