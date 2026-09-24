/** Shared formatting utilities for CivicGraph */

/**
 * THE money format for the site: $1.2B, $3.4M, $56K, $789. The census of 2026-09-23 found 51
 * local money() functions disagreeing ($1.1B on reports, $4.1bn on /grants; an empty value shown
 * as "—", "$0" or nothing). New code imports this one. A missing value renders "—"; zero is "$0".
 */
export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (n < 0) return `−${money(-n)}`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export function fmt(n: number): string {
  return n.toLocaleString();
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s;
}

export function slugify(name: string): string {
  return encodeURIComponent(name.replace(/\s+/g, '-'));
}
