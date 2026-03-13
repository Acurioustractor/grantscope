export interface GrantListItem {
  id: string;
  name: string;
  provider: string | null;
  program: string | null;
  program_type: string | null;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  url: string | null;
  description: string | null;
  categories: string[];
  source: string | null;
  status: string;
  sources: unknown;
  similarity?: number;
  created_at?: string | null;
  updated_at?: string | null;
  last_verified_at?: string | null;
}

const collator = new Intl.Collator('en-AU', { sensitivity: 'base' });

function normalizeGrantKeyPart(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasClosingDate(grant: GrantListItem): boolean {
  return !!grant.closes_at;
}

function hasAmount(grant: GrantListItem): boolean {
  return grant.amount_min != null || grant.amount_max != null;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareBooleanPriority(a: boolean, b: boolean): number {
  return Number(b) - Number(a);
}

function compareNumberDesc(a: number, b: number): number {
  return b - a;
}

function compareStringAsc(a: string, b: string): number {
  return collator.compare(a, b);
}

function compareCanonicalGrant(a: GrantListItem, b: GrantListItem): number {
  const closingPriority = compareBooleanPriority(hasClosingDate(a), hasClosingDate(b));
  if (closingPriority !== 0) return closingPriority;

  const amountPriority = compareBooleanPriority(hasAmount(a), hasAmount(b));
  if (amountPriority !== 0) return amountPriority;

  const verifiedPriority = compareBooleanPriority(!!a.last_verified_at, !!b.last_verified_at);
  if (verifiedPriority !== 0) return verifiedPriority;

  const updatedPriority = compareNumberDesc(toTimestamp(a.updated_at), toTimestamp(b.updated_at));
  if (updatedPriority !== 0) return updatedPriority;

  const createdPriority = compareNumberDesc(toTimestamp(a.created_at), toTimestamp(b.created_at));
  if (createdPriority !== 0) return createdPriority;

  return compareStringAsc(a.id, b.id);
}

function compareOptionalDate(
  a: string | null | undefined,
  b: string | null | undefined,
  ascending: boolean,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const aTime = toTimestamp(a);
  const bTime = toTimestamp(b);
  return ascending ? aTime - bTime : bTime - aTime;
}

function compareAmount(grant: GrantListItem): number {
  return grant.amount_max ?? grant.amount_min ?? -1;
}

export function dedupeGrantList(grants: GrantListItem[]): GrantListItem[] {
  const grouped = new Map<string, GrantListItem>();

  for (const grant of grants) {
    const key = `${normalizeGrantKeyPart(grant.provider)}::${normalizeGrantKeyPart(grant.name)}`;
    const existing = grouped.get(key);
    if (!existing || compareCanonicalGrant(grant, existing) < 0) {
      grouped.set(key, grant);
    }
  }

  return Array.from(grouped.values());
}

export function sortGrantList(
  grants: GrantListItem[],
  sortOrder: string,
  options?: { semantic?: boolean },
): GrantListItem[] {
  const sorted = [...grants];
  const semantic = options?.semantic ?? false;

  if (semantic && sortOrder === 'newest') {
    return sorted.sort((a, b) => {
      const similarityCompare = compareNumberDesc(a.similarity ?? 0, b.similarity ?? 0);
      if (similarityCompare !== 0) return similarityCompare;
      return compareCanonicalGrant(a, b);
    });
  }

  return sorted.sort((a, b) => {
    if (sortOrder === 'closing_asc') {
      const result = compareOptionalDate(a.closes_at, b.closes_at, true);
      return result !== 0 ? result : compareCanonicalGrant(a, b);
    }

    if (sortOrder === 'closing_desc') {
      const result = compareOptionalDate(a.closes_at, b.closes_at, false);
      return result !== 0 ? result : compareCanonicalGrant(a, b);
    }

    if (sortOrder === 'amount_desc') {
      const result = compareNumberDesc(compareAmount(a), compareAmount(b));
      return result !== 0 ? result : compareCanonicalGrant(a, b);
    }

    if (sortOrder === 'amount_asc') {
      const aAmount = compareAmount(a);
      const bAmount = compareAmount(b);
      if (aAmount < 0 && bAmount < 0) return compareCanonicalGrant(a, b);
      if (aAmount < 0) return 1;
      if (bAmount < 0) return -1;
      const result = aAmount - bAmount;
      return result !== 0 ? result : compareCanonicalGrant(a, b);
    }

    if (sortOrder === 'name_asc') {
      const result = compareStringAsc(a.name, b.name);
      return result !== 0 ? result : compareCanonicalGrant(a, b);
    }

    const result = compareNumberDesc(
      toTimestamp(a.created_at ?? a.updated_at),
      toTimestamp(b.created_at ?? b.updated_at),
    );
    return result !== 0 ? result : compareCanonicalGrant(a, b);
  });
}
