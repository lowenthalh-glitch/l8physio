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

test.describe('AI Agent chat (needs the LLM, see make llm)', () => {
  test('sending a message shows an assistant reply', async ({ authedPage }) => {
    test.setTimeout(120_000);
    const shell = new Shell(authedPage);
    await shell.goto();
    await shell.openSection('aia');
    const chat = authedPage.locator('#aia-chat-container');
    await chat.locator('.l8agent-chat-input').fill('Reply with the single word PONG.');
    await chat.locator('.l8agent-send-btn').click();

    await expect(chat.locator('.l8agent-msg-user .l8agent-msg-body').last()).toHaveText('Reply with the single word PONG.');
    const reply = chat.locator('.l8agent-msg-assistant .l8agent-msg-body').last();
    await expect(reply).toBeVisible({ timeout: 90_000 });
    await expect(chat.locator('.l8agent-loading')).toHaveCount(0);
    const text = (await reply.innerText()).trim();
    expect(text, 'assistant reply').not.toMatch(/^Error:|^No response$/);
    expect(text).toMatch(/pong/i);
  });
});
