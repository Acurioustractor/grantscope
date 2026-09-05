import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * grant_opportunities carries three unique indexes (url, (source, name), (name, source_id)) and ON CONFLICT resolves
 * only the one it names. Every agent that picked its own key eventually hit one of the others: "VIC Grants Gateway"
 * failed 51 of 57 nightly runs, and two agents worked around it by re-inserting the row with `url: null`, which threw
 * the URL away and stored the round twice. All writers now go through scripts/lib/upsert-grant-opportunities.mjs.
 *
 * This test fails when a new writer picks its own conflict key again.
 */
const REPO = join(import.meta.dirname, '../../../..');
const SCRIPTS = join(REPO, 'scripts');
const CONTRACT = 'upsert-grant-opportunities.mjs';

function scriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : scriptFiles(full);
    return entry.isFile() && entry.name.endsWith('.mjs') ? [full] : [];
  });
}

describe('grant_opportunities has one write contract', () => {
  it('no script names its own conflict key on grant_opportunities', () => {
    const offenders: string[] = [];
    for (const file of scriptFiles(SCRIPTS)) {
      if (file.endsWith(CONTRACT)) continue;
      const src = readFileSync(file, 'utf8');
      if (!src.includes("from('grant_opportunities')")) continue;
      // an upsert on this table within a few lines of naming it
      const windows = src.split("from('grant_opportunities')").slice(1);
      for (const w of windows) {
        const head = w.slice(0, 400);
        if (/onConflict/.test(head)) offenders.push(file.replace(`${REPO}/`, ''));
      }
    }
    expect(
      [...new Set(offenders)],
      'these write grant_opportunities with their own conflict key; use upsertGrantOpportunities() from scripts/lib/upsert-grant-opportunities.mjs, which resolves by url and by (source, name) and writes by primary key',
    ).toEqual([]);
  });

  it('no script forces a row in by discarding its url', () => {
    const offenders: string[] = [];
    for (const file of scriptFiles(SCRIPTS)) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes("from('grant_opportunities')")) continue;
      if (/\.\.\.\s*\w+\s*,\s*url:\s*null/.test(src)) offenders.push(file.replace(`${REPO}/`, ''));
    }
    expect(
      offenders,
      'writing a grant round with url: null to dodge the unique index stores the same round twice and loses its address',
    ).toEqual([]);
  });
});
