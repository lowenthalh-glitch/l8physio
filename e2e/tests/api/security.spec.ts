import { test, expect } from '../../fixtures/auth';
import { Api } from '../../fixtures/api';
import { SERVICES } from '../../fixtures/services';
import { token } from '../../fixtures/env';
import { provisionUser, deleteUser, DEFAULT_PASSWORD } from '../../fixtures/users';

test.describe('role scoping (client role)', () => {
  test('a provisioned client logs in, lands on the client portal and sees only their own rows', async ({ api, seed, baseURL }) => {
    const mine = await seed.client(token('Mine'));
    const other = await seed.client(token('Other'));
    await provisionUser(api, { userId: mine.id, email: mine.entity.email, fullName: 'E2E Mine', role: 'client' });
    try {
      const login = await Api.login(baseURL!, mine.entity.email, DEFAULT_PASSWORD);
      expect(login.status).toBe(200);
      expect(login.body.portal).toBe('client-app.html');

      const clientApi = await Api.as(baseURL!, mine.entity.email, DEFAULT_PASSWORD);
      const visible = (await clientApi.query(SERVICES.clients)).map(c => c.clientId);
      expect(visible).toContain(mine.id);
      expect(visible).not.toContain(other.id);
      await clientApi.dispose();
    } finally {
      await deleteUser(api, mine.id);
    }
  });

  test('a client cannot read another client\'s plans', async ({ api, seed, baseURL }) => {
    const mine = await seed.client(token('PlanMine'));
    const other = await seed.client(token('PlanOther'));
    await seed.plan(mine.id, token('PlnA'));
    const theirs = await seed.plan(other.id, token('PlnB'));
    await provisionUser(api, { userId: mine.id, email: mine.entity.email, fullName: 'E2E', role: 'client' });
    try {
      const clientApi = await Api.as(baseURL!, mine.entity.email, DEFAULT_PASSWORD);
      const ids = (await clientApi.query(SERVICES.plans)).map(p => p.planId);
      expect(ids).not.toContain(theirs.id);
      await clientApi.dispose();
    } finally {
      await deleteUser(api, mine.id);
    }
  });
});

test.describe('role scoping (therapist role)', () => {
  test('a provisioned therapist logs in to the therapist portal', async ({ api, seed, baseURL }) => {
    const th = await seed.therapist(token('Thr'));
    await provisionUser(api, { userId: th.id, email: th.entity.email, fullName: 'E2E Thr', role: 'therapist' });
    try {
      const login = await Api.login(baseURL!, th.entity.email, DEFAULT_PASSWORD);
      expect(login.status).toBe(200);
      expect(login.body.portal).toBe('therapist-app.html');
    } finally {
      await deleteUser(api, th.id);
    }
  });
});

test.describe('disabled accounts', () => {
  test('a user with a non-active account cannot authenticate', async ({ api, baseURL }) => {
    const id = token('Dis');
    const resp = await api.post({ name: 'users', area: 73 }, {
      userId: id, fullName: 'E2E Disabled', email: `${id}@example.com`,
      accountStatus: 'ACCOUNT_STATUS_DISABLED', password: { hash: DEFAULT_PASSWORD }, roles: { client: true },
    });
    test.skip(!resp.ok(), 'security API refused to create the disabled user: ' + resp.status());
    try {
      const login = await Api.login(baseURL!, id, DEFAULT_PASSWORD);
      expect(login.status).toBeGreaterThanOrEqual(400);
    } finally {
      await deleteUser(api, id);
    }
  });
});
