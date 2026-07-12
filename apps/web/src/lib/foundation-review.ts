export type FoundationReviewInputs = {
  acncAbn?: string | null;
  website?: string | null;
  description?: string | null;
  totalGivingAnnual?: number | null;
  profileConfidence?: string | null;
  enrichedAt?: string | null;
  lastScrapedAt?: string | null;
  thematicFocus?: string[] | null;
  geographicFocus?: string[] | null;
  programCount?: number | null;
  openProgramCount?: number | null;
  applicationPathwayCount?: number | null;
  boardRoles?: number | null;
  verifiedGrants?: number | null;
  yearMemoryCount?: number | null;
  verifiedSourceBackedCount?: number | null;
  scrapedUrlCount?: number | null;
  latestProgramScrapedAt?: string | null;
};

export type FoundationReviewAssessment = {
  score: number;
  band: 'identity' | 'profile' | 'developing' | 'source_backed' | 'stable';
  label: string;
  className: string;
  signals: string[];
  missing: string[];
  nextBestActions: string[];
  freshestAt: string | null;
  stale: boolean;
};

function countList(values?: string[] | null) {
  return Array.isArray(values) ? values.filter(Boolean).length : 0;
}

function toNumber(value?: number | null) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function latestIso(values: Array<string | null | undefined>) {
  const timestamps = values
    .map((value) => {
      if (!value) return null;
      const time = new Date(value).getTime();
      return Number.isFinite(time) ? { value, time } : null;
    })
    .filter((entry): entry is { value: string; time: number } => Boolean(entry))
    .sort((a, b) => b.time - a.time);

  return timestamps[0]?.value ?? null;
}

function daysSince(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
}

export function assessFoundationReview(inputs: FoundationReviewInputs): FoundationReviewAssessment {
  const programCount = toNumber(inputs.programCount);
  const openProgramCount = toNumber(inputs.openProgramCount);
  const applicationPathwayCount = toNumber(inputs.applicationPathwayCount);
  const boardRoles = toNumber(inputs.boardRoles);
  const verifiedGrants = toNumber(inputs.verifiedGrants);
  const yearMemoryCount = toNumber(inputs.yearMemoryCount);
  const verifiedSourceBackedCount = toNumber(inputs.verifiedSourceBackedCount);
  const scrapedUrlCount = toNumber(inputs.scrapedUrlCount);
  const freshestAt = latestIso([inputs.latestProgramScrapedAt, inputs.lastScrapedAt, inputs.enrichedAt]);
  const freshnessDays = daysSince(freshestAt);

  let score = 0;
  if (inputs.acncAbn) score += 5;
  if (inputs.website) score += 5;
  if (toNumber(inputs.totalGivingAnnual) > 0) score += 5;

  if (inputs.enrichedAt) score += 8;
  if (inputs.description) score += 5;
  if (countList(inputs.thematicFocus) > 0) score += 4;
  if (countList(inputs.geographicFocus) > 0) score += 3;

  if (programCount > 0) score += 8;
  if (openProgramCount > 0) score += 3;
  if (applicationPathwayCount > 0) score += 4;

  if (boardRoles > 0) score += 10;
  if (verifiedGrants > 0) score += 10;
  if (yearMemoryCount > 0) score += 8;
  if (verifiedSourceBackedCount > 0) score += 8;
  if (scrapedUrlCount > 0) score += 4;

  if (freshnessDays != null) {
    if (freshnessDays <= 180) score += 10;
    else if (freshnessDays <= 365) score += 6;
    else score += 2;
  }

  score = Math.max(0, Math.min(100, score));

  const band =
    score >= 86 ? 'stable'
      : score >= 71 ? 'source_backed'
        : score >= 51 ? 'developing'
          : score >= 26 ? 'profile'
            : 'identity';

  const label = {
    stable: 'Stable review',
    source_backed: 'Source-backed',
    developing: 'Developing',
    profile: 'Profile only',
    identity: 'Identity only',
  }[band];

  const className = {
    stable: 'border-money bg-money-light text-money',
    source_backed: 'border-bauhaus-blue bg-link-light text-bauhaus-blue',
    developing: 'border-bauhaus-yellow bg-warning-light text-bauhaus-black',
    profile: 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black',
    identity: 'border-bauhaus-red/25 bg-bauhaus-red/5 text-bauhaus-red',
  }[band];

  const signals = [
    inputs.website ? 'Website' : null,
    inputs.enrichedAt ? 'Profile enriched' : null,
    toNumber(inputs.totalGivingAnnual) > 0 ? 'Giving estimate' : null,
    programCount > 0 ? `${programCount} program${programCount === 1 ? '' : 's'}` : null,
    openProgramCount > 0 ? `${openProgramCount} open` : null,
    applicationPathwayCount > 0 ? 'Application pathway' : null,
    boardRoles > 0 ? 'Governance' : null,
    verifiedGrants > 0 ? 'Verified grants' : null,
    yearMemoryCount > 0 ? 'Year memory' : null,
    verifiedSourceBackedCount > 0 ? 'Source-backed memory' : null,
  ].filter((value): value is string => Boolean(value));

  const stale = freshnessDays == null || freshnessDays > 365;
  const missing = [
    !inputs.website ? 'Website' : null,
    programCount <= 0 ? 'Current programs' : null,
    applicationPathwayCount <= 0 ? 'Application pathway' : null,
    boardRoles <= 0 ? 'Governance' : null,
    verifiedGrants <= 0 ? 'Verified grants' : null,
    yearMemoryCount <= 0 ? 'Year memory' : null,
    verifiedSourceBackedCount <= 0 ? 'Source-backed memory' : null,
    stale ? 'Fresh source check' : null,
  ].filter((value): value is string => Boolean(value));

  const nextBestActions = [
    missing.includes('Current programs') ? 'Find public grants, apply, programs, funding, annual report, and impact report pages.' : null,
    missing.includes('Application pathway') ? 'Extract application mode, contact route, eligibility, and decision cycle from program pages.' : null,
    missing.includes('Verified grants') ? 'Extract recent grantees, amounts, years, and source URLs from annual reports or grants databases.' : null,
    missing.includes('Governance') ? 'Link current trustees, directors, and board roles from ACNC or annual reports.' : null,
    missing.includes('Source-backed memory') ? 'Attach official source URLs to program-year memory rows.' : null,
    missing.includes('Fresh source check') ? 'Refresh the website/source frontier before relying on this profile.' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    score,
    band,
    label,
    className,
    signals,
    missing,
    nextBestActions,
    freshestAt,
    stale,
  };
}
