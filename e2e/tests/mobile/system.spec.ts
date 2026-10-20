import { test, expect } from '../../fixtures/auth';
import { MobileShell } from '../../pages/mobile.page';
import { trackPageErrors } from '../../fixtures/errors';

test.describe('mobile System & AI Agent', () => {
  test('System module opens without script errors', async ({ authedPage }) => {
    const errors = trackPageErrors(authedPage);
    const m = new MobileShell(authedPage);
    await m.goto();
    await m.openModule('System');
    await expect(authedPage.locator('#content-area')).not.toBeEmpty();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('AI Agent module opens', async ({ authedPage }) => {
    const m = new MobileShell(authedPage);
    await m.goto();
    await m.openModule('AI Agent');
    await expect(authedPage.locator('#content-area')).not.toBeEmpty();
  });
});
