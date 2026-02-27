/**
 * Grant Normalizer
 *
 * Converts RawGrant (from any source plugin) into CanonicalGrant format.
 * Handles date parsing, amount normalization, category mapping, and dedup key generation.
 */

import type { RawGrant, CanonicalGrant, GrantSource } from './types.js';

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', may2: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

const CATEGORY_ALIASES: Record<string, string> = {
  'first nations': 'indigenous',
  'aboriginal': 'indigenous',
  'torres strait': 'indigenous',
  'atsi': 'indigenous',
  'social enterprise': 'enterprise',
  'startup': 'enterprise',
  'business': 'enterprise',
  'environment': 'regenerative',
  'sustainability': 'regenerative',
  'agriculture': 'regenerative',
  'land management': 'regenerative',
  'culture': 'arts',
  'creative': 'arts',
  'music': 'arts',
  'film': 'arts',
  'storytelling': 'stories',
  'narrative': 'stories',
  'digital': 'technology',
  'tech': 'technology',
  'innovation': 'technology',
  'wellbeing': 'health',
  'mental health': 'health',
  'disability': 'health',
  'youth': 'justice',
  'justice': 'justice',
  'diversion': 'justice',
  'school': 'education',
  'training': 'education',
  'capacity building': 'education',
};

const VALID_CATEGORIES = new Set([
  'justice', 'indigenous', 'stories', 'enterprise', 'regenerative',
  'health', 'arts', 'community', 'technology', 'education',
]);

/**
 * Parse various date formats into ISO date string (YYYY-MM-DD).
 */
export function normalizeDate(input: string | undefined | null): string | null {
  if (!input) return null;
  const text = input.trim();

  // Already ISO: 2026-06-30
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  // ISO with time: 2026-06-30T00:00:00Z
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.split('T')[0];

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = text.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  // DD Mon YYYY or DD Month YYYY
  const textDateMatch = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (textDateMatch) {
    const month = MONTH_MAP[textDateMatch[2].toLowerCase().slice(0, 3)];
    if (month) {
      return `${textDateMatch[3]}-${month}-${textDateMatch[1].padStart(2, '0')}`;
    }
  }

  // Month DD, YYYY (US format)
  const usDateMatch = text.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (usDateMatch) {
    const month = MONTH_MAP[usDateMatch[1].toLowerCase().slice(0, 3)];
    if (month) {
      return `${usDateMatch[3]}-${month}-${usDateMatch[2].padStart(2, '0')}`;
    }
  }

  // Try native Date parsing as last resort
  const d = new Date(text);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Normalize amount from string or number.
 */
export function normalizeAmount(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return input > 0 ? input : null;
  if (typeof input === 'string') {
    const cleaned = input.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) || num <= 0 ? null : num;
  }
  return null;
}

/**
 * Map free-text categories to controlled vocabulary.
 */
export function normalizeCategories(categories: string[]): string[] {
  const result = new Set<string>();

  for (const cat of categories) {
    const lower = cat.toLowerCase().trim();

    // Direct match
    if (VALID_CATEGORIES.has(lower)) {
      result.add(lower);
      continue;
    }

    // Alias match
    for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES)) {
      if (lower.includes(alias)) {
        result.add(canonical);
      }
    }
  }

  return [...result];
}

/**
 * Generate a dedup key from provider and title.
 * Strips common noise words and normalizes whitespace.
 */
export function generateDedupKey(provider: string, title: string): string {
  const normalizeStr = (s: string) =>
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  return `${normalizeStr(provider)}:${normalizeStr(title)}`;
}

/**
 * Convert a RawGrant into a CanonicalGrant.
 */
export function normalize(raw: RawGrant): CanonicalGrant {
  const source: GrantSource = {
    pluginId: raw.sourceId,
    foundAt: new Date().toISOString(),
    rawUrl: raw.sourceUrl,
    confidence: raw.sourceId === 'web-search' ? 'verified'
      : raw.sourceId === 'llm-knowledge' ? 'llm_knowledge'
      : 'scraped',
  };

  return {
    name: raw.title.trim(),
    provider: raw.provider.trim(),
    program: raw.program?.trim() || null,
    amountMin: normalizeAmount(raw.amount?.min),
    amountMax: normalizeAmount(raw.amount?.max),
    currency: 'AUD',
    closesAt: normalizeDate(raw.deadline),
    url: raw.sourceUrl?.trim() || null,
    description: raw.description?.trim() || null,
    categories: normalizeCategories(raw.categories || []),
    geography: raw.geography || ['AU'],
    sources: [source],
    discoveryMethod: raw.sourceId,
    dedupKey: generateDedupKey(raw.provider, raw.title),
  };
}
