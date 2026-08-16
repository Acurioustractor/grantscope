import { getDirectServiceSupabase } from '@/lib/supabase';

/**
 * Dropdown vocabularies, read from the database rather than typed into code.
 *
 * The rule (dashboard-shell-buildout.md): never hardcode a year list that rots. Both
 * vocabularies come from `v_vocab_financial_years` / `v_vocab_topics`
 * (migrations/2026-08-16-vocab-views.sql), which carry the same two DB-side grant filters as
 * every money surface — so a year or topic appears here exactly when the money panels have
 * rows for it.
 *
 * Until that migration is applied, both loaders return [] and callers hide the control —
 * a missing dropdown, not an invented list.
 */

export interface VocabEntry {
  /** The raw database value — hyphenated topic tag, or financial_year string like '2023-24'. */
  value: string;
  /** Grant rows behind the value, so a caller can show how much a choice narrows to. */
  rows: number;
}

export async function financialYearVocab(): Promise<VocabEntry[]> {
  return loadVocab('v_vocab_financial_years', 'financial_year');
}

export async function topicVocab(): Promise<VocabEntry[]> {
  return loadVocab('v_vocab_topics', 'topic');
}

async function loadVocab(view: string, column: string): Promise<VocabEntry[]> {
  try {
    const supabase = getDirectServiceSupabase();
    const { data, error } = await supabase.from(view).select(`${column},grant_rows`);
    if (error) return [];
    return ((data ?? []) as unknown as Record<string, string | number>[])
      .map((r) => ({ value: String(r[column]), rows: Number(r.grant_rows ?? 0) }))
      .filter((e) => e.value !== '');
  } catch {
    return [];
  }
}

/** 'youth-justice' → 'Youth justice'. Display only — queries always use the raw tag. */
export function topicLabel(tag: string): string {
  const words = tag.split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
