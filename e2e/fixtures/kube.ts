import { execFileSync } from 'node:child_process';
import { CLUSTER, NAMESPACE } from './env';

export const CONTEXT = `kind-${CLUSTER}`;

export function kubectl(...args: string[]): string {
  return execFileSync('kubectl', ['--context', CONTEXT, ...args], { encoding: 'utf8', timeout: 120_000 });
}

export function kubectlJson(...args: string[]): any {
  return JSON.parse(kubectl(...args, '-o', 'json'));
}

export const APPS = ['physio-vnet', 'physio', 'physio-web', 'physio-log-vnet', 'physio-log-agent', 'physio-boostapp'] as const;

export function podsFor(app: string): any[] {
  return kubectlJson('-n', NAMESPACE, 'get', 'pods', '-l', `app=${app}`).items;
}

export function isReady(pod: any): boolean {
  return (pod.status?.conditions ?? []).some((c: any) => c.type === 'Ready' && c.status === 'True');
}
