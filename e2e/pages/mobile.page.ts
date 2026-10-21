import { Locator, Page, expect } from '@playwright/test';

/** Mobile bundle: /m/app.html (card based, drill-down navigation). */
export class MobileShell {
  constructor(readonly page: Page) {}

  async goto(path = '/m/app.html') {
    await this.page.goto(path);
    await expect(this.page.locator('.mobile-header')).toBeVisible();
  }

  async openSidebar() {
    await this.page.locator('#menu-toggle').click();
    await expect(this.page.locator('#sidebar')).toBeVisible();
  }

  async openModule(label: string) {
    await this.openSidebar();
    await this.page.locator('#sidebar .sidebar-item', { hasText: label }).click();
  }

  navCard = (label: string): Locator => this.page.locator('.nav-card', { hasText: label }).first();
  cards = (): Locator => this.page.locator('.mobile-edit-table-card, .mobile-table-card');
  tableCards = (): Locator => this.page.locator('.mobile-edit-table-cards, .mobile-table-cards');

  /** Physiotherapy -> Management -> <service label>. */
  async openService(label: string) {
    await this.openModule('Physiotherapy');
    const mgmt = this.navCard('Management');
    if (await mgmt.count()) await mgmt.click();
    await this.navCard(label).click();
  }

  async expectList() {
    await expect(this.page.locator('.mobile-edit-table-wrapper, .mobile-edit-table-empty, .mobile-table-wrapper, .mobile-table-empty, .nav-empty-state').first()).toBeVisible();
  }

  /**
   * Filter the open list (when a filter box exists) and return the card containing `text`. Pass the column key
   * the text lives in: the "All Columns" filter queries a field named Id, which the physio types do not have.
   */
  async card(text: string, column?: string): Promise<Locator> {
    const select = this.page.locator('.mobile-edit-table-column-select, .mobile-table-column-select').first();
    if (column && await select.count()) await select.selectOption(column);
    const filter = this.page.locator('.mobile-edit-table-filters input, .mobile-table-filters input').first();
    if (await filter.count()) await filter.fill(text);
    return this.page.locator('.mobile-edit-table-card, .mobile-table-card', { hasText: text }).first();
  }

  logout = () => this.page.locator('.sidebar-logout-btn');
}
