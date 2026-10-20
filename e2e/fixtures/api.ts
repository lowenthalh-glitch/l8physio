import { APIRequestContext, APIResponse, request as pwRequest } from '@playwright/test';
import { AUTH_ENDPOINT, PREFIX, USER, PASS } from './env';

export interface ServiceRef {
  name: string;   // ServiceName, e.g. PhyClient
  area: number;
  type: string;   // protobuf type used in L8Query "from"
  idField: string;
}

/** Thin authenticated client for the l8web REST API. */
export class Api {
  constructor(public readonly ctx: APIRequestContext, public readonly token: string) {}

  static async login(baseURL: string, user = USER, pass = PASS): Promise<{ status: number; token: string; body: any }> {
    const ctx = await pwRequest.newContext({ baseURL, ignoreHTTPSErrors: true });
    const resp = await ctx.post(AUTH_ENDPOINT, { data: { user, pass } });
    let body: any = null;
    try { body = await resp.json(); } catch { /* non-JSON error body */ }
    await ctx.dispose();
    return { status: resp.status(), token: body?.token ?? '', body };
  }

  static async as(baseURL: string, user = USER, pass = PASS): Promise<Api> {
    const r = await Api.login(baseURL, user, pass);
    if (r.status !== 200 || !r.token) throw new Error(`login ${user} failed: HTTP ${r.status}`);
    const ctx = await pwRequest.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Authorization: `Bearer ${r.token}` },
    });
    return new Api(ctx, r.token);
  }

  url(s: { name: string; area: number }): string {
    return `${PREFIX}/${s.area}/${s.name}`;
  }

  post(s: ServiceRef | { name: string; area: number }, data: unknown): Promise<APIResponse> {
    return this.ctx.post(this.url(s), { data });
  }

  put(s: ServiceRef | { name: string; area: number }, data: unknown): Promise<APIResponse> {
    return this.ctx.put(this.url(s), { data });
  }

  /** GET always carries an L8Query in ?body= (bare GETs are rejected by the platform). */
  getRaw(s: { name: string; area: number }, query: string): Promise<APIResponse> {
    return this.ctx.get(this.url(s), { params: { body: JSON.stringify({ text: query }) } });
  }

  async query(s: ServiceRef, where = '', extra = ''): Promise<any[]> {
    const q = `select * from ${s.type}${where ? ' where ' + where : ''}${extra ? ' ' + extra : ''}`;
    const resp = await this.getRaw(s, q);
    if (!resp.ok()) throw new Error(`GET ${s.name} "${q}" -> HTTP ${resp.status()}: ${await resp.text()}`);
    const body = await resp.json().catch(() => ({}));
    return body?.list ?? [];
  }

  async findOne(s: ServiceRef, where: string): Promise<any | undefined> {
    return (await this.query(s, where))[0];
  }

  delete(s: ServiceRef, id: string): Promise<APIResponse> {
    return this.ctx.delete(this.url(s), {
      data: { text: `select * from ${s.type} where ${s.idField}=${id}` },
    });
  }

  /** Best-effort delete; cleanup must never mask a test result. */
  async tryDelete(s: ServiceRef, id: string | undefined): Promise<void> {
    if (!id) return;
    try { await this.delete(s, id); } catch { /* ignore */ }
  }

  dispose(): Promise<void> { return this.ctx.dispose(); }
}
