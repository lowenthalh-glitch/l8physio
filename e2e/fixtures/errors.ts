import { Page } from '@playwright/test';

/** Collects uncaught page errors (ReferenceError/TypeError from a missing l8ui script kill whole modules silently). */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}

/** Collects non-2xx/3xx API responses to the physio prefix (ignores 401 on explicit auth tests). */
export function trackApiFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on('response', r => {
    const u = r.url();
    if (u.includes('/physio/') && r.status() >= 400) failures.push(`${r.status()} ${r.request().method()} ${u}`);
  });
  return failures;
}
