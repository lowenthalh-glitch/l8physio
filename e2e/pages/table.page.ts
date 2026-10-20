import { Locator, Page, expect } from '@playwright/test';

/** A Layer8DTable rendered inside `#management-<service>-table-container`. */
export class TablePage {
  readonly root: Locator;
  constructor(private page: Page, readonly serviceKey: string) {
    this.root = page.locator(`#management-${serviceKey}-table-container`);
  }
  table = () => this.root.locator('table.l8-table');
  headers = () => this.root.locator('thead tr.l8-table-header-row th');
  rows = () => this.root.locator('tbody tr[data-row-index]');
  addButton = () => this.root.locator('[data-action="add"]').first();
  pageInfo = () => this.root.locator('.l8-pagination-info');
  pagination = () => this.root.locator('.l8-pagination');
  pageSize = () => this.root.locator('select[data-action="pageSize"]');
  emptyState = () => this.root.locator('.l8-empty-state');

  rowByText(text: string): Locator {
    return this.rows().filter({ hasText: text }).first();
  }

  async expectLoaded() {
    await expect(this.table()).toBeVisible();
  }

  /** Column filter: type into the filter cell under the header with this label. */
  async filterBy(headerLabel: string, value: string) {
    await expect(this.headers().first()).toBeVisible();
    const idx = await this.headers().evaluateAll(
      (ths, label) => ths.findIndex(th => (th.textContent || '').trim().toLowerCase().startsWith((label as string).toLowerCase())),
      headerLabel,
    );
    if (idx < 0) throw new Error(`no column "${headerLabel}"`);
    const input = this.root.locator('tr.l8-table-filter-row td, tr.l8-table-filter-row th').nth(idx).locator('input, select').first();
    await input.fill(value);
  }

  async sortBy(headerLabel: string) {
    await this.headers().filter({ hasText: headerLabel }).first().click();
  }

  async clickEdit(rowText: string) {
    await this.rowByText(rowText).locator('[data-action="edit"]').click();
  }
  async clickDelete(rowText: string) {
    await this.rowByText(rowText).locator('[data-action="delete"]').click();
  }
  async openRow(rowText: string) {
    await this.rowByText(rowText).locator('td').first().click();
  }
}
