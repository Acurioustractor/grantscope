import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Which app files read which relation, found by scanning apps/web/src for
 * `.from('x')`, `.rpc`-free SQL `FROM x` / `JOIN x`. Source files are not on the server at
 * runtime, so the result is committed as table-readers.generated.json and
 * table-readers.test.ts fails when it is stale. Regenerate:
 *
 *   cd apps/web && UPDATE_TABLE_READERS=1 npx vitest run src/lib/table-readers.test.ts
 *
 * A heuristic, stated as one: it finds literal names. A table name built at runtime, or read
 * only by scripts/ or another repo, does not appear here (schema_ownership.consumers covers
 * other repos).
 */

const FROM_CALL = /\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)/g;
const SQL_REF = /\b(?:FROM|JOIN)\s+(?:public\.)?([a-z_][a-z0-9_]*)\b/g;
// SQL keywords and functions that follow FROM/JOIN and are not relations.
const NOT_TABLES = new Set([
  'select', 'lateral', 'unnest', 'jsonb_array_elements', 'jsonb_each', 'json_each', 'generate_series',
  'the', 'a', 'an', 'and', 'or', 'to', 'this', 'that', 'each', 'every', 'which', 'where', 'with',
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : walk(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

export function collectTableReaders(srcDir: string): Record<string, string[]> {
  const readers: Record<string, Set<string>> = {};
  for (const path of walk(srcDir)) {
    const text = readFileSync(path, 'utf8');
    const rel = relative(srcDir, path);
    const found = new Set<string>();
    for (const m of text.matchAll(FROM_CALL)) found.add(m[1]);
    for (const m of text.matchAll(SQL_REF)) if (!NOT_TABLES.has(m[1])) found.add(m[1]);
    for (const t of found) (readers[t] ??= new Set()).add(rel);
  }
  return Object.fromEntries(
    Object.keys(readers).sort().map((t) => [t, [...readers[t]].sort()]),
  );
}
