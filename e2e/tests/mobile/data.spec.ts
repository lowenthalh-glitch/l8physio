import { test, expect } from '../../fixtures/auth';
import { MobileShell } from '../../pages/mobile.page';
import { token } from '../../fixtures/env';

// Desktop/mobile functional parity: data created through the API must show on the mobile cards.
test.describe('mobile lists show live data', () => {
  test('therapist appears as a card', async ({ authedPage, seed }) => {
    const th = await seed.therapist(token('MobT'));
    const m = new MobileShell(authedPage);
    await m.goto();
    await m.openService('Therapists');
    await expect(await m.card(th.marker, 'lastName')).toBeVisible({ timeout: 30_000 });
  });

  test('client appears and opens its detail view', async ({ authedPage, seed }) => {
    const c = await seed.client(token('MobC'));
    const m = new MobileShell(authedPage);
    await m.goto();
    await m.openService('Clients');
    const card = await m.card(c.marker, 'lastName');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.click();
    await expect(authedPage.locator('[class*="popup"]').first()).toBeVisible();
  });

  test('exercise appears as a card and row click opens the detail', async ({ authedPage, seed }) => {
    const e = await seed.exercise(token('MobE'));
    const m = new MobileShell(authedPage);
    await m.goto();
    await m.openService('Exercises');
    const card = await m.card(e.marker, 'name');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.click();
    await expect(authedPage.locator('[class*="popup"]').first()).toBeVisible();
  });

  test('appointment and plan lists offer a calendar view', async ({ authedPage }) => {
    const m = new MobileShell(authedPage);
    await m.goto();
    await m.openService('Appointments');
    await m.expectList();
    await expect(authedPage.locator('.l8-view-switcher, [data-view-type], .mobile-view-switcher').first()).toBeVisible();
  });
});
