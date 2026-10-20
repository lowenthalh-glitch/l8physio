import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { trackPageErrors } from '../../fixtures/errors';

test.describe('AI Agent', () => {
  test('chat view renders with an input box and no script errors', async ({ authedPage }) => {
    const errors = trackPageErrors(authedPage);
    const shell = new Shell(authedPage);
    await shell.goto();
    await shell.openSection('aia');
    const chat = authedPage.locator('#aia-chat-container');
    await expect(chat).toBeVisible();
    await expect(chat.locator('textarea, input[type="text"]').first()).toBeVisible({ timeout: 20_000 });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('new conversation control is available', async ({ authedPage }) => {
    const shell = new Shell(authedPage);
    await shell.goto();
    await shell.openSection('aia');
    await expect(authedPage.locator('#aia-chat-container').getByRole('button', { name: /new/i }).first()).toBeVisible({ timeout: 20_000 });
  });
});
