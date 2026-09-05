import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

/**
 * THE PHRASING GUARD.
 *
 * A claim leaves this project as a sentence, not as a number. The registry records, per question,
 * the sentence the UI is allowed to render (claim_phrasing) and the sentences it may never render
 * (forbidden_phrasing). This test is what stops those from being decoration.
 *
 * It is deliberately STATIC — it reads the seed migration and the UI source, and touches no
 * database. CI has no DATABASE_PASSWORD, so a guard that needed a connection would be a guard
 * that silently never ran.
 *
 * The distinction that makes this worth having: "662 organisations have no evidence record
 * linked in ALMA" is a fact about this database. "662 organisations have no evidence" is a claim
 * about those organisations. The second is a slur we cannot support, and it is one careless
 * caption away at all times.
 */

const REPO = path.resolve(__dirname, '../../..');
// Moved to history on 2026-09-05 when the baseline dump became the schema floor; the seed is applied, the file is
// the record of the phrasing. If the questions are re-seeded, point this at the new migration.
const SEED = path.join(REPO, 'supabase/migrations_history/pre-baseline-supabase/20260815000400_clarity_question_seed.sql');
const CLARITY_UI = path.resolve(__dirname, '../src/app/clarity');

/** Read SQL single-quoted strings, honouring '' as an escaped quote. */
function readSqlString(src: string, openIdx: number): { value: string; end: number } {
  let out = '';
  let i = openIdx + 1;
  while (i < src.length) {
    if (src[i] === "'") {
      if (src[i + 1] === "'") { out += "'"; i += 2; continue; }
      return { value: out, end: i };
    }
    out += src[i];
    i += 1;
  }
  throw new Error('unterminated SQL string in the seed migration');
}

interface SeededQuestion {
  slug: string;
  claim: string;
  forbidden: string[];
}

/**
 * Parse the seeded questions out of the migration.
 *
 * Column order in the INSERT is (…, caveat, exclusions, claim_phrasing, forbidden_phrasing, …),
 * so claim_phrasing is the last plain string before the ARRAY[…] literal. If someone reorders
 * those columns, the assertions below fail loudly rather than passing on the wrong field.
 */
function parseSeed(): SeededQuestion[] {
  const sql = readFileSync(SEED, 'utf8');
  const questions: SeededQuestion[] = [];

  const blocks = sql.split(/INSERT INTO clarity_question\s*\(/g).slice(1);
  for (const block of blocks) {
    // Single left-to-right scan. The ARRAY[ we want is the one at TOP LEVEL — evidence-gap's
    // exclusions string legitimately contains the text "ARRAY['youth-justice']", so a plain
    // indexOf finds a match inside a quoted literal and severs the parse mid-string.
    const strings: string[] = [];
    let arrayIdx = -1;
    for (let i = 0; i < block.length; i += 1) {
      if (block[i] === "'") {
        const { value, end } = readSqlString(block, i);
        strings.push(value);
        i = end;
        continue;
      }
      if (arrayIdx === -1 && block.startsWith('ARRAY[', i)) {
        arrayIdx = i;
        break;
      }
    }
    if (arrayIdx === -1) continue;

    // strings collected so far are the plain values; the last is claim_phrasing
    const closeIdx = block.indexOf(']', arrayIdx);
    const arrayBody = block.slice(arrayIdx + 'ARRAY['.length, closeIdx);
    const forbidden: string[] = [];
    for (let i = 0; i < arrayBody.length; i += 1) {
      if (arrayBody[i] === "'") {
        const { value, end } = readSqlString(arrayBody, i);
        forbidden.push(value);
        i = end;
      }
    }

    // slug is the first string in the VALUES list
    const slug = strings[0] ?? '(unknown)';
    const claim = strings[strings.length - 1] ?? '';
    questions.push({ slug, claim, forbidden });
  }
  return questions;
}

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const questions = parseSeed();

describe('clarity phrasing guard', () => {
  it('parses every seeded question', () => {
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.slug, 'a question has no slug').toBeTruthy();
      expect(q.claim.length, `${q.slug}: claim_phrasing is empty or mis-parsed`).toBeGreaterThan(20);
      expect(q.forbidden.length, `${q.slug}: no forbidden phrasing registered`).toBeGreaterThan(0);
    }
  });

  it('no approved claim contains a phrase that question forbids', () => {
    for (const q of questions) {
      const claim = q.claim.toLowerCase();
      for (const bad of q.forbidden) {
        expect(
          claim.includes(bad.toLowerCase()),
          `${q.slug}: claim_phrasing contains its own forbidden phrase "${bad}"`,
        ).toBe(false);
      }
    }
  });

  it('the clarity UI hard-codes no forbidden phrase', () => {
    // Forbidden phrasing must reach the screen only as DATA (the "NOT: …" list rendered from the
    // registry). A literal in a caption or heading is the exact failure this guard exists for.
    const files = walkFiles(CLARITY_UI);
    expect(files.length).toBeGreaterThan(0);

    const allForbidden = [...new Set(questions.flatMap((q) => q.forbidden))];
    for (const file of files) {
      const src = readFileSync(file, 'utf8').toLowerCase();
      for (const bad of allForbidden) {
        expect(
          src.includes(bad.toLowerCase()),
          `${path.relative(REPO, file)} hard-codes the forbidden phrase "${bad}"`,
        ).toBe(false);
      }
    }
  });

  it('every question forbids the bare-number reading of its own claim', () => {
    // A guard on a guard: a question whose forbidden list is generic boilerplate protects
    // nothing. Each list must name something specific to that question, not just say "wrong".
    for (const q of questions) {
      const specific = q.forbidden.some((f) => f.split(/\s+/).length >= 3);
      expect(specific, `${q.slug}: forbidden_phrasing has no specific multi-word phrase`).toBe(true);
    }
  });
});
