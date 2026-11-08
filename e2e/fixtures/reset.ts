import { Page } from '@playwright/test';

/**
 * Put the shared page back into a neutral state between tests: a popup left open by the previous test intercepts
 * every click of the next one, and a parked-on-physio section would not reload its data.
 * Desktop: close popups/toasts and the agent bubble, park on the System section (Shell.goto() re-opens physio, which re-fetches its data).
 * Mobile: close popups and go to the home screen.
 * A page that has not booted yet (about:blank) is left alone.
 */
export async function resetPage(page: Page): Promise<void> {
  if (!/\/(m\/)?app\.html/.test(page.url())) return;
  await page.evaluate(() => {
    const w = window as any;
    document.querySelectorAll('.probler-popup-close').forEach(b => (b as HTMLElement).click());
    document.querySelectorAll('.probler-popup-container').forEach(e => e.remove());
    document.querySelectorAll('.layer8d-refpicker-overlay').forEach(e => e.remove());
    // mobile drawer: a drawer left open turns the next test's menu-toggle click into a close
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
    document.querySelectorAll('.layer8d-notification, .layer8d-notification-error').forEach(e => e.remove());
    // the floating agent panel covers the bottom-right of the page and intercepts clicks
    if (w.L8AgentBubble?.close) w.L8AgentBubble.close();
    if (w.L8AgentBubbleMobile?.close) w.L8AgentBubbleMobile.close();
    if (w.Layer8MPopup?.closeAll) w.Layer8MPopup.closeAll();
    if (w.Layer8MNav?.showHome) w.Layer8MNav.showHome();
  });
  const parked = page.locator('.nav-link[data-section="system"]');
  if (await parked.count() && !(await parked.evaluate(el => el.classList.contains('active')))) {
    await parked.click();
    await page.locator('.nav-link[data-section="system"].active').waitFor();
  }
}
