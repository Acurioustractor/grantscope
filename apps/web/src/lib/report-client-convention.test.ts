import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Replaces the stack-trace sniffing that used to live in lib/supabase.ts.
 *
 * That code called `new Error().stack` and, if the string contained '/app/reports/', swapped in the
 * empty snapshot client. It was trying to enforce a convention — report pages read from the
 * snapshot — and it enforced it invisibly, inconsistently, and only at runtime. On 2026-08-19 two
 * public reports published zeros because of it, and nothing at the call site said why.
 *
 * A convention that matters should fail the build, not the page. So: anything under app/reports
 * must ask for its client explicitly, via `@/lib/report-supabase` (snapshot-aware) or
 * `getDirectServiceSupabase` (live). Importing the general-purpose `getServiceSupabase` from
 * `@/lib/supabase` inside a report is the mistake the sniffing existed to paper over.
 */
const REPORTS_DIR = join(process.cwd(), 'src/app/reports');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('report pages declare which Supabase client they want', () => {
  it('no file under app/reports imports getServiceSupabase from @/lib/supabase', () => {
    const offenders = walk(REPORTS_DIR).filter((file) => {
      const src = readFileSync(file, 'utf8');
      // Only the general-purpose module is off-limits; report-supabase re-exports the same name.
      const importsGeneralModule = /from\s+'@\/lib\/supabase'/.test(src);
      return importsGeneralModule && /\bgetServiceSupabase\b/.test(src);
    });

    expect(
      offenders.map((f) => f.replace(process.cwd() + '/', '')),
      'Import from @/lib/report-supabase (snapshot-aware) or use getDirectServiceSupabase (live). ' +
        'A report must say which data it is reading; it used to be guessed from a stack trace.',
    ).toEqual([]);
  });
});

/**
 * Nobody re-derives the live-reports flag by hand.
 *
 * Production stores `CIVICGRAPH_LIVE_REPORTS` as `"true\n"`. A strict `=== 'true'` is therefore
 * false in production, and three report pages carried their own private copy of exactly that
 * comparison — so they read the empty client even once the shared helper was fixed. The failure is
 * silent by construction: an unread flag renders as a page with no numbers, not as an error.
 */
describe('the live-reports flag is read in exactly one place', () => {
  it('no file compares CIVICGRAPH_LIVE_REPORTS directly', () => {
    const roots = [join(process.cwd(), 'src/app'), join(process.cwd(), 'src/lib')];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        // The helper itself, its test, and this file (which names the pattern it forbids).
        if (/report-supabase(\.test)?\.ts$/.test(file) || file === __filename) continue;
        const src = readFileSync(file, 'utf8');
        // The env READ, not a mention of the name in prose.
        if (src.includes('process.env.CIVICGRAPH_LIVE_REPORTS')) {
          offenders.push(file.replace(process.cwd() + '/', ''));
        }
      }
    }
    expect(
      offenders,
      `These read CIVICGRAPH_LIVE_REPORTS directly. Import liveReportsEnabled() from ` +
        `@/lib/report-supabase instead — it trims, and production's value has a trailing newline:\n` +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
