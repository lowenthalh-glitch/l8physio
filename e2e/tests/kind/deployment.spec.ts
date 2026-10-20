import { test, expect } from '../../fixtures/auth';
import { APPS, kubectl, kubectlJson, podsFor, isReady } from '../../fixtures/kube';
import { NAMESPACE, token } from '../../fixtures/env';
import { SERVICES } from '../../fixtures/services';

test.describe('KIND cluster deployment', () => {
  test('namespace exists with the project label', async () => {
    const ns = kubectlJson('get', 'namespace', NAMESPACE);
    expect(ns.metadata.labels.name).toBe(NAMESPACE);
  });

  for (const app of APPS) {
    test(`${app} has a Ready pod and no crash loop`, async () => {
      const pods = podsFor(app);
      expect(pods.length, `no pods for app=${app}`).toBeGreaterThan(0);
      for (const p of pods) {
        expect(p.status.phase).toBe('Running');
        expect(isReady(p), `${p.metadata.name} not Ready`).toBeTruthy();
        const restarts = (p.status.containerStatuses ?? []).reduce((n: number, c: any) => n + c.restartCount, 0);
        expect(restarts, `${p.metadata.name} restarted ${restarts}x`).toBeLessThanOrEqual(2);
      }
    });
  }

  test('every pod uses the project-owned physio images (no erp-* base leak)', async () => {
    const pods = kubectlJson('-n', NAMESPACE, 'get', 'pods').items;
    for (const p of pods) for (const c of p.spec.containers) {
      expect(c.image, p.metadata.name).toMatch(/^saichler\/physio[-a-z]*:latest$/);
    }
  });

  test('every workload mounts the hdata volume at /data', async () => {
    const sts = kubectlJson('-n', NAMESPACE, 'get', 'statefulset').items;
    expect(sts.length).toBeGreaterThanOrEqual(APPS.length);
    for (const s of sts) {
      const c = s.spec.template.spec.containers[0];
      expect(c.volumeMounts.map((v: any) => `${v.name}:${v.mountPath}`)).toContain('hdata:/data');
      expect(c.env.map((e: any) => e.name)).toContain('NODE_IP');
    }
  });

  test('persistent volume claims are bound (standard storage class)', async () => {
    const pvcs = kubectlJson('-n', NAMESPACE, 'get', 'pvc').items;
    expect(pvcs.length).toBeGreaterThan(0);
    for (const p of pvcs) {
      expect(p.status.phase, p.metadata.name).toBe('Bound');
      expect(p.spec.storageClassName).toBe('standard');
    }
  });

  test('physio-web service is a NodePort on 30080', async () => {
    const svc = kubectlJson('-n', NAMESPACE, 'get', 'service', 'physio-web');
    expect(svc.spec.type).toBe('NodePort');
    expect(svc.spec.ports[0].nodePort).toBe(30080);
  });

  test('vnet and log-vnet run on the host network', async () => {
    for (const app of ['physio-vnet', 'physio-log-vnet']) {
      for (const p of podsFor(app)) expect(p.spec.hostNetwork, app).toBe(true);
    }
  });

  test('the web server answers over the mapped host port', async ({ request }) => {
    const resp = await request.get('/login.json');
    expect(resp.status()).toBe(200);
  });

  test('no pod logs contain a panic', async () => {
    for (const app of APPS) {
      for (const p of podsFor(app)) {
        const logs = kubectl('-n', NAMESPACE, 'logs', p.metadata.name, '--tail=500');
        expect(logs, `${p.metadata.name} logged a panic`).not.toMatch(/\bpanic:|fatal error:/);
      }
    }
  });
});

test.describe('resilience & persistence', () => {
  test('data survives a restart of the physio service pod', async ({ api, seed }) => {
    test.setTimeout(240_000);
    const t = token('Persist');
    await seed.therapist(t);
    kubectl('-n', NAMESPACE, 'delete', 'pod', 'physio-0');
    kubectl('-n', NAMESPACE, 'wait', '--for=condition=Ready', 'pod/physio-0', '--timeout=180s');
    await expect.poll(async () => {
      try { return (await api.query(SERVICES.therapists, `lastName=${t}`)).length; } catch { return -1; }
    }, { timeout: 120_000, intervals: [2000] }).toBe(1);
  });

  test('web server recovers after its pod is replaced', async ({ request }) => {
    test.setTimeout(240_000);
    kubectl('-n', NAMESPACE, 'delete', 'pod', 'physio-web-0');
    kubectl('-n', NAMESPACE, 'wait', '--for=condition=Ready', 'pod/physio-web-0', '--timeout=180s');
    await expect.poll(async () => (await request.get('/login.json').catch(() => null))?.status() ?? 0, { timeout: 120_000, intervals: [2000] }).toBe(200);
  });
});
