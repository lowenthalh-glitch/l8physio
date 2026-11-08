import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import { Api } from './api';
import { Seeder } from './data';
import { USER } from './env';
import { resetPage } from './reset';

type TestFixtures = {
  /** Creates data through the API; everything is deleted after each test. */
  seed: Seeder;
  /**
   * The worker's shared, already-authenticated page (desktop or mobile, following the project). It is booted once
   * per worker by Shell.goto()/MobileShell.goto() and reset between tests. Use `freshPage` when a test needs a
   * clean browser context (boot errors, theme, logout).
   */
  authedPage: Page;
  /** Per-test authenticated page in its own context. */
  freshPage: Page;
};

type WorkerFixtures = {
  /** Authenticated API client (admin), one login per worker. */
  api: Api;
  /** Shared authenticated context + page, created once per worker. */
  session: Page;
};

/**
 * The login page keeps the bearer token in sessionStorage (not covered by Playwright storageState), so each
 * context gets the token injected before any page script runs.
 */
const injectToken = (page: Page, token: string) =>
  page.addInitScript(([tok, user]) => {
    sessionStorage.setItem('bearerToken', tok);
    sessionStorage.setItem('currentUser', user);
  }, [token, USER]);

export const test = base.extend<TestFixtures, WorkerFixtures>({
  api: [async ({}, use, workerInfo) => {
    const api = await Api.as(workerInfo.project.use.baseURL!);
    await use(api);
    await api.dispose();
  }, { scope: 'worker' }],

  // Worker fixtures cannot use the test-scoped `browser` options, so build the context from the project config.
  // Dropping isMobile/hasTouch/userAgent here would silently turn the mobile project into a desktop browser.
  session: [async ({ browser, api }, use, workerInfo) => {
    const u = workerInfo.project.use;
    const context: BrowserContext = await browser.newContext({
      baseURL: u.baseURL,
      ignoreHTTPSErrors: u.ignoreHTTPSErrors,
      viewport: u.viewport,
      userAgent: u.userAgent,
      deviceScaleFactor: u.deviceScaleFactor,
      isMobile: u.isMobile,
      hasTouch: u.hasTouch,
    });
    const page = await context.newPage();
    await injectToken(page, api.token);
    await use(page);
    await context.close();
  }, { scope: 'worker' }],

  seed: async ({ api }, use) => {
    const seeder = new Seeder(api);
    await use(seeder);
    await seeder.cleanup();
  },

  authedPage: async ({ session }, use, testInfo) => {
    await resetPage(session);
    await use(session);
    // Playwright's automatic screenshot covers the test's own `page`, not the shared one.
    if (testInfo.status !== testInfo.expectedStatus) {
      try { await testInfo.attach('shared-page', { body: await session.screenshot(), contentType: 'image/png' }); } catch { /* page gone */ }
    }
  },

  freshPage: async ({ page, api }, use) => {
    await injectToken(page, api.token);
    await use(page);
  },
});

export { expect };
