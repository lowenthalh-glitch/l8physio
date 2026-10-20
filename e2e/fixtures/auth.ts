import { test as base, expect, Page } from '@playwright/test';
import { Api } from './api';
import { Seeder } from './data';
import { USER } from './env';

type Fixtures = {
  /** Authenticated API client (admin). */
  api: Api;
  /** Creates data through the API; everything is deleted after each test. */
  seed: Seeder;
};

type Options = {
  /** Page already holding a valid bearer token in sessionStorage. */
  authedPage: Page;
};

/**
 * The login page keeps the bearer token in sessionStorage (not covered by
 * Playwright storageState), so each context gets the token injected before any
 * page script runs.
 */
export const test = base.extend<Fixtures & Options>({
  api: async ({ baseURL }, use) => {
    const api = await Api.as(baseURL!);
    await use(api);
    await api.dispose();
  },
  seed: async ({ api }, use) => {
    const seeder = new Seeder(api);
    await use(seeder);
    await seeder.cleanup();
  },
  authedPage: async ({ page, api }, use) => {
    await page.addInitScript(([tok, user]) => {
      sessionStorage.setItem('bearerToken', tok);
      sessionStorage.setItem('currentUser', user);
    }, [api.token, USER]);
    await use(page);
  },
});

export { expect };
