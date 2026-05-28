/** Atlas formatting helpers — shared by Funding Deserts + Revolving Door surfaces. */

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function moneyFull(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString();
}

export function decile(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

/** Bauhaus desert-score colour scale — louder red = worse-served. */
export function desertColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return '#E8E8E8';
  if (score >= 160) return '#D02020';
  if (score >= 120) return '#E85020';
  if (score >= 80) return '#F08020';
  if (score >= 40) return '#F0C020';
  return '#A0C020';
}
