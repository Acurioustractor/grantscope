import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Plain .mjs helper, shared with `node scripts/palette-scan.mjs --write` so the test and the
// re-baseline command can never disagree about what counts as a raw palette class.
import { scan } from '../../scripts/palette-scan.mjs';

/**
 * A RATCHET, not a ban.
 *
 * On 2026-08-20 there were 6,386 raw Tailwind colour classes across 226 files. A test that
 * simply forbade them would fail on every run and be deleted within the week, so this one only
 * fails when a file gets WORSE, or when a new file arrives with any at all.
 *
 * Why it matters, concretely: the four hero tiles on /reports/youth-justice/[state] are
 * `bg-red-50`, `bg-blue-50`, `bg-amber-50` and `bg-emerald-50`. None is a token, none responds to
 * a theme, and none was chosen by anyone — they are Tailwind's defaults, reached for because they
 * were nearer to hand than `bauhaus-red`. That is how 6,386 of them arrived without a decision.
 *
 * The number is allowed to fall. When it does, re-baseline:
 *
 *     cd apps/web && node scripts/palette-scan.mjs --write
 *
 * Deliberately NOT a lint rule: this has to run in the same gate as everything else
 * (`scripts/precheck.sh`), and a vitest file is the only thing here guaranteed to.
 */
const SRC = join(process.cwd(), 'src');
const BASELINE = JSON.parse(
  readFileSync(join(SRC, 'lib/palette-baseline.json'), 'utf8'),
) as Record<string, number>;

describe('raw Tailwind colours do not increase', () => {
  const current = scan(SRC) as Record<string, number>;

  it('no file gains raw-palette classes', () => {
    const worse = Object.entries(current)
      .filter(([file, n]) => file in BASELINE && n > BASELINE[file])
      .map(([file, n]) => `${file}: ${BASELINE[file]} → ${n}`);
    expect(
      worse,
      'These files gained raw Tailwind colour classes. Use the design tokens instead —\n' +
        'bauhaus-* on public pages, --shell-* inside the shell, --ws-* inside /org.\n' +
        'DESIGN.md has the palette.\n\n' +
        worse.join('\n'),
    ).toEqual([]);
  });

  it('new files use tokens, not raw palette classes', () => {
    const fresh = Object.keys(current)
      .filter((file) => !(file in BASELINE))
      .map((file) => `${file}: ${current[file]}`);
    expect(
      fresh,
      'These files are new since the baseline and already use raw Tailwind colours.\n' +
        'New surfaces get tokens — the backlog is grandfathered, not extended.\n\n' +
        fresh.join('\n'),
    ).toEqual([]);
  });

  it('reports the debt so it stays visible rather than becoming background', () => {
    const total = Object.values(current).reduce((a, b) => a + b, 0);
    const baselineTotal = Object.values(BASELINE).reduce((a, b) => a + b, 0);
    // Not an assertion about the number — only that it never silently grows. The two tests above
    // do the enforcing; this one exists so the figure is printed on every run.
    expect(total).toBeLessThanOrEqual(baselineTotal);
  });
});
