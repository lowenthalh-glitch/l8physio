import { Api } from './api';
import { SECURITY_AREA } from './env';

export const USERS = { name: 'users', area: SECURITY_AREA, type: 'L8User', idField: 'userId' };
export const DEFAULT_PASSWORD = 'Physio#Pt7x2Q';

/** Provision a portal user exactly as physio-user-provisioning.js does (Security API, area 73). */
export async function provisionUser(api: Api, opts: { userId: string; email: string; fullName: string; role: 'client' | 'therapist'; password?: string }) {
  const resp = await api.post(USERS, {
    userId: opts.userId,
    fullName: opts.fullName,
    email: opts.email,
    accountStatus: 'ACCOUNT_STATUS_ACTIVE',
    portal: opts.role === 'client' ? 'client-app.html' : 'therapist-app.html',
    password: { hash: opts.password ?? DEFAULT_PASSWORD },
    roles: { [opts.role]: true },
  });
  if (!resp.ok()) throw new Error(`provision ${opts.userId} -> HTTP ${resp.status()}: ${await resp.text()}`);
}

export async function deleteUser(api: Api, userId: string) {
  await api.tryDelete(USERS as any, userId);
}
