import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../../fixtures/auth';
import { SERVICES } from '../../fixtures/services';
import { deleteUser } from '../../fixtures/users';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Companion cleanup for protocol-attach-10x.spec.ts.
 *
 * Reads the run file written by that spec and deletes every protocol / client /
 * exercise it created, plus any TreatmentPlan + portal user attached to the
 * client. Nothing else is touched — the run id in the file acts as the fence.
 *
 * Opt-in only — this spec is skipped unless PA10X_CLEANUP=1 so a routine
 * `make test-desktop` can't accidentally delete inspection resources.
 *
 * Usage:
 *   PA10X_CLEANUP=1 BASE_URL=https://localhost:2774 \
 *     npx playwright test --project=desktop \
 *     tests/desktop/protocol-attach-cleanup.spec.ts
 *
 * Point at a specific run id with:   PA10X_RUN_ID=R123abc …
 * Point at a different file with:    PA10X_RUN_FILE=/path/to/run.json …
 */

const RUN_FILE = process.env.PA10X_RUN_FILE
  || path.join(__dirname, 'protocol-attach-last-run.json');

interface IterationArtifacts {
  iteration: number;
  protocol: string;
  client: string;
  exercises: string[];
}

interface RunRecord {
  runId: string;
  iterations: IterationArtifacts[];
}

function loadRun(): RunRecord | null {
  if (!fs.existsSync(RUN_FILE)) return null;
  const raw = JSON.parse(fs.readFileSync(RUN_FILE, 'utf8'));
  return { runId: raw.runId, iterations: raw.iterations || [] };
}

test('delete all resources created by the last 10x run', async ({ api }) => {
  test.skip(process.env.PA10X_CLEANUP !== '1', 'opt-in only: set PA10X_CLEANUP=1 to delete');
  const record = loadRun();
  test.skip(!record, `no run file at ${RUN_FILE}`);

  const wanted = process.env.PA10X_RUN_ID;
  if (wanted && record!.runId !== wanted) {
    test.skip(true, `run file is for ${record!.runId}, PA10X_RUN_ID=${wanted}`);
  }

  // Delete in child → parent order: plans (and portal users) → clients → protocols → exercises.
  for (const it of record!.iterations) {
    // Plans created from the protocol template, keyed by clientId.
    const client = await api.findOne(SERVICES.clients, `lastName=${it.client}`);
    const clientId = client?.clientId as string | undefined;
    if (clientId) {
      const plans = await api.query(SERVICES.plans, `clientId=${clientId}`);
      for (const p of plans) await api.tryDelete(SERVICES.plans, p.planId);
      await api.tryDelete(SERVICES.clients, clientId);
      // UI-created clients also provision a portal user keyed by clientId / email.
      await deleteUser(api, clientId);
      await deleteUser(api, (client.email as string) || `${it.client.toLowerCase()}@example.com`);
    }

    const proto = await api.findOne(SERVICES.protocols, `name=${it.protocol}`);
    if (proto?.protocolId) await api.tryDelete(SERVICES.protocols, proto.protocolId);

    for (const name of it.exercises) {
      const ex = await api.findOne(SERVICES.exercises, `name=${name}`);
      if (ex?.exerciseId) await api.tryDelete(SERVICES.exercises, ex.exerciseId);
    }
  }

  // Verify nothing from this run is still around (helps catch partial deletes).
  for (const it of record!.iterations) {
    expect(await api.findOne(SERVICES.protocols, `name=${it.protocol}`), it.protocol).toBeUndefined();
    expect(await api.findOne(SERVICES.clients, `lastName=${it.client}`), it.client).toBeUndefined();
    for (const name of it.exercises) {
      expect(await api.findOne(SERVICES.exercises, `name=${name}`), name).toBeUndefined();
    }
  }
});
