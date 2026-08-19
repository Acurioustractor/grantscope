import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Raw Tailwind colour classes, which are the drift.
 *
 * DESIGN.md defines seven `bauhaus-*` tokens; the shell and workspace themes define their own.
 * Nothing enforced them, so raw-palette classes accumulated across hundreds of files — every one
 * a colour nobody chose, invisible to a token change, and unreachable by any theme.
 *
 * Deliberately NOT matched: `*-white`, `*-black`, `*-transparent`, `*-current`, `*-inherit`.
 * Those carry no palette opinion.
 */
export const RAW_PALETTE = new RegExp(
  String.raw`\b(?:text|bg|border|ring|from|to|via|divide|decoration|outline|shadow|accent|caret|fill|stroke)-` +
    String.raw`(?:gray|slate|zinc|neutral|stone|amber|teal|purple|emerald|indigo|violet|sky|rose|lime|cyan|fuchsia|orange|pink|green|red|blue|yellow)-` +
    String.raw`\d{2,3}\b`,
  'g',
);

export function scan(srcDir, roots = ['app', 'components']) {
  const counts = {};
  for (const root of roots) walk(join(srcDir, root), srcDir, counts);
  return counts;
}

function walk(dir, srcDir, counts) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, srcDir, counts);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry)) continue;
    if (entry === 'palette-baseline.json' || entry.endsWith('palette-ratchet.test.ts')) continue;
    const hits = readFileSync(full, 'utf8').match(RAW_PALETTE);
    if (hits?.length) counts[relative(srcDir, full)] = hits.length;
  }
}

// `node scripts/palette-scan.mjs --write` re-baselines after a genuine cleanup.
if (process.argv[1]?.endsWith('palette-scan.mjs')) {
  const srcDir = new URL('../src/', import.meta.url).pathname;
  const counts = scan(srcDir);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (process.argv.includes('--write')) {
    const sorted = Object.fromEntries(Object.keys(counts).sort().map((k) => [k, counts[k]]));
    writeFileSync(join(srcDir, 'lib/palette-baseline.json'), JSON.stringify(sorted, null, 2) + '\n');
    console.log(`wrote baseline: ${Object.keys(counts).length} files, ${total} hits`);
  } else {
    console.log(`${Object.keys(counts).length} files, ${total} raw-palette classes`);
  }
}
