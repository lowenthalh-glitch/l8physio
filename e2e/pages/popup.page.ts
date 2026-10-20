import { Locator, Page, expect } from '@playwright/test';

/** The topmost l8ui popup (stacked popups share DOM ids, so always scope to the last one). */
export class Popup {
  constructor(private page: Page) {}
  root = (): Locator => this.page.locator('.probler-popup-container').last();
  title = () => this.root().locator('.probler-popup-title');
  body = () => this.root().locator('.probler-popup-body');
  field = (key: string) => this.body().locator(`#field-${key}`);
  save = () => this.root().locator('.probler-popup-footer .btn-primary');
  cancel = () => this.root().locator('.probler-popup-footer .btn-secondary');
  close = () => this.root().locator('.probler-popup-close');
  anyOpen = () => this.page.locator('.probler-popup-container');

  async expectOpen() { await expect(this.root()).toBeVisible(); }
  async expectClosed() { await expect(this.anyOpen()).toHaveCount(0); }

  /** Multi-section forms render one tab per section; switch to the tab that holds this field. */
  async reveal(key: string) {
    const f = this.field(key);
    if (await f.isVisible()) return;
    const pane = await f.evaluate((el: Element) => el.closest('[data-pane]')?.getAttribute('data-pane') ?? null).catch(() => null);
    if (pane) await this.root().locator(`.probler-popup-tab[data-tab="${pane}"]`).click();
  }

  async fill(values: Record<string, string>) {
    for (const [k, v] of Object.entries(values)) { await this.reveal(k); await this.field(k).fill(v); }
  }
  async check(key: string, on = true) { await this.reveal(key); await this.field(key).setChecked(on); }
  async select(key: string, label: string) { await this.reveal(key); await this.field(key).selectOption({ label }); }

  async confirmDelete() {
    await expect(this.title()).toHaveText(/Confirm Delete/i);
    await this.save().click();
  }
}
