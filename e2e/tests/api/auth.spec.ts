import { test, expect } from '@playwright/test';
import { Api } from '../../fixtures/api';
import { AUTH_ENDPOINT, PREFIX } from '../../fixtures/env';
import { SERVICES, NAV_SERVICES } from '../../fixtures/services';

test.describe('authentication', () => {
  test('valid credentials return a bearer token', async ({ baseURL }) => {
    const r = await Api.login(baseURL!);
    expect(r.status).toBe(200);
    expect(r.token.length).toBeGreaterThan(10);
  });

  test('wrong password is rejected', async ({ baseURL }) => {
    const r = await Api.login(baseURL!, 'admin', 'definitely-wrong');
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.token).toBe('');
  });

  test('unknown user is rejected', async ({ baseURL }) => {
    const r = await Api.login(baseURL!, 'no-such-user-e2e', 'x');
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.token).toBe('');
  });

  test('empty credentials are rejected', async ({ request }) => {
    const resp = await request.post(AUTH_ENDPOINT, { data: { user: '', pass: '' } });
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  });

  test('malformed auth body is rejected, not a 5xx crash', async ({ request }) => {
    const resp = await request.post(AUTH_ENDPOINT, { data: 'not-json', headers: { 'Content-Type': 'application/json' } });
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(resp.status()).toBeLessThan(500);
  });
});

test.describe('unauthenticated access is denied', () => {
  for (const s of NAV_SERVICES) {
    test(`GET ${s.name} without token`, async ({ request }) => {
      const resp = await request.get(`${PREFIX}/${s.area}/${s.name}`, {
        params: { body: JSON.stringify({ text: `select * from ${s.type}` }) },
      });
      expect([401, 403]).toContain(resp.status());
    });
  }

  test('POST without token', async ({ request }) => {
    const resp = await request.post(`${PREFIX}/50/${SERVICES.clients.name}`, { data: { firstName: 'x', lastName: 'y', email: 'x@y.z' } });
    expect([401, 403]).toContain(resp.status());
  });

  test('forged bearer token', async ({ request }) => {
    const resp = await request.get(`${PREFIX}/50/${SERVICES.clients.name}`, {
      headers: { Authorization: 'Bearer forged.token.value' },
      params: { body: JSON.stringify({ text: `select * from ${SERVICES.clients.type}` }) },
    });
    expect([401, 403]).toContain(resp.status());
  });
});
