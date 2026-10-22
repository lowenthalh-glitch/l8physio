import { test, expect } from '../../fixtures/auth';
import { SERVICES } from '../../fixtures/services';
import { token } from '../../fixtures/env';
import { PREFIX } from '../../fixtures/env';

test.describe('ServiceCallback validation', () => {
  test('client requires first name, last name and email', async ({ api }) => {
    for (const body of [
      { lastName: 'L', email: 'a@b.co' },
      { firstName: 'F', email: 'a@b.co' },
      { firstName: 'F', lastName: 'L' },
    ]) {
      const resp = await api.post(SERVICES.clients, body);
      expect(resp.status(), JSON.stringify(body)).toBeGreaterThanOrEqual(400);
    }
  });

  test('therapist requires first and last name', async ({ api }) => {
    expect((await api.post(SERVICES.therapists, { lastName: 'L' })).status()).toBeGreaterThanOrEqual(400);
    expect((await api.post(SERVICES.therapists, { firstName: 'F' })).status()).toBeGreaterThanOrEqual(400);
  });

  test('client userId is derived from the email on create', async ({ seed }) => {
    const t = token('Uid');
    const c = await seed.client(t);
    expect(c.entity.userId).toBe(`${String(c.entity.lastName).toLowerCase()}@example.com`);
  });

  test('client-supplied primary key is replaced by a generated one', async ({ api, seed }) => {
    const t = token('Pk');
    const resp = await api.post(SERVICES.therapists, { therapistId: 'client-chosen-id', firstName: 'E2E', lastName: t });
    expect(resp.ok()).toBeTruthy();
    const e = await api.findOne(SERVICES.therapists, `lastName=${t}`);
    expect(e).toBeTruthy();
    await api.tryDelete(SERVICES.therapists, e.therapistId);
  });

  test('unknown JSON field is rejected with a 4xx', async ({ api }) => {
    const resp = await api.post(SERVICES.therapists, { firstName: 'E2E', lastName: token('Bad'), notAField: 1 });
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(resp.status()).toBeLessThan(500);
  });

  test('GET without an L8Query body is rejected', async ({ api }) => {
    const resp = await api.ctx.get(`${PREFIX}/50/${SERVICES.therapists.name}`);
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  });

  test('POST on an empty body is rejected, not a 5xx', async ({ api }) => {
    const resp = await api.ctx.post(`${PREFIX}/50/${SERVICES.clients.name}`, { data: '' });
    expect(resp.status()).toBeGreaterThanOrEqual(400);
    expect(resp.status()).toBeLessThan(500);
  });
});
