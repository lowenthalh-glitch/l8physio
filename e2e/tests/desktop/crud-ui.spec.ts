import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { SERVICES, PhysioService } from '../../fixtures/services';
import { token } from '../../fixtures/env';

interface UiCase {
  svc: PhysioService;
  /** Column header that holds the marker value (used for the column filter). */
  column: string;
  /** Form field key edited in the edit test (== svc.markerField). */
  field: string;
  /** Fields typed when creating through the UI; undefined = create only via API (required reference pickers). */
  create?: (t: string) => Record<string, string>;
  /** Form has no free-text field to edit (selects only). */
  noEdit?: boolean;
  /** Seeds a row; `rowKey` is the text that identifies it in the table (defaults to the marker). */
  seed: (s: any, t: string) => Promise<{ id: string; marker: string; rowKey?: string }>;
}

const CASES: UiCase[] = [
  {
    svc: SERVICES.therapists, column: 'Last', field: 'lastName',
    create: t => ({ firstName: 'E2E', lastName: t, email: `${t}@example.com`, phone: '5551110000' }),
    seed: (s, t) => s.therapist(t),
  },
  {
    svc: SERVICES.exercises, column: 'Name', field: 'name',
    create: t => ({ name: t, description: 'created by e2e' }),
    seed: (s, t) => s.exercise(t),
  },
  {
    svc: SERVICES.protocols, column: 'Protocol Name', field: 'name',
    create: t => ({ name: t, description: 'created by e2e' }),
    seed: (s, t) => s.protocol(t),
  },
  {
    svc: SERVICES.appointments, column: 'Location', field: 'location',
    seed: async (s, t) => { const c = await s.client(); const th = await s.therapist(); return s.appointment(c.id, th.id, t); },
  },
  {
    svc: SERVICES.progress, column: 'Notes', field: 'generalNotes',
    seed: async (s, t) => { const c = await s.client(); return s.progress(c.id, t); },
  },
  {
    svc: SERVICES.reports, column: 'Client', field: 'notes',
    seed: async (s, t) => { const c = await s.client(); const th = await s.therapist(); return { ...(await s.report(c.id, th.id, t)), rowKey: c.id }; },
  },
  {
    svc: SERVICES.feedback, column: 'Client', field: 'notes', noEdit: true,
    seed: async (s, t) => { const c = await s.client(); const th = await s.therapist(); return { ...(await s.feedback(c.id, th.id, t)), rowKey: c.id }; },
  },
];

for (const c of CASES) {
  test.describe(`${c.svc.label} - UI CRUD`, () => {
    test('row detail opens read-only with the stored value', async ({ authedPage, seed }) => {
      const t = token('View');
      const seeded = await c.seed(seed, t);
      const key = seeded.rowKey ?? t;
      const shell = new Shell(authedPage);
      await shell.goto();
      const table = await shell.openService(c.svc.key);
      await table.expectLoaded();
      await table.filterBy(c.column, key);
      await table.openRow(key);
      await shell.popup.expectOpen();
      // view popups are read-only: label/value text, no editable inputs for the entity
      if (!seeded.rowKey) await expect(shell.popup.body()).toContainText(t);
      await expect(shell.popup.save()).toHaveCount(0);
      await shell.popup.close().click();
      await shell.popup.expectClosed();
    });

    test('edit persists the change', async ({ authedPage, seed, api }) => {
      test.skip(!!c.noEdit, 'form has only select fields');
      const t = token('Edt');
      const created = await c.seed(seed, t);
      const key = created.rowKey ?? t;
      const shell = new Shell(authedPage);
      await shell.goto();
      const table = await shell.openService(c.svc.key);
      await table.filterBy(c.column, key);
      await table.clickEdit(key);
      await shell.popup.expectOpen();
      const edited = t + 'Z';
      await shell.popup.fill({ [c.field]: edited });
      await shell.popup.save().click();
      await shell.popup.expectClosed();
      await expect.poll(async () => (await api.findOne(c.svc, `${c.svc.idField}=${created.id}`))?.[c.svc.markerField]).toBe(edited);
    });

    test('delete removes the row after confirmation', async ({ authedPage, seed, api }) => {
      const t = token('Del');
      const created = await c.seed(seed, t);
      const key = created.rowKey ?? t;
      const shell = new Shell(authedPage);
      await shell.goto();
      const table = await shell.openService(c.svc.key);
      await table.filterBy(c.column, key);
      await table.clickDelete(key);
      await shell.popup.confirmDelete();
      await shell.popup.expectClosed();
      await expect.poll(async () => api.findOne(c.svc, `${c.svc.idField}=${created.id}`)).toBeUndefined();
    });

    test('cancelling the delete confirmation keeps the row', async ({ authedPage, seed }) => {
      const t = token('Keep');
      const kept = await c.seed(seed, t);
      const key = kept.rowKey ?? t;
      const shell = new Shell(authedPage);
      await shell.goto();
      const table = await shell.openService(c.svc.key);
      await table.filterBy(c.column, key);
      await table.clickDelete(key);
      await expect(shell.popup.title()).toHaveText(/Confirm Delete/i);
      await shell.popup.cancel().click();
      await shell.popup.expectClosed();
      await expect(table.rowByText(key)).toBeVisible();
    });

    if (c.create) {
      test('create through the Add form', async ({ authedPage, api }) => {
        const t = token('New');
        const shell = new Shell(authedPage);
        await shell.goto();
        const table = await shell.openService(c.svc.key);
        await table.expectLoaded();
        await table.addButton().click();
        await shell.popup.expectOpen();
        await shell.popup.fill(c.create!(t));
        await shell.popup.save().click();
        await shell.popup.expectClosed();
        let id: string | undefined;
        try {
          await expect.poll(async () => {
            const e = await api.findOne(c.svc, `${c.svc.markerField}=${t}`);
            id = e?.[c.svc.idField];
            return !!e;
          }).toBeTruthy();
        } finally {
          await api.tryDelete(c.svc, id);
        }
      });

      test('required fields block saving an empty form', async ({ authedPage, api }) => {
        const shell = new Shell(authedPage);
        await shell.goto();
        const table = await shell.openService(c.svc.key);
        const before = (await api.query(c.svc)).length;
        await table.addButton().click();
        await shell.popup.expectOpen();
        await shell.popup.save().click();
        // validation keeps the popup open (or surfaces an error) and nothing is created
        await expect(shell.popup.root()).toBeVisible();
        expect((await api.query(c.svc)).length).toBe(before);
      });
    }
  });
}
