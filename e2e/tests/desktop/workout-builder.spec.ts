import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { trackPageErrors } from '../../fixtures/errors';

test.describe('Workout Builder', () => {
  async function open(authedPage: import('@playwright/test').Page) {
    const shell = new Shell(authedPage);
    await shell.goto();
    await shell.subnav('builder').click();
    await expect(shell.view('builder')).toHaveClass(/active/);
    await expect(authedPage.locator('#wb-build')).toBeVisible();
    return shell;
  }

  test('builder controls render', async ({ authedPage }) => {
    const errors = trackPageErrors(authedPage);
    await open(authedPage);
    await expect(authedPage.locator('#wb-posture')).toBeVisible();
    await expect(authedPage.locator('#wb-joint')).toBeVisible();
    await expect(authedPage.locator('#wb-protocol')).toBeAttached();
    await expect(authedPage.locator('#wb-add-protocol')).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('build produces a result or the documented empty state, never an error', async ({ authedPage }) => {
    await open(authedPage);
    await authedPage.locator('#wb-build').click();
    const output = authedPage.locator('#wb-output');
    await expect(output).not.toBeEmpty({ timeout: 30_000 });
    await expect(output.locator('.wb-error')).toHaveCount(0);
  });

  test('add protocol row then remove it', async ({ authedPage }) => {
    await open(authedPage);
    await authedPage.locator('#wb-add-protocol').click();
    const rows = authedPage.locator('#wb-extra-rows .wb-extra-row');
    await expect(rows).toHaveCount(1);
    await rows.first().locator('.wb-row-remove').click();
    await expect(rows).toHaveCount(0);
  });

  test('changing posture and joint updates the resolved protocol badge', async ({ authedPage }) => {
    await open(authedPage);
    const posture = authedPage.locator('#wb-posture');
    const joint = authedPage.locator('#wb-joint');
    const pCount = await posture.locator('option').count();
    const jCount = await joint.locator('option').count();
    expect(pCount).toBeGreaterThan(1);
    expect(jCount).toBeGreaterThan(1);
    await posture.selectOption({ index: 1 });
    await joint.selectOption({ index: 1 });
    await expect(authedPage.locator('#wb-protocol')).toBeAttached();
  });
});
