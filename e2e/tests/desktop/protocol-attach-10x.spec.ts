import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/auth';
import { Shell } from '../../pages/shell.page';
import { SERVICES } from '../../fixtures/services';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * End-to-end UI flow, run 10 times against distinct resources:
 *   1. create a protocol template
 *   2. create 5 exercises
 *   3. add the 5 exercises to the protocol (via the Protocol form's inline table)
 *   4. attach the protocol to a new client (Create Plan from Template)
 *
 * Resources are left in the DB for inspection. The run id is written to
 * `protocol-attach-last-run.json` next to this spec so the companion cleanup
 * spec (protocol-attach-cleanup.spec.ts) can delete them later.
 *
 * Run against run-local.sh:
 *   BASE_URL=https://localhost:2774 npx playwright test --project=desktop \
 *     tests/desktop/protocol-attach-10x.spec.ts
 */

const RUN_ID = process.env.PA10X_RUN_ID || `R${Date.now().toString(36)}`;
const ITERATIONS = Number(process.env.PA10X_ITERATIONS || 10);
const RUN_FILE = path.join(__dirname, 'protocol-attach-last-run.json');

interface IterationArtifacts {
  iteration: number;
  protocol: string;
  client: string;
  exercises: string[];
}

const run: { runId: string; baseURL?: string; iterations: IterationArtifacts[] } = {
  runId: RUN_ID,
  iterations: [],
};

function marker(prefix: string, i: number, suffix = ''): string {
  return `${prefix}${RUN_ID}i${i}${suffix}`;
}

async function openProtocolAddForm(page: Page, shell: Shell) {
  const table = await shell.openService('protocols');
  await table.expectLoaded();
  await table.addButton().click();
  await shell.popup.expectOpen();
}

async function addExerciseRowToProtocol(page: Page, shell: Shell, exerciseName: string, orderIndex: number) {
  // The Protocol form renders its sections as tabs ("Protocol Details",
  // "Classification", "Exercises"). The inline-table lives in the Exercises
  // pane, which is in the DOM but hidden until its tab is activated. Popup.reveal()
  // keys off `#field-<key>` ids that inlineTable doesn't produce, so switch tabs
  // directly by section title.
  const protocolPopup = shell.popup.root();
  await protocolPopup.locator('.probler-popup-tab', { hasText: 'Exercises' }).first().click();
  const inline = protocolPopup.locator('.form-inline-table[data-inline-table="exercises"]');
  await expect(inline).toBeVisible();
  await inline.locator('button[data-action="add-row"]').click();

  // Row editor popup is now the topmost popup — shell.popup.root() uses .last().
  await shell.popup.expectOpen();
  const rowPopup = shell.popup.root();

  // Pick the exercise via the reference picker. Layer8DReferencePicker.attach()
  // runs asynchronously after the popup renders; it adds the
  // `layer8d-refpicker-input` class and marks the input readOnly once wired.
  // Clicking before then no-ops silently, which caused flakes on later iterations.
  const refInput = rowPopup.locator('input.reference-input[name="exerciseId"].layer8d-refpicker-input').first();
  await expect(refInput).toBeVisible();
  await refInput.click({ force: true });
  const overlay = page.locator('.layer8d-refpicker-overlay');
  await expect(overlay).toBeVisible();
  await overlay.locator('.layer8d-refpicker-search input').first().fill(exerciseName);
  await expect(overlay.locator('.layer8d-refpicker-list').getByText(exerciseName).first()).toBeVisible();
  await overlay.locator('.layer8d-refpicker-list').getByText(exerciseName).first().click();
  await overlay.locator('.layer8d-refpicker-select-btn').click();
  await expect(overlay).toHaveCount(0);

  // Fill numeric row fields on the row-editor popup. Some are optional, but a
  // populated row is more realistic + survives the plan import downstream.
  await rowPopup.locator('input[name="orderIndex"]').first().fill(String(orderIndex));
  await rowPopup.locator('input[name="sets"]').first().fill('3');
  await rowPopup.locator('input[name="reps"]').first().fill('10');

  // Save the row (the row-editor's primary button is "Add").
  await rowPopup.locator('.probler-popup-footer .btn-primary').click();

  // Nested popup closes, outer protocol popup still open. The inline-table body
  // should now contain the picked exercise's name.
  await expect(inline.locator('.form-inline-table-body')).toContainText(exerciseName);
}

test.describe.serial('protocol attach — 10x UI flow', () => {
  test.beforeAll(() => {
    // Fresh run record so cleanup only ever targets this run.
    fs.writeFileSync(RUN_FILE, JSON.stringify({ ...run, startedAt: new Date().toISOString() }, null, 2));
    // eslint-disable-next-line no-console
    console.log(`[protocol-attach-10x] run id: ${RUN_ID} (file: ${RUN_FILE})`);
  });

  for (let i = 1; i <= ITERATIONS; i++) {
    test(`iteration ${i}/${ITERATIONS}`, async ({ authedPage, api, baseURL }) => {
      run.baseURL = baseURL;
      const shell = new Shell(authedPage);
      await shell.goto();

      const protoName = marker('Proto', i);
      const clientLast = marker('Cli', i);
      const clientEmail = `${clientLast.toLowerCase()}@example.com`;
      const exerciseNames = Array.from({ length: 5 }, (_, k) => marker('Ex', i, `e${k + 1}`));

      // ── 1. Create 5 exercises ──────────────────────────────────────────────
      for (const name of exerciseNames) {
        const t = await shell.openService('exercises');
        await t.expectLoaded();
        await t.addButton().click();
        await shell.popup.expectOpen();
        await shell.popup.fill({ name, description: 'protocol-attach-10x' });
        await shell.popup.save().click();
        await shell.popup.expectClosed();
        await expect
          .poll(async () => !!(await api.findOne(SERVICES.exercises, `name=${name}`)))
          .toBeTruthy();
      }

      // ── 2+3. Create protocol template, add 5 exercises via its inline table ─
      await openProtocolAddForm(authedPage, shell);
      await shell.popup.fill({ name: protoName, description: 'protocol-attach-10x' });
      await shell.popup.check('isActive', true);
      for (let k = 0; k < exerciseNames.length; k++) {
        await addExerciseRowToProtocol(authedPage, shell, exerciseNames[k], k + 1);
      }
      await shell.popup.save().click();
      await shell.popup.expectClosed();

      // Confirm the protocol persisted with 5 exercises before moving on.
      let protocolId: string | undefined;
      await expect
        .poll(async () => {
          const p = await api.findOne(SERVICES.protocols, `name=${protoName}`);
          protocolId = p?.protocolId;
          return (p?.exercises || []).length;
        })
        .toBe(5);
      expect(protocolId, 'protocol id').toBeTruthy();

      // ── 4a. Create the client via the UI (same as clients.spec.ts) ─────────
      const t = await shell.openService('clients');
      await t.expectLoaded();
      await t.addButton().click();
      await shell.popup.expectOpen();
      await shell.popup.fill({ firstName: 'PA10x', lastName: clientLast, email: clientEmail });
      await shell.popup.save().click();
      await shell.popup.expectClosed();

      let clientId: string | undefined;
      await expect
        .poll(async () => {
          const c = await api.findOne(SERVICES.clients, `lastName=${clientLast}`);
          clientId = c?.clientId;
          return !!c;
        })
        .toBeTruthy();

      // ── 4b. Attach the protocol: open client workspace → Create Plan from Template.
      const t2 = await shell.openService('clients');
      await t2.filterBy('Last', clientLast);
      await t2.openRow(clientLast);
      await shell.popup.expectOpen();
      await expect(shell.popup.title()).toContainText(clientLast);

      // Fresh client → no active plan yet → the inline "Create Plan from Template" button appears.
      const createFromTplBtn = shell.popup.body().locator('.physio-noplan-import-btn');
      await expect(createFromTplBtn).toBeVisible();
      await createFromTplBtn.click();

      // The import popup is now the topmost; its select lists active protocols by name.
      const importSelect = authedPage.locator('.probler-popup-container').last().locator('#pe-import-select');
      await expect(importSelect).toBeVisible();
      await importSelect.selectOption({ label: protoName });
      await authedPage.locator('.probler-popup-container').last().locator('.probler-popup-footer .btn-primary').click();

      // Verify the plan was created and carries all 5 exercises.
      await expect
        .poll(async () => {
          const plans = await api.query(SERVICES.plans, `clientId=${clientId}`);
          const active = plans.find((p: any) => p.status === 2);
          return (active?.exercises || []).length;
        })
        .toBe(5);

      // Record what was created so the cleanup spec can delete it later.
      run.iterations.push({ iteration: i, protocol: protoName, client: clientLast, exercises: exerciseNames });
      fs.writeFileSync(
        RUN_FILE,
        JSON.stringify({ ...run, startedAt: new Date().toISOString() }, null, 2),
      );
    });
  }
});
