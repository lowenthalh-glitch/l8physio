import { Api } from './api';
import { SERVICES, PhysioService } from './services';
import { token } from './env';

const now = () => Math.floor(Date.now() / 1000);
const HOUR = 3600;
/** PhysioPlan/Appointment/ProgressLog require the acting user's id (the UI sends sessionStorage.currentUser). */
const ACTING_USER = 'admin';
/** BoostappCalendarEvent start/end are strings (YYYY-MM-DD HH:MM); the calendar table filters by date prefix. */
const boostTime = (hoursAhead: number) => new Date(Date.now() + hoursAhead * HOUR * 1000).toISOString().slice(0, 16).replace('T', ' ');

export interface Seed { svc: PhysioService; id: string; marker: string; entity: any; }

/** Per-test registry that creates entities through the API and deletes them afterwards. */
export class Seeder {
  private created: Seed[] = [];
  constructor(public readonly api: Api) {}

  /** POST an entity and read it back (ids are generated server-side by the ServiceCallback). */
  async create(svc: PhysioService, body: Record<string, any>): Promise<Seed> {
    const marker = String(body[svc.markerField]);
    const resp = await this.api.post(svc, body);
    if (!resp.ok()) throw new Error(`create ${svc.name} -> HTTP ${resp.status()}: ${await resp.text()}`);
    const entity = await this.api.findOne(svc, `${svc.markerField}=${marker}`);
    if (!entity) throw new Error(`created ${svc.name} ${marker} not found by ${svc.markerField}`);
    const seed = { svc, id: entity[svc.idField], marker, entity };
    this.created.push(seed);
    return seed;
  }

  async therapist(t = token('Ther')) {
    return this.create(SERVICES.therapists, { firstName: 'E2E', lastName: t, email: `${t}@example.com`, phone: '5551230000', specialization: 'Sports', isActive: true });
  }
  /**
   * Creates a client. Ids are generated UUIDs. l8ui's form collector does parseInt() on reference ids, which
   * corrupts any id that starts with a digit (see tests/desktop/reference-id-regression.spec.ts), so by default
   * keep creating clients until the id starts with a letter; pass `digitId` to get the opposite.
   */
  async client(t = token('Cli'), therapistId?: string, digitId = false) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const suffix = attempt === 0 ? '' : `x${attempt}`;
      const name = t + suffix;
      const c = await this.create(SERVICES.clients, { firstName: 'E2E', lastName: name, email: `${name.toLowerCase()}@example.com`, phone: '5551230001', status: 1, ...(therapistId ? { therapistId } : {}) });
      if (/^[0-9]/.test(c.id) === digitId) return c;
      await this.api.tryDelete(SERVICES.clients, c.id);
      this.created = this.created.filter(x => x !== c);
    }
    throw new Error('could not obtain a client id with the requested leading character');
  }
  async exercise(t = token('Ex')) {
    return this.create(SERVICES.exercises, { name: t, description: 'e2e exercise', isActive: true, defaultSets: 3, defaultReps: 10 });
  }
  async protocol(t = token('Proto')) {
    return this.create(SERVICES.protocols, { name: t, description: 'e2e protocol', isActive: true });
  }
  async plan(clientId: string, t = token('Plan'), therapistId?: string) {
    return this.create(SERVICES.plans, { title: t, clientId, status: 1, userId: ACTING_USER, startDate: now(), endDate: now() + 30 * 24 * HOUR, ...(therapistId ? { therapistId } : {}) });
  }
  async appointment(clientId: string, therapistId: string, t = token('Loc')) {
    return this.create(SERVICES.appointments, { clientId, therapistId, userId: ACTING_USER, startTime: now() + HOUR, endTime: now() + 2 * HOUR, status: 1, location: t });
  }
  async progress(clientId: string, t = token('Note')) {
    const plan = await this.plan(clientId);
    return this.create(SERVICES.progress, { clientId, planId: plan.id, userId: ACTING_USER, logDate: now(), overallPainLevel: 3, generalNotes: t });
  }
  async report(clientId: string, therapistId: string, t = token('Note')) {
    return this.create(SERVICES.reports, { clientId, therapistId, sessionDate: now(), painBefore: 4, painDuring: 3, painAfter: 2, status: 1, notes: t });
  }
  async feedback(clientId: string, therapistId: string, t = token('Note')) {
    return this.create(SERVICES.feedback, { clientId, therapistId, feedbackDate: now(), painBefore: 3, painDuring: 2, painAfter: 1, status: 1, notes: t });
  }
  async boostapp(t = token('Evt')) {
    return this.create(SERVICES.boostapp, { title: t, startTime: boostTime(24), endTime: boostTime(25), coachName: 'E2E Coach' });
  }

  /** Delete in reverse creation order (children before parents). Never throws. */
  async cleanup(): Promise<void> {
    for (const s of this.created.reverse()) await this.api.tryDelete(s.svc, s.id);
    this.created = [];
  }
}

/** Builds the minimal valid payload for each CRUD service, creating prerequisites as needed. */
export async function payloadFor(seeder: Seeder, svc: PhysioService, t: string): Promise<Record<string, any>> {
  const n = Math.floor(Date.now() / 1000);
  switch (svc.key) {
    case 'therapists': return { firstName: 'E2E', lastName: t, email: `${t}@example.com`, isActive: true };
    case 'clients':    return { firstName: 'E2E', lastName: t, email: `${t.toLowerCase()}@example.com`, status: 1 };
    case 'exercises':  return { name: t, description: 'e2e', isActive: true };
    case 'protocols':  return { name: t, description: 'e2e', isActive: true };
    case 'boostapp':   return { title: t, startTime: boostTime(24), endTime: boostTime(25), coachName: 'E2E' };
    default: break;
  }
  const c = await seeder.client();
  const th = await seeder.therapist();
  switch (svc.key) {
    case 'plans':        return { title: t, clientId: c.id, userId: ACTING_USER, status: 1, startDate: n, endDate: n + 86400 };
    case 'appointments': return { clientId: c.id, therapistId: th.id, userId: ACTING_USER, startTime: n + HOUR, endTime: n + 2 * HOUR, status: 1, location: t };
    case 'progress':     return { clientId: c.id, planId: (await seeder.plan(c.id)).id, userId: ACTING_USER, logDate: n, overallPainLevel: 3, generalNotes: t };
    case 'reports':      return { clientId: c.id, therapistId: th.id, sessionDate: n, painBefore: 3, painDuring: 2, painAfter: 1, status: 1, notes: t };
    case 'feedback':     return { clientId: c.id, therapistId: th.id, feedbackDate: n, painBefore: 3, painDuring: 2, painAfter: 1, status: 1, notes: t };
    default: throw new Error('no payload for ' + svc.key);
  }
}
