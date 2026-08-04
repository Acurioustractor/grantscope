export type RelationalReviewTrigger =
  | 'official_evidence_changed'
  | 'deadline_due'
  | 'evidence_gap'
  | 'revisit_due';

export interface RelationalReviewMatter {
  title: string;
  date: string;
  evidenceGaps: string[];
  verification: {
    state: string;
    verifiedAt?: string | null;
  };
  decisionMemory?: {
    createdAt: string;
  } | null;
  discoveryState?: 'new' | 'changed' | null;
  evidenceChangedAt?: string | null;
  revisitAt?: string | null;
}

export interface RelationalReviewItem<T extends RelationalReviewMatter> {
  record: T;
  trigger: RelationalReviewTrigger;
}

const DAY_MS = 86_400_000;
const QUEUE_LIMIT = 5;

const TRIGGER_ORDER: Record<RelationalReviewTrigger, number> = {
  official_evidence_changed: 0,
  deadline_due: 1,
  evidence_gap: 2,
  revisit_due: 3,
};

function parseDate(value: string | null | undefined): number | null {
  if (!value || value === 'No date') return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    ).getTime();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function daysUntil(value: string | null | undefined, now: Date): number | null {
  const timestamp = parseDate(value);
  if (timestamp === null) return null;
  return Math.ceil((timestamp - startOfDay(now)) / DAY_MS);
}

export function firstNamedEvidenceGap(record: RelationalReviewMatter): string | null {
  return record.evidenceGaps.find((gap) => gap.trim().length > 0)?.trim() ?? null;
}

function officialEvidenceChangedSinceReview(record: RelationalReviewMatter): boolean {
  if (record.discoveryState !== 'changed' || record.verification.state !== 'verified') return false;
  if (!record.decisionMemory) return true;

  const changedAt = parseDate(record.evidenceChangedAt ?? record.verification.verifiedAt);
  const reviewedAt = parseDate(record.decisionMemory.createdAt);
  return changedAt !== null && reviewedAt !== null && changedAt > reviewedAt;
}

function triggerFor(record: RelationalReviewMatter, now: Date): RelationalReviewTrigger | null {
  if (officialEvidenceChangedSinceReview(record)) return 'official_evidence_changed';

  const revisitDays = daysUntil(record.revisitAt, now);
  if (revisitDays !== null && revisitDays <= 0) return 'revisit_due';

  // A human read settles the current evidence. Bring the matter back only
  // when evidence changes or the reviewer deliberately names a revisit date.
  if (record.decisionMemory) return null;

  const deadlineDays = daysUntil(record.date, now);
  if (deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 30) return 'deadline_due';
  if (firstNamedEvidenceGap(record)) return 'evidence_gap';
  return null;
}

function queueDate<T extends RelationalReviewMatter>(item: RelationalReviewItem<T>): number {
  const value = item.trigger === 'revisit_due' ? item.record.revisitAt : item.record.date;
  return parseDate(value) ?? Number.POSITIVE_INFINITY;
}

function evidenceChangeDate(record: RelationalReviewMatter): number {
  return parseDate(record.evidenceChangedAt ?? record.verification.verifiedAt)
    ?? Number.POSITIVE_INFINITY;
}

/**
 * Select matters, never people, using explicit attention conditions.
 * Scores, confidence, relationship temperature and institutional value are ignored.
 */
export function selectRelationalReviewMatters<T extends RelationalReviewMatter>(
  records: T[],
  now = new Date(),
): Array<RelationalReviewItem<T>> {
  return records
    .map((record): RelationalReviewItem<T> | null => {
      const trigger = triggerFor(record, now);
      return trigger ? { record, trigger } : null;
    })
    .filter((item): item is RelationalReviewItem<T> => Boolean(item))
    .sort((left, right) =>
      TRIGGER_ORDER[left.trigger] - TRIGGER_ORDER[right.trigger]
      || queueDate(left) - queueDate(right)
      || evidenceChangeDate(left.record) - evidenceChangeDate(right.record)
      || left.record.title.localeCompare(right.record.title),
    )
    .slice(0, QUEUE_LIMIT);
}
