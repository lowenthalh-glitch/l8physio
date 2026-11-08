import { Page } from '@playwright/test';

type Router = { current: string[] };
const pageErrorRouters = new WeakMap<Page, Router>();
const apiFailureRouters = new WeakMap<Page, Router>();

/** Attach `attach` to the page once; every later call only swaps the array the events are routed to. */
function route(page: Page, routers: WeakMap<Page, Router>, attach: (page: Page, router: Router) => void): string[] {
  let router = routers.get(page);
  if (!router) { router = { current: [] }; routers.set(page, router); attach(page, router); }
  router.current = [];
  return router.current;
}

/** Collects uncaught page errors (ReferenceError/TypeError from a missing l8ui script kill whole modules silently). */
export function trackPageErrors(page: Page): string[] {
  return route(page, pageErrorRouters, (p, r) => p.on('pageerror', e => r.current.push(e.message)));
}

/** Collects non-2xx/3xx API responses to the physio prefix. */
export function trackApiFailures(page: Page): string[] {
  return route(page, apiFailureRouters, (p, r) => p.on('response', resp => {
    const u = resp.url();
    if (u.includes('/physio/') && resp.status() >= 400) r.current.push(`${resp.status()} ${resp.request().method()} ${u}`);
  }));
}
