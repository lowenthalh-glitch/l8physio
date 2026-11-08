import { Page, expect } from '@playwright/test';
import { TablePage } from './table.page';
import { Popup } from './popup.page';

/** Desktop portal shell: /app.html (sidebar sections + physio sub-nav). */
export class Shell {
  readonly popup: Popup;
  constructor(readonly page: Page) { this.popup = new Popup(page); }

  /**
   * Boot the shell once per page; on an already booted shared page just return home (physio), which re-fetches
   * the section instead of paying for a full app boot (~2s, ~1000 responses).
   */
  async goto(path = '/app.html') {
    const sidebar = this.page.locator('nav.sidebar');
    if (new URL(this.page.url(), 'http://x').pathname === path && await sidebar.isVisible()) {
      await this.openSection('physio');
      return;
    }
    await this.page.goto(path);
    await expect(sidebar).toBeVisible();
    await expect(this.page.locator('#content-area')).not.toBeEmpty();
  }

  /** Sidebar entry of a section. Physio has one entry per management service, so its "section" is the default one. */
  section = (name: string) => (name === 'physio'
    ? this.page.locator('.nav-link[data-service="therapists"]')
    : this.page.locator(`.nav-link[data-section="${name}"]`)).first();

  /**
   * Open a section and wait for its swap to finish. Returns immediately if it is already active, fully faded in
   * and not marked stale. loadSection() fetches, swaps innerHTML after a delay and fades the area in via the
   * inline opacity, so: tag the current container stale, click, wait for a fresh container and inline opacity 1
   * (never the computed value: the 0.5s transition keeps it ~1 at the start of the fade-out).
   * Switching service inside the already shown physio section swaps no container, so only the click is awaited.
   */
  async openSection(name: string) {
    const link = this.section(name);
    const content = this.page.locator('#content-area');
    const container = content.locator('.section-container');
    const shown = await this.page.evaluate(n => location.hash.startsWith('#' + n), name);
    if (await link.evaluate(el => el.classList.contains('active'))
      && await content.evaluate(el => (el as HTMLElement).style.opacity !== '0')
      && await container.count() && !(await container.first().getAttribute('data-e2e-stale'))) {
      return;
    }
    if (!shown) await container.evaluateAll(els => els.forEach(e => e.setAttribute('data-e2e-stale', '1')));
    await link.click();
    await expect(link).toHaveClass(/active/);
    if (!shown) {
      await expect(content.locator('.section-container:not([data-e2e-stale])')).toHaveCount(1);
      await this.page.waitForFunction(() => (document.getElementById('content-area') as HTMLElement)?.style.opacity === '1');
    }
  }

  /** Sidebar entry of a physio management service. */
  subnav = (key: string) => this.page.locator(`.nav-link[data-service="${key}"]`);
  view = (key: string) => this.page.locator(`.l8-service-view[data-service="${key}"]`);

  async openService(key: string): Promise<TablePage> {
    await this.subnav(key).click();
    await expect(this.subnav(key)).toHaveClass(/active/);
    await expect(this.view(key)).toHaveClass(/active/);
    await this.page.waitForFunction(() => (document.getElementById('content-area') as HTMLElement)?.style.opacity === '1');
    return new TablePage(this.page, key);
  }

  username = () => this.page.locator('.user-menu .username');
  logout = () => this.page.locator('.logout-btn');
}
