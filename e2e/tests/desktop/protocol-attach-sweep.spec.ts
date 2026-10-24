import { test, expect } from '../../fixtures/auth';
import { SERVICES } from '../../fixtures/services';
import { deleteUser } from '../../fixtures/users';

/**
 * One-off sweep: delete every PhysioExercise, PhysioProtocol, PhysioClient and
 * TreatmentPlan whose marker starts with one of the run-id prefixes passed in
 * PA10X_SWEEP_PREFIXES (comma-separated — e.g. "Rmvjv7dy7,Rmvjuu26u"). Used to
 * clean up orphan artifacts left by failed / stopped protocol-attach-10x runs
 * whose records never made it into the run file.
 *
 * Skipped unless PA10X_SWEEP=1.
 */

test('sweep orphans matching PA10X_SWEEP_PREFIXES', async ({ api }) => {
  test.skip(process.env.PA10X_SWEEP !== '1', 'opt-in only: set PA10X_SWEEP=1');
  const raw = process.env.PA10X_SWEEP_PREFIXES || '';
  const prefixes = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (prefixes.length === 0) test.fail(true, 'PA10X_SWEEP_PREFIXES is required');

  const match = (value: string | undefined, kind: 'Ex' | 'Proto' | 'Cli') =>
    !!value && prefixes.some(p => value.startsWith(`${kind}${p}`));

  // Pull full tables (test resources only — service lists remain small).
  const [exercises, protocols, clients] = await Promise.all([
    api.query(SERVICES.exercises),
    api.query(SERVICES.protocols),
    api.query(SERVICES.clients),
  ]);

  // Plans attach to a client → key the plan sweep off the matched clients.
  const victimClients = clients.filter((c: any) => match(c.lastName, 'Cli'));
  const planLists = await Promise.all(
    victimClients.map((c: any) => api.query(SERVICES.plans, `clientId=${c.clientId}`)),
  );
  const victimPlans = planLists.flat();

  const victimProtocols = protocols.filter((p: any) => match(p.name, 'Proto'));
  const victimExercises = exercises.filter((e: any) => match(e.name, 'Ex'));

  // eslint-disable-next-line no-console
  console.log(
    `[sweep] prefixes=${prefixes.join(',')} plans=${victimPlans.length} ` +
    `clients=${victimClients.length} protocols=${victimProtocols.length} exercises=${victimExercises.length}`,
  );

  for (const p of victimPlans)       await api.tryDelete(SERVICES.plans,     p.planId);
  for (const c of victimClients) {
    await api.tryDelete(SERVICES.clients, c.clientId);
    await deleteUser(api, c.clientId);
    if (c.email) await deleteUser(api, c.email);
  }
  for (const p of victimProtocols)   await api.tryDelete(SERVICES.protocols, p.protocolId);
  for (const e of victimExercises)   await api.tryDelete(SERVICES.exercises, e.exerciseId);

  // Verify.
  const [exAfter, prAfter, clAfter] = await Promise.all([
    api.query(SERVICES.exercises),
    api.query(SERVICES.protocols),
    api.query(SERVICES.clients),
  ]);
  expect(exAfter.filter((e: any) => match(e.name, 'Ex')), 'exercises remaining').toEqual([]);
  expect(prAfter.filter((p: any) => match(p.name, 'Proto')), 'protocols remaining').toEqual([]);
  expect(clAfter.filter((c: any) => match(c.lastName, 'Cli')), 'clients remaining').toEqual([]);
});
