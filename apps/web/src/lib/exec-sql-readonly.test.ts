import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The exec_sql read-only guard, exercised directly.
 *
 * It is not exported (it is an internal of the runtime client proxy), so this test re-evaluates
 * the same predicate from source. That is deliberate: the alternative is exporting a security
 * check purely to test it, and a copy that drifts would be caught by the first case below, which
 * is taken verbatim from the query that exposed the bug.
 *
 * WHY IT CHANGED. The stacked-statement rule was `/;\s*\S/` against the whole query, so a
 * semicolon inside a STRING LITERAL read as a statement separator:
 *
 *     STRING_AGG(DISTINCT location, '; ' ORDER BY location)
 *
 * /reports/youth-justice/qld/crime-prevention-schools uses exactly that, so its target-regions
 * panel failed on every build and rendered empty. Literals are now removed before the check.
 *
 * The cases below exist so that loosening cannot go further by accident: everything the guard
 * blocked before, it must still block.
 */
const SRC = readFileSync(join(process.cwd(), 'src/lib/supabase.ts'), 'utf8');
const BODY = SRC.slice(SRC.indexOf('function isReadOnlyExecSql'));
const isReadOnly = new Function(
  'query',
  BODY.slice(BODY.indexOf('{') + 1, BODY.indexOf('\n}')) .replace(/^\s*function[^\n]*\n/, ''),
) as (q: string | undefined) => boolean;

describe('exec_sql read-only guard', () => {
  it('allows a semicolon inside a string literal — the case that broke a live page', () => {
    expect(isReadOnly(
      `WITH x AS (SELECT STRING_AGG(DISTINCT location, '; ' ORDER BY location) AS l FROM t) SELECT * FROM x`,
    )).toBe(true);
  });

  it('allows ordinary reads', () => {
    expect(isReadOnly('SELECT 1')).toBe(true);
    expect(isReadOnly('  \n WITH a AS (SELECT 1) SELECT * FROM a')).toBe(true);
    expect(isReadOnly('SELECT * FROM t; ')).toBe(true); // single trailing semicolon
  });

  it('STILL BLOCKS a genuinely stacked statement', () => {
    expect(isReadOnly('SELECT 1; DROP TABLE users')).toBe(false);
    expect(isReadOnly("SELECT 'a'; DELETE FROM users")).toBe(false);
  });

  it('STILL BLOCKS writes, including inside a CTE', () => {
    for (const q of [
      'DELETE FROM users',
      'UPDATE users SET x = 1',
      'INSERT INTO users VALUES (1)',
      'WITH d AS (DELETE FROM users RETURNING *) SELECT * FROM d',
      'WITH u AS (UPDATE users SET x = 1 RETURNING *) SELECT * FROM u',
    ]) {
      expect(isReadOnly(q), q).toBe(false);
    }
  });

  it('STILL BLOCKS non-select entry points and empties', () => {
    expect(isReadOnly('DROP TABLE users')).toBe(false);
    expect(isReadOnly('')).toBe(false);
    expect(isReadOnly(undefined)).toBe(false);
    expect(isReadOnly('-- just a comment')).toBe(false);
  });
});
