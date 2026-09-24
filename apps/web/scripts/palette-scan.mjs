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

/**
 * Soft drop shadows. DESIGN.md: "Hard offset only, no soft drop shadows" on public pages; the
 * signed-in shell may soften. Hard offsets are written as `shadow-[8px_8px_0_0_...]` and are not
 * matched; neither is `shadow-none`.
 */
export const SOFT_SHADOW = /\bshadow-(?:sm|md|lg|xl|2xl|inner)\b/g;

/**
 * Signed-in surfaces, where the shell and workspace themes apply. Everything else under app/ and
 * components/ is treated as PUBLIC, the conservative reading: a page a visitor can open.
 */
const SIGNED_IN = [
  'app/dashboard/', 'app/clarity/', 'app/ops/', 'app/admin/', 'app/org/', 'app/home/', 'app/tracker/',
  'app/alerts/', 'app/account/', 'app/settings/', 'app/profile/', 'app/briefing/', 'app/mission-control/',
  'app/foundations/tracker/', 'app/foundations/backlog/', 'app/ui/', 'components/shell/', 'components/ui/',
];
export function isPublic(file) {
  return !SIGNED_IN.some((prefix) => file.startsWith(prefix));
}

export function scan(srcDir, roots = ['app', 'components'], pattern = RAW_PALETTE) {
  const counts = {};
  for (const root of roots) walk(join(srcDir, root), srcDir, counts, pattern);
  return counts;
}

/** Soft shadows per PUBLIC file. */
export function scanShadows(srcDir) {
  const all = scan(srcDir, ['app', 'components'], SOFT_SHADOW);
  return Object.fromEntries(Object.entries(all).filter(([file]) => isPublic(file)));
}

function walk(dir, srcDir, counts, pattern) {
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
      walk(full, srcDir, counts, pattern);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(entry)) continue;
    if (entry === 'palette-baseline.json' || entry.endsWith('palette-ratchet.test.ts')) continue;
    const hits = readFileSync(full, 'utf8').match(pattern);
    if (hits?.length) counts[relative(srcDir, full)] = hits.length;
  }
}

const sum = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);
const sortKeys = (counts) => Object.fromEntries(Object.keys(counts).sort().map((k) => [k, counts[k]]));

// `node scripts/palette-scan.mjs --write` re-baselines both ratchets after a genuine cleanup.
if (process.argv[1]?.endsWith('palette-scan.mjs')) {
  const srcDir = new URL('../src/', import.meta.url).pathname;
  const counts = scan(srcDir);
  const shadows = scanShadows(srcDir);
  const pub = Object.fromEntries(Object.entries(counts).filter(([f]) => isPublic(f)));
  const total = sum(counts);
  if (process.argv.includes('--write')) {
    writeFileSync(join(srcDir, 'lib/palette-baseline.json'), JSON.stringify(sortKeys(counts), null, 2) + '\n');
    writeFileSync(join(srcDir, 'lib/shadow-baseline.json'), JSON.stringify(sortKeys(shadows), null, 2) + '\n');
    console.log(`wrote baselines: ${total} raw-palette classes in ${Object.keys(counts).length} files; ` +
      `${sum(shadows)} soft shadows on public files`);
  } else {
    console.log(`${total} raw-palette classes (${sum(pub)} public, ${total - sum(pub)} signed-in); ` +
      `${sum(shadows)} soft shadows on public files`);
  }
}
