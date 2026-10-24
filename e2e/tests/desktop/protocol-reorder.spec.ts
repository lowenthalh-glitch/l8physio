import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { SERVICES } from '../../fixtures/services';

/**
 * Verifies the l8ui inlineTable `reorderable:true` flag added to the
 * PhysioProtocol `exercises` field:
 *   - ▲ ▼ buttons render in each row's actions column
 *   - clicking ▼ on row N swaps it with N+1
 *   - orderIndex is renumbered (1-based) when the field has one
 *   - the new order persists after Save
 */

const RUN_ID = `O${Date.now().toString(36)}`;

async function createExerciseAPI(api: any, name: string) {
  const resp = await api.post(SERVICES.exercises, { name, description: 'reorder-test', isActive: true });
  if (!resp.ok()) throw new Error(`exercise ${name} HTTP ${resp.status()}`);
  const ex = await api.findOne(SERVICES.exercises, `name=${name}`);
  if (!ex) throw new Error(`exercise ${name} not found after create`);
  return ex;
}

async function createProtocolAPI(api: any, name: string, exs: Array<{ exerciseId: string; name: string }>) {
  // Populate exerciseName so the row-renderer shows the readable name instead
  // of the raw exerciseId UUID — matches what the UI reference-picker writes.
  const exercises = exs.map((e, i) => ({
    protocolExerciseId: '',
    exerciseId:   e.exerciseId,
    exerciseName: e.name,
    orderIndex:   i + 1,
    sets:         3,
    reps:         10,
  }));
  const resp = await api.post(SERVICES.protocols, { name, description: 'reorder-test', isActive: true, exercises });
  if (!resp.ok()) throw new Error(`protocol HTTP ${resp.status()}`);
  const p = await api.findOne(SERVICES.protocols, `name=${name}`);
  if (!p) throw new Error('protocol not found after create');
  return p;
}

test('protocol exercises: ▲▼ reorder in inline table persists orderIndex', async ({ authedPage, api }) => {
  // eslint-disable-next-line no-console
  console.log(`[protocol-reorder] run id: ${RUN_ID}`);

  const exNames = ['Alpha', 'Bravo', 'Charlie', 'Delta'].map(x => `ExOR${RUN_ID}${x}`);
  const protoName = `ProtoOR${RUN_ID}`;

  // Seed via API to keep the test fast and focused on the reorder UX.
  const exs = [];
  for (const n of exNames) exs.push(await createExerciseAPI(api, n));
  const proto = await createProtocolAPI(api, protoName, exs.map(e => ({ exerciseId: e.exerciseId, name: e.name })));

  const shell = new Shell(authedPage);
  await shell.goto();
  const t = await shell.openService('protocols');
  await t.filterBy('Protocol Name', protoName);
  await t.clickEdit(protoName);
  await shell.popup.expectOpen();

  // Switch to Exercises tab where the inline-table lives.
  await shell.popup.root().locator('.probler-popup-tab', { hasText: 'Exercises' }).first().click();
  const inline = shell.popup.root().locator('.form-inline-table[data-inline-table="exercises"]');
  await expect(inline).toBeVisible();

  // Starting order: Alpha, Bravo, Charlie, Delta (by exerciseName column).
  const rows = () => inline.locator('.form-inline-table-body > .form-inline-table-row');
  await expect(rows()).toHaveCount(4);

  // Reorderable markers: both buttons present on middle rows, first ▲ and last ▼ disabled.
  await expect(rows().nth(0).locator('[data-action="move-up-row"]')).toBeDisabled();
  await expect(rows().nth(3).locator('[data-action="move-down-row"]')).toBeDisabled();

  // Move Alpha (row 0) down twice → should land at index 2 (Bravo, Charlie, Alpha, Delta).
  await rows().nth(0).locator('[data-action="move-down-row"]').click();
  await rows().nth(1).locator('[data-action="move-down-row"]').click();

  // Visually: the row at index 2 now carries Alpha.
  await expect(rows().nth(0)).toContainText(exNames[1]); // Bravo
  await expect(rows().nth(1)).toContainText(exNames[2]); // Charlie
  await expect(rows().nth(2)).toContainText(exNames[0]); // Alpha
  await expect(rows().nth(3)).toContainText(exNames[3]); // Delta

  // Save the Protocol and reopen to confirm persistence.
  await shell.popup.save().click();
  await shell.popup.expectClosed();

  // API-side: orderIndex must have been renumbered 1..4 matching the new order.
  const after = await api.findOne(SERVICES.protocols, `protocolId=${proto.protocolId}`);
  const byName = new Map(after.exercises.map((e: any) => [e.exerciseId, e.orderIndex]));
  expect(byName.get(exs[1].exerciseId)).toBe(1); // Bravo
  expect(byName.get(exs[2].exerciseId)).toBe(2); // Charlie
  expect(byName.get(exs[0].exerciseId)).toBe(3); // Alpha (moved down twice)
  expect(byName.get(exs[3].exerciseId)).toBe(4); // Delta

  // Cleanup — leave the DB tidy regardless of pass/fail.
  await api.tryDelete(SERVICES.protocols, proto.protocolId);
  for (const e of exs) await api.tryDelete(SERVICES.exercises, e.exerciseId);
});
