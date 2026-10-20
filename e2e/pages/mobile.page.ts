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
  cards = (): Locator => this.page.locator('.mobile-table-card-row, .mobile-table-cards > *');
  tableCards = (): Locator => this.page.locator('.mobile-table-cards');

  /** Physiotherapy -> Management -> <service label>. */
  async openService(label: string) {
    await this.openModule('Physiotherapy');
    const mgmt = this.navCard('Management');
    if (await mgmt.count()) await mgmt.click();
    await this.navCard(label).click();
  }

  async expectList() {
    await expect(this.page.locator('.mobile-table-wrapper, .mobile-table-empty, .nav-empty-state').first()).toBeVisible();
  }

  /** Filter the open list (when a filter box exists) and return the card containing `text`. */
  async card(text: string): Promise<Locator> {
    const filter = this.page.locator('.mobile-table-filters input, .mobile-table-filter-row input').first();
    if (await filter.count()) await filter.fill(text);
    return this.page.locator('.mobile-table-cards > *', { hasText: text }).first();
  }

  logout = () => this.page.locator('.sidebar-logout-btn');
}
