// SQL validation utilities for the /api/ask endpoint.
// Extracted for testability. These guard against LLM-generated SQL doing anything destructive.

const BLOCKED_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'EXECUTE'];

/**
 * Clean raw LLM output into a SQL string.
 * Strips <think> blocks, markdown fences, trailing semicolons.
 */
export function cleanSqlOutput(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
    .replace(/^```sql\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
    .replace(/;\s*$/, '')
    .trim();
}

/**
 * Validate that a SQL string is safe to execute.
 * Returns { valid: true, sql } with LIMIT appended if missing,
 * or { valid: false, error } describing the violation.
 */
export function validateSql(sql: string): { valid: true; sql: string } | { valid: false; error: string } {
  if (!sql.trim()) {
    return { valid: false, error: 'Empty SQL query' };
  }

  // Must start with SELECT or WITH
  const sqlUpper = sql.toUpperCase().replace(/\s+/g, ' ').trim();
  if (!sqlUpper.startsWith('SELECT') && !sqlUpper.startsWith('WITH')) {
    return { valid: false, error: 'Only SELECT queries are allowed' };
  }

  // Block dangerous keywords (ignoring content inside string literals)
  const sqlWithoutStrings = sql.replace(/'[^']*'/g, '');
  for (const kw of BLOCKED_KEYWORDS) {
    const pattern = new RegExp(`\\b${kw}\\b`, 'i');
    if (pattern.test(sqlWithoutStrings)) {
      return { valid: false, error: `Blocked keyword: ${kw}` };
    }
  }

  // Auto-append LIMIT if missing
  const hasLimit = /\bLIMIT\b/i.test(sql);
  const finalSql = hasLimit ? sql : `${sql} LIMIT 100`;

  return { valid: true, sql: finalSql };
}
