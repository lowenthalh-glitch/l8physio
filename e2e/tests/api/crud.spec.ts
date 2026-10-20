import { test, expect } from '../../fixtures/auth';
import { CRUD_SERVICES } from '../../fixtures/services';
import { payloadFor } from '../../fixtures/data';
import { token } from '../../fixtures/env';

// One lifecycle per service: create -> read -> list -> update -> delete.
for (const svc of CRUD_SERVICES) {
  test.describe(`${svc.label} (${svc.name})`, () => {
    test('full CRUD lifecycle', async ({ api, seed }) => {
      const t = token(svc.key.slice(0, 3).replace(/^./, c => c.toUpperCase()));
      const body = await payloadFor(seed, svc, t);

      // create: the ServiceCallback generates the primary key
      const created = await seed.create(svc, body);
      expect(created.id, 'server must generate the primary key').toBeTruthy();

      // read by primary key
      const byId = await api.findOne(svc, `${svc.idField}=${created.id}`);
      expect(byId).toBeTruthy();
      expect(String(byId[svc.markerField])).toBe(t);

      // list contains it
      const all = await api.query(svc);
      expect(all.map(e => e[svc.idField])).toContain(created.id);

      // update (PUT full entity) - touch the marker-adjacent audit-safe field
      const updatedMarker = t + 'U';
      const put = await api.put(svc, { ...byId, [svc.markerField]: updatedMarker });
      expect(put.ok(), await put.text()).toBeTruthy();
      const after = await api.findOne(svc, `${svc.idField}=${created.id}`);
      expect(String(after[svc.markerField])).toBe(updatedMarker);

      // delete
      const del = await api.delete(svc, created.id);
      expect(del.ok(), await del.text()).toBeTruthy();
      expect(await api.findOne(svc, `${svc.idField}=${created.id}`)).toBeUndefined();
    });

    test('pagination and sort accepted by L8QL', async ({ api, seed }) => {
      await seed.create(svc, await payloadFor(seed, svc, token('Pg')));
      const page0 = await api.query(svc, '', `limit 5 page 0 sort-by ${svc.markerField}`);
      expect(page0.length).toBeLessThanOrEqual(5);
      expect(page0.length).toBeGreaterThan(0);
    });
  });
}
