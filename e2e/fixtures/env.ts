export const USER = process.env.E2E_USER || 'admin';
export const PASS = process.env.E2E_PASS || 'admin';
export const CLUSTER = process.env.KIND_CLUSTER || 'l8physio-e2e';
export const NAMESPACE = process.env.KIND_NAMESPACE || 'physio';
// login.json: app.apiPrefix
export const PREFIX = '/physio';
export const AUTH_ENDPOINT = '/physio-auth';
// Every physio service lives in service area 50; security (users/roles) in area 73.
export const AREA = 50;
export const SECURITY_AREA = 73;

/** Short unique alphanumeric token (L8QL values must not contain punctuation). */
export function token(prefix = 'E2E'): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
