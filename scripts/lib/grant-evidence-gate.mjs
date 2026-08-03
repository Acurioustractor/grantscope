const GENERIC_NAMES = new Set([
  'community grants',
  'grant program',
  'grants',
  'funding',
  'funding opportunities',
]);

const AGGREGATOR_HOSTS = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'grantguru.com.au',
  'thegrantshub.com.au',
];

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normaliseGrantName(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\b(round|program|grant|grants|funding|the|and|for|of)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPlausibleOfficialSource(sourceUrl, officialDomains = []) {
  try {
    const url = new URL(sourceUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol !== 'https:') return false;
    if (AGGREGATOR_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
      return false;
    }
    return officialDomains.some((domain) => {
      const expected = String(domain).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      return host === expected || host.endsWith(`.${expected}`);
    });
  } catch {
    return false;
  }
}

function hasEvidence(evidence, field) {
  const item = evidence?.[field];
  return Boolean(item?.url && item?.quote && String(item.quote).trim().length >= 8);
}

export function assessGrantEvidence(candidate, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const failed = [];
  const evidence = candidate.evidence ?? {};
  const deadline = validDate(candidate.deadline);
  const nextReviewAt = validDate(candidate.next_review_at);
  const rolling = candidate.intake_type === 'rolling';
  const name = String(candidate.name ?? '').trim();
  const genericName = GENERIC_NAMES.has(name.toLowerCase());

  if (
    !candidate.official_source_confirmed
    || !isPlausibleOfficialSource(candidate.source_url, candidate.official_domains ?? [])
    || !hasEvidence(evidence, 'official_source')
  ) {
    failed.push('official_source');
  }

  if (name.length < 8 || genericName || !hasEvidence(evidence, 'named_round')) {
    failed.push('named_funding_round');
  }

  const hasFutureDeadline = deadline && deadline.getTime() >= now.getTime();
  const hasGovernedRollingIntake = rolling
    && nextReviewAt
    && nextReviewAt.getTime() >= now.getTime()
    && hasEvidence(evidence, 'intake_timing');
  if (!hasFutureDeadline && !hasGovernedRollingIntake) {
    failed.push('current_timing');
  }

  if (
    !Array.isArray(candidate.eligible_org_types)
    || candidate.eligible_org_types.length === 0
    || !hasEvidence(evidence, 'applicant_eligibility')
  ) {
    failed.push('applicant_eligibility');
  }

  const amountStatus = candidate.funding_amount_status;
  const hasKnownAmount = amountStatus === 'known'
    && (Number.isFinite(candidate.amount_min) || Number.isFinite(candidate.amount_max));
  const hasExplicitUnknownAmount = amountStatus === 'not_published';
  if ((!hasKnownAmount && !hasExplicitUnknownAmount) || !hasEvidence(evidence, 'funding_amount')) {
    failed.push('funding_amount');
  }

  if (
    !Array.isArray(candidate.project_codes)
    || candidate.project_codes.length === 0
    || !String(candidate.project_fit_reason ?? '').trim()
    || !hasEvidence(evidence, 'project_fit')
  ) {
    failed.push('concrete_project_fit');
  }

  const retrievedAt = validDate(candidate.retrieved_at);
  if (!retrievedAt || retrievedAt.getTime() > now.getTime() + 60_000) {
    failed.push('retrieval_provenance');
  }

  const uniqueFailed = [...new Set(failed)];
  return {
    passes: uniqueFailed.length === 0,
    status: uniqueFailed.length === 0 ? 'eligible_for_review' : 'needs_evidence',
    failed_requirements: uniqueFailed,
    evidence_completeness: Math.round(((7 - uniqueFailed.length) / 7) * 100),
  };
}

