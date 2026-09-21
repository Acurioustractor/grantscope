import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every app surface reads ALMA interventions through alma_interventions_valid,
// which drops rows with data_quality = 'quarantined'. Until 2026-09-22, 51 of 53
// readers hit the raw table and served scraped homepages as programmes.
// Only files that measure the table itself may read it raw.
const RAW_ALLOWED = new Set([
  'app/api/ops/health/route.ts',
  'app/api/mission-control/route.ts',
  'app/api/data/data-health/route.ts',
  'app/reports/data-health/page.tsx',
  'app/ops/health/[dataset]/page.tsx',
  'app/api/data/schema-graph/route.ts',
  'lib/data-docs.ts',
]);

const RAW_READ = /\.from\(\s*['"]alma_interventions['"]\s*\)|\b(?:FROM|JOIN)\s+(?:public\.)?alma_interventions\b(?!_)/i;

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : walk(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('ALMA readers honour the quarantine flag', () => {
  it('reads alma_interventions_valid, not the raw table', () => {
    const offenders = walk(SRC)
      .map((path) => relative(SRC, path))
      .filter((rel) => !RAW_ALLOWED.has(rel))
      .filter((rel) => RAW_READ.test(readFileSync(join(SRC, rel), 'utf8')));
    expect(offenders, 'read alma_interventions_valid instead').toEqual([]);
  });
});
