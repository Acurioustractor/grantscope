#!/usr/bin/env node
/**
 * One-off copy sweep: replaces em dashes and AI-vocab tells across a file.
 * Uses comma where em dash is a parenthetical separator, full stop where it's
 * a sentence break. AI-vocab words get less-flagged synonyms.
 *
 * Usage: node scripts/sweep-ai-tells.mjs <file> [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!file) { console.error('Usage: node scripts/sweep-ai-tells.mjs <file> [--dry-run]'); process.exit(1); }

let txt = readFileSync(file, 'utf8');
const before = txt;

// 1. Em dashes — replace with appropriate punctuation.
// Spaced em dash in prose: " — " or " &mdash; " → ", " (most natural)
txt = txt.replace(/ &mdash; /g, ', ');
txt = txt.replace(/ — /g, ', ');
txt = txt.replace(/ &mdash;/g, ',');
txt = txt.replace(/ —/g, ',');
txt = txt.replace(/&mdash; /g, ' ');
txt = txt.replace(/— /g, ' ');
// Lonely entity: replace with comma
txt = txt.replace(/&mdash;/g, ',');
txt = txt.replace(/—/g, ',');

// Collapse any double spaces or comma-space-comma artifacts
txt = txt.replace(/  +/g, ' ');
txt = txt.replace(/, ,/g, ',');
txt = txt.replace(/,,+/g, ',');

// 2. The most-flagged AI-vocab tells. Conservative replacements that keep meaning.
const vocab = [
  // [pattern, replacement]
  [/\bunderscores?\b/g, 'shows'],
  [/\bhighlight(s|ing)?\b/g, (m, suffix) => 'show' + (suffix === 's' ? 's' : suffix === 'ing' ? 'ing' : '')],
  [/\bshowcas(es?|ing)\b/g, (m, suffix) => 'show' + (suffix === 'es' ? 's' : suffix === 'ing' ? 'ing' : '')],
  [/\bemphasi[sz]ing\b/g, 'noting'],
  [/\bemphasi[sz]es\b/g, 'notes'],
  [/\bin the heart of\b/gi, 'in'],
  [/\bdiverse array\b/gi, 'range'],
  [/\bdiverse range\b/gi, 'range'],
  [/\bvibrant\b/gi, 'active'],
  [/\brobust\b/gi, 'strong'],
  [/\btapestry\b/gi, 'set'],
  [/\bmeticulous(ly)?\b/gi, (m, ly) => ly ? 'carefully' : 'careful'],
  [/\bpivotal\b/gi, 'key'],
  [/\bdelve\b/gi, 'look'],
  [/\bdelving\b/gi, 'looking'],
  [/\bdelves\b/gi, 'looks'],
  [/\bintricate(ly)?\b/gi, (m, ly) => ly ? 'closely' : 'detailed'],
  [/\bintricacies\b/gi, 'details'],
  [/\binterplay\b/gi, 'overlap'],
  [/\bgarners?\b/gi, (m) => m.endsWith('s') ? 'gets' : 'get'],
  [/\bgarner(ed|ing)\b/gi, (m, suffix) => suffix === 'ed' ? 'got' : 'getting'],
  [/\bbolstered?\b/gi, 'backed'],
  [/\benduring\b/gi, 'lasting'],
  [/\bcrucial\b/gi, 'critical'],
  [/\benhances?\b/gi, (m) => m.endsWith('s') ? 'improves' : 'improve'],
  [/\benhanced\b/gi, 'improved'],
  [/\benhancing\b/gi, 'improving'],
  [/\bfostering\b/gi, 'building'],
  [/\bfoster(s|ed)?\b/gi, (m, suffix) => 'build' + (suffix === 's' ? 's' : suffix === 'ed' ? 'd' : '')],
  [/\bvaluable insights?\b/gi, 'insights'],
  [/\bvaluable\b/gi, 'useful'],
  [/\bcommitment to\b/gi, 'work on'],
  [/\bnestled\b/gi, 'sited'],
  [/\bgroundbreaking\b/gi, 'new'],
  [/\brenowned\b/gi, 'known'],
  [/\bboasts?\b/gi, (m) => m.endsWith('s') ? 'has' : 'have'],
  [/\bExemplifies\b/g, 'Shows'],
  [/\bexemplifies\b/g, 'shows'],
  [/\bexemplify(ing)?\b/g, (m, ing) => ing ? 'showing' : 'show'],
  [/\bIt's important to note that\b/g, ''],
  [/\bit's important to note that\b/g, ''],
  [/\bIt's worth noting that\b/g, ''],
  [/\bit's worth noting that\b/g, ''],
];

for (const [pat, rep] of vocab) {
  if (typeof rep === 'function') txt = txt.replace(pat, rep);
  else txt = txt.replace(pat, rep);
}

// Collapse leading-comma artifacts at sentence start. Don't match closing TS
// generics like `Promise<X>,` — only match `>` followed by `,` IF the `>` looks
// like an HTML/JSX tag close (preceded by alphanumeric content like a tag name
// or word) rather than a TS generic close (preceded by `]` or `>` from nested
// generics, which would indicate a Promise tuple boundary). Safest: don't run.
// (kept inline as a no-op; manual review handles the rare leading-comma case)

// Trim trailing-comma-period (e.g., "X, ." → "X.").
// Negative lookahead `(?!\.)` so we don't eat the comma in `}, ...spread` or
// before `...ellipsis` patterns.
txt = txt.replace(/,\s*\.(?!\.)/g, '.');
// NB: don't do `, )` → `)` — that's a Promise.all comma boundary in TSX.

const changed = before !== txt;
if (!changed) { console.log('No changes.'); process.exit(0); }

// Quick stat report
const emDashesBefore = (before.match(/&mdash;|—/g) ?? []).length;
const emDashesAfter = (txt.match(/&mdash;|—/g) ?? []).length;
console.log(`em dashes: ${emDashesBefore} → ${emDashesAfter}`);
console.log(`bytes: ${before.length} → ${txt.length}`);

if (dryRun) { console.log('Dry-run, not writing.'); process.exit(0); }
writeFileSync(file, txt, 'utf8');
console.log('Written.');
