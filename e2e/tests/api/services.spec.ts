import { test, expect } from '../../fixtures/auth';
import { SERVICES, WORKOUT, SWAP_LOG, OVERRIDE_LOG } from '../../fixtures/services';
import { PREFIX } from '../../fixtures/env';

test.describe('platform & auxiliary services', () => {
  test('health endpoint answers for an authenticated caller', async ({ api }) => {
    const resp = await api.ctx.get(`${PREFIX}/0/Health`, { params: { body: JSON.stringify({ text: 'select * from L8Health' }) } });
    expect(resp.ok(), await resp.text()).toBeTruthy();
  });

  test('head-therapist dashboard (read-only) can be queried', async ({ api }) => {
    const rows = await api.query(SERVICES.htdash);
    expect(Array.isArray(rows)).toBeTruthy();
  });

  test('head-therapist dashboard rejects writes', async ({ api }) => {
    const resp = await api.post(SERVICES.htdash, { rowId: 'e2e' });
    // read-only: either rejected or a no-op; must not corrupt state with a 5xx
    expect(resp.status()).toBeLessThan(500);
  });

  for (const s of [WORKOUT, SWAP_LOG, OVERRIDE_LOG]) {
    test(`${s.name} can be queried`, async ({ api }) => {
      const rows = await api.query(s);
      expect(Array.isArray(rows)).toBeTruthy();
    });
  }

  test('security API (area 73) lists users', async ({ api }) => {
    const resp = await api.getRaw({ name: 'users', area: 73 }, 'select * from L8User');
    expect(resp.ok(), await resp.text()).toBeTruthy();
    const list = (await resp.json()).list ?? [];
    expect(list.map((u: any) => u.userId)).toContain('admin');
  });

  test('security API (area 74) lists roles', async ({ api }) => {
    const resp = await api.getRaw({ name: 'roles', area: 74 }, 'select * from L8Role');
    expect(resp.ok(), await resp.text()).toBeTruthy();
  });

  test('required system services Events (76) and Notify (78) are active', async ({ api }) => {
    const ev = await api.getRaw({ name: 'Events', area: 76 }, 'select * from EventRecord');
    expect(ev.ok(), 'l8events must be active').toBeTruthy();
    const nt = await api.getRaw({ name: 'Notify', area: 78 }, 'select * from NotifyRecord');
    expect(nt.ok(), 'l8notify must be active (SystemServicesRequired)').toBeTruthy();
    const ic = await api.getRaw({ name: 'IntegCfg', area: 78 }, 'select * from IntegrationConfig');
    expect(ic.ok(), 'IntegrationConfig must be active').toBeTruthy();
  });
});
