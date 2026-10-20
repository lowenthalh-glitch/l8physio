import { Page, expect } from '@playwright/test';
import { TablePage } from './table.page';
import { Popup } from './popup.page';

/** Desktop portal shell: /app.html (sidebar sections + physio sub-nav). */
export class Shell {
  readonly popup: Popup;
  constructor(readonly page: Page) { this.popup = new Popup(page); }

  async goto(path = '/app.html') {
    await this.page.goto(path);
    await expect(this.page.locator('nav.sidebar')).toBeVisible();
    await expect(this.page.locator('#content-area')).not.toBeEmpty();
  }

  section = (name: string) => this.page.locator(`.nav-link[data-section="${name}"]`);

  async openSection(name: string) {
    await this.section(name).click();
    await expect(this.section(name)).toHaveClass(/active/);
  }

  subnav = (key: string) => this.page.locator(`.l8-subnav-item[data-service="${key}"]`);
  view = (key: string) => this.page.locator(`.l8-service-view[data-service="${key}"]`);

  async openService(key: string): Promise<TablePage> {
    await this.subnav(key).click();
    await expect(this.view(key)).toHaveClass(/active/);
    return new TablePage(this.page, key);
  }

  username = () => this.page.locator('.user-menu .username');
  logout = () => this.page.locator('.logout-btn');
}
