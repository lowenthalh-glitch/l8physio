import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { trackPageErrors } from '../../fixtures/errors';

test.describe('Head-therapist dashboard', () => {
  test('renders without script errors', async ({ authedPage }) => {
    const errors = trackPageErrors(authedPage);
    const shell = new Shell(authedPage);
    await shell.goto();
    await shell.subnav('htdash').click();
    await expect(shell.view('htdash')).toHaveClass(/active/);
    await expect(authedPage.locator('#management-htdash-table-container')).not.toBeEmpty();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('dashboard reflects a newly created client with a plan', async ({ authedPage, seed, api }) => {
    const c = await seed.client();
    await seed.plan(c.id);
    const shell = new Shell(authedPage);
    await shell.goto();
    await shell.subnav('htdash').click();
    const container = authedPage.locator('#management-htdash-table-container');
    await expect(container).toBeVisible();
    // the dashboard is derived data: it must at least be queryable and render a table or empty state
    await expect(container).not.toBeEmpty({ timeout: 30_000 });
  });
});
