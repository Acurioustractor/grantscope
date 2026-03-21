/** SQL safety utilities for CivicGraph */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseResult<T = any> = PromiseLike<{ data: T; error: any }>;

/**
 * Safe wrapper for Supabase RPC calls — catches errors and returns null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safe<T = any>(p: SupabaseResult<T>): Promise<T | null> {
  try {
    const result = await p;
    if (result.error) return null;
    return result.data;
  } catch {
    return null;
  }
}

/**
 * Sanitize a string for safe use in SQL single-quoted literals.
 * Escapes single quotes and backslashes to prevent SQL injection.
 */
export function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/**
 * Validate and sanitize a UUID string.
 * Returns the UUID if valid, null otherwise.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUuid(value: string): string | null {
  return UUID_RE.test(value) ? value : null;
}

/**
 * Validate a gs_id format (e.g. AU-ABN-12345678901, GS-ORG-xxx, GS-PERSON-xxx).
 */
const GSID_RE = /^[A-Z0-9][A-Z0-9-]{2,80}$/;

export function validateGsId(value: string): string | null {
  return GSID_RE.test(value) ? value : null;
}

/**
 * Validate an ABN (11 digits).
 */
const ABN_RE = /^\d{11}$/;

export function validateAbn(value: string): string | null {
  const clean = value.replace(/\s/g, '');
  return ABN_RE.test(clean) ? clean : null;
}

/**
 * Whitelist a value against allowed options.
 */
export function whitelist<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  if (!value) return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
