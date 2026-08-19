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
