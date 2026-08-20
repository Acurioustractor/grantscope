import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Nothing selects a column `mv_revolving_door` does not have.
 *
 * On 2026-08-20 four surfaces did, and every one of them failed silently:
 *
 *   /reports/influence-network   rendered a fabricated zero about political influence
 *   /reports/political-money     published "0 entities that donate ALSO hold contracts"
 *                                when the answer is 865
 *   /api/power/accountability    returned nothing
 *   /api/data/political-money    returned nothing — and that is the Giving Data Commons API
 *
 * All four selected `procurement_dollars`, `donation_dollars`, `in_procurement` and friends,
 * which live on `mv_entity_power_index`. The two views are complementary: the power index holds
 * the measurements for 185,393 entities, `mv_revolving_door` holds the 3,586-entity subject and
 * `revolving_door_score`. Code that wants both must JOIN, and code that guesses gets nulls with
 * no error — PostgREST returns an error object the caller then swallows, and SQL against a
 * missing column fails inside `exec_sql` where the page turns it into an empty array.
 *
 * That silence is why this is a test rather than a comment.
 */
const COLUMNS = new Set([
  // Refresh with:
  //   node --env-file=.env scripts/gsql.mjs "SELECT attname FROM pg_attribute
  //     WHERE attrelid='mv_revolving_door'::regclass AND attnum>0 AND NOT attisdropped"
  'abn', 'canonical_name', 'contract_count', 'contracts', 'distinct_buyers', 'donates',
  'donation_count', 'entity_type', 'funding_count', 'gs_id', 'id', 'influence_vectors',
  'is_community_controlled', 'lga_name', 'lobbies', 'parties_funded', 'receives_funding',
  'revolving_door_score', 'state', 'total_contracts', 'total_donated', 'total_funded',
]);

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

describe('mv_revolving_door is only asked for columns it has', () => {
  it('no phantom columns in any query', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const raw = readFileSync(file, 'utf8');
      if (!raw.includes('mv_revolving_door')) continue;
      // Scan CODE, not prose. The fix for /reports/influence-network carries a comment naming the
      // columns that did not exist — "was joining on rd.in_procurement" — and an earlier version
      // of this test failed on it. A guard that trips on the documentation of the bug it prevents
      // is a guard someone deletes. `//` is only treated as a comment when not part of `://`.
      const src = raw
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      const bad = new Set<string>();

      // SQL: an alias bound to the view, then alias.column
      for (const m of src.matchAll(/mv_revolving_door\s+(?:AS\s+)?([a-z][a-z0-9_]*)/gi)) {
        for (const c of src.matchAll(new RegExp(`\\b${m[1]}\\.([a-z_][a-z0-9_]*)`, 'g'))) {
          if (!COLUMNS.has(c[1])) bad.add(`${m[1]}.${c[1]}`);
        }
      }
      for (const m of src.matchAll(/mv_revolving_door\.([a-z_][a-z0-9_]*)/g)) {
        if (!COLUMNS.has(m[1])) bad.add(`mv_revolving_door.${m[1]}`);
      }
      // PostgREST: .from('mv_revolving_door') … .select('a, b, c')
      for (const m of src.matchAll(
        /\.from\(['"]mv_revolving_door['"]\)[\s\S]{0,400}?\.select\(\s*['"`]([^'"`]+)['"`]/g,
      )) {
        for (const raw of m[1].split(',')) {
          const col = raw.trim().split(':').pop()!.trim();
          if (col && col !== '*' && !COLUMNS.has(col)) bad.add(`select:${col}`);
        }
      }
      if (bad.size) offenders.push(`${relative(SRC, file)} → ${[...bad].join(', ')}`);
    }

    expect(
      offenders,
      'These ask mv_revolving_door for columns it does not have. They are almost certainly on\n' +
        'mv_entity_power_index — JOIN it rather than switching views, or revolving_door_score is lost:\n\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
