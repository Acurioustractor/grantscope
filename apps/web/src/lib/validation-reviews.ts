import { parse } from 'csv-parse/sync';

export type ValidationReviewRow = {
  review_date: string;
  reviewer: string | null;
  row_key: string;
  record_type: 'grant' | 'foundation';
  surface: string | null;
  source: string | null;
  record_id: string | null;
  record_name: string | null;
  status: 'correct' | 'usable_but_incomplete' | 'wrong_noisy';
  issue_type: string | null;
  url_works: boolean | null;
  open_now_correct: boolean | null;
  deadline_correct: boolean | null;
  amount_correct: boolean | null;
  provider_correct: boolean | null;
  match_relevance_score: number | null;
  relationship_signal_score: number | null;
  actionability_score: number | null;
  notes: string | null;
  recommended_fix: string | null;
  owner: string | null;
  updated_at: string;
};

function cleanText(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanBoolean(value: unknown): boolean | null {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) return null;
  if (['yes', 'y', 'true', '1'].includes(normalized)) return true;
  if (['no', 'n', 'false', '0'].includes(normalized)) return false;
  return null;
}

function cleanNumber(value: unknown): number | null {
  const normalized = cleanText(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanDate(value: unknown): string | null {
  const normalized = cleanText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeRecordType(value: unknown): 'grant' | 'foundation' | null {
  const normalized = cleanText(value)?.toLowerCase();
  if (normalized === 'grant' || normalized === 'foundation') return normalized;
  return null;
}

function normalizeStatus(value: unknown): ValidationReviewRow['status'] | null {
  const normalized = cleanText(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized === 'correct') return 'correct';
  if (normalized === 'usable_but_incomplete' || normalized === 'usable but incomplete') return 'usable_but_incomplete';
  if (normalized === 'wrong_noisy' || normalized === 'wrong/noisy' || normalized === 'wrong noisy') return 'wrong_noisy';
  return null;
}

function buildRowKey(row: Omit<ValidationReviewRow, 'row_key' | 'updated_at'>) {
  const parts = [
    row.review_date || 'undated',
    row.reviewer || 'unknown-reviewer',
    row.record_type || 'unknown-record',
    row.surface || 'unknown-surface',
    row.source || 'unknown-source',
    row.record_id || row.record_name || row.notes || Math.random().toString(36).slice(2, 10),
  ];
  return parts
    .join('::')
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 240);
}

export function parseValidationReviewCsv(csvText: string) {
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as Array<Record<string, unknown>>;

  const validRows: ValidationReviewRow[] = rows
    .map((row) => {
      const review_date = cleanDate(row.review_date);
      const record_type = normalizeRecordType(row.record_type);
      const status = normalizeStatus(row.status);

      if (!review_date || !record_type || !status) return null;

      const normalizedRow = {
        review_date,
        reviewer: cleanText(row.reviewer),
        record_type,
        surface: cleanText(row.surface),
        source: cleanText(row.source),
        record_id: cleanText(row.record_id),
        record_name: cleanText(row.record_name),
        status,
        issue_type: cleanText(row.issue_type),
        url_works: cleanBoolean(row.url_works),
        open_now_correct: cleanBoolean(row.open_now_correct),
        deadline_correct: cleanBoolean(row.deadline_correct),
        amount_correct: cleanBoolean(row.amount_correct),
        provider_correct: cleanBoolean(row.provider_correct),
        match_relevance_score: cleanNumber(row.match_relevance_score),
        relationship_signal_score: cleanNumber(row.relationship_signal_score),
        actionability_score: cleanNumber(row.actionability_score),
        notes: cleanText(row.notes),
        recommended_fix: cleanText(row.recommended_fix),
        owner: cleanText(row.owner),
      } satisfies Omit<ValidationReviewRow, 'row_key' | 'updated_at'>;

      return {
        ...normalizedRow,
        updated_at: new Date().toISOString(),
        row_key: buildRowKey(normalizedRow),
      } satisfies ValidationReviewRow;
    })
    .filter((row): row is ValidationReviewRow => row !== null);

  return {
    rowsParsed: rows.length,
    validRows,
  };
}
