import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Config must describe a system that exists.
 *
 * On 2026-04-24 the commit "scope cut to portfolio mode — kill SaaS-shaped surfaces" deleted the
 * whole `tender-intelligence` API directory. Its two cron entries stayed in vercel.json. Vercel
 * went on calling them — one hourly, one daily — for **four months**, collecting 404s, and nothing
 * anywhere said so.
 *
 * Deleting code does not propagate to the periphery. This test is the propagation: it fails the
 * build the moment vercel.json names a route the repo does not have.
 */

const repoRoot = join(__dirname, '..', '..', '..', '..');
const appDir = join(repoRoot, 'apps/web/src/app');
const vercelJson = JSON.parse(readFileSync(join(repoRoot, 'vercel.json'), 'utf8'));

function routeExists(cronPath: string): boolean {
  // "/api/x/y?mode=z" -> apps/web/src/app/api/x/y/route.ts
  const clean = cronPath.split('?')[0].replace(/^\//, '');
  const dir = join(appDir, clean);
  return existsSync(join(dir, 'route.ts')) || existsSync(join(dir, 'route.tsx'));
}

describe('vercel.json cron entries', () => {
  const crons: { path: string; schedule: string }[] = vercelJson.crons ?? [];

  it('has crons to check', () => {
    expect(crons.length).toBeGreaterThan(0);
  });

  it('every cron path resolves to a route file that exists', () => {
    const missing = crons.filter((c) => !routeExists(c.path)).map((c) => `${c.schedule}  ${c.path}`);
    // Named in the failure so the fix is obvious: either restore the route or drop the cron.
    expect(missing, `cron paths with no route:\n${missing.join('\n')}`).toEqual([]);
  });

  it('names an ignoreCommand, so commits that cannot change the app do not build it', () => {
    // The other half of the same lesson: 20 deployments in one session, most of them pointless.
    expect(vercelJson.ignoreCommand).toBeTruthy();
    expect(existsSync(join(repoRoot, 'scripts/vercel-ignore-build.sh'))).toBe(true);
  });
});
