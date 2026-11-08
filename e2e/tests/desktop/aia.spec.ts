import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { trackPageErrors } from '../../fixtures/errors';

// The AI agent is the floating bubble (no sidebar entry).
test.describe('AI Agent bubble', () => {
  const panel = (p: import('@playwright/test').Page) => p.locator('.l8agent-bubble-panel');

  test('bubble opens a chat panel with an input box and no script errors', async ({ authedPage }) => {
    const errors = trackPageErrors(authedPage);
    const shell = new Shell(authedPage);
    await shell.goto();
    await authedPage.locator('.l8agent-bubble-btn').click();
    await expect(panel(authedPage)).toHaveClass(/l8agent-bubble-open/);
    await expect(panel(authedPage).locator('.l8agent-chat-input')).toBeVisible({ timeout: 20_000 });
    await expect(panel(authedPage).getByRole('button', { name: /new/i }).first()).toBeVisible();
    await panel(authedPage).locator('.l8agent-bubble-close').click();
    await expect(panel(authedPage)).not.toHaveClass(/l8agent-bubble-open/);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('sending a message shows the user message and an assistant reply', async ({ authedPage }) => {
    const errors = trackPageErrors(authedPage);
    const shell = new Shell(authedPage);
    await shell.goto();
    await authedPage.locator('.l8agent-bubble-btn').click();
    const chat = panel(authedPage);
    await chat.locator('.l8agent-chat-input').fill('Reply with the single word PONG.');
    await chat.locator('.l8agent-send-btn').click();

    await expect(chat.locator('.l8agent-msg-user .l8agent-msg-body')).toHaveText('Reply with the single word PONG.');
    const reply = chat.locator('.l8agent-msg-assistant .l8agent-msg-body').first();
    await expect(reply).toBeVisible({ timeout: 90_000 });
    await expect(reply).not.toContainText(/^Error:/);
    await expect(reply).not.toHaveText('');
    await expect(chat.locator('.l8agent-loading')).toHaveCount(0);
    expect(errors, errors.join('\n')).toEqual([]);
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
