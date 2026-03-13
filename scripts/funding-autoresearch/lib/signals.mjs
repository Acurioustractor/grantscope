export function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeArray(values) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => String(value || '').trim()).filter(Boolean);
}

const BENEFICIARY_ALIASES = [
  { match: ['first nations', 'indigenous', 'indigenous peoples', 'aboriginal', 'torres strait', 'tsi'], value: 'First Nations' },
  { match: ['rural_remote', 'rural & remote', 'rural and remote', 'regional', 'remote'], value: 'Rural & Remote' },
  { match: ['financially disadvantaged', 'disadvantaged'], value: 'Financially Disadvantaged' },
  { match: ['disability', 'people with disabilities'], value: 'Disability' },
  { match: ['youth', 'young people'], value: 'Youth' },
  { match: ['children', 'students'], value: 'Children' },
  { match: ['families'], value: 'Families' },
  { match: ['unemployed', 'employment seekers'], value: 'Unemployed' },
  { match: ['victims of crime'], value: 'Victims of Crime' },
  { match: ['women', 'females'], value: 'Females' },
  { match: ['community', 'community groups', 'community_org'], value: 'Community' },
];

export function normalizeBeneficiaryValue(value) {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  const alias = BENEFICIARY_ALIASES.find((entry) => entry.match.some((token) => normalized.includes(token)));
  if (alias) return alias.value;
  return String(value || '').trim();
}

export function normalizeBeneficiaryValues(values) {
  return compactUnique(normalizeArray(values).map(normalizeBeneficiaryValue), 12);
}

export function compactUnique(values, limit = 6) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

export function overlapCount(targets, values) {
  const targetSet = new Set(normalizeArray(targets).map(normalizeText));
  let count = 0;
  for (const value of normalizeArray(values)) {
    if (targetSet.has(normalizeText(value))) count += 1;
  }
  return count;
}

export function includesAny(targets, values) {
  return overlapCount(targets, values) > 0;
}

export function textContainsAny(value, targets) {
  const haystack = normalizeText(value);
  return normalizeArray(targets).some((target) => haystack.includes(normalizeText(target)));
}

export function stateMatches(targetStates, candidateStates) {
  const targets = normalizeArray(targetStates).map((state) => normalizeText(String(state).replace(/^AU-/, '')));
  const values = normalizeArray(candidateStates).map((state) => normalizeText(String(state).replace(/^AU-/, '')));
  return values.filter((value) => targets.includes(value)).length;
}

export function hasIndigenousSignal(candidate) {
  const values = [
    ...(candidate.themes || []),
    ...(candidate.purposes || []),
    ...(candidate.sectors || []),
    ...(candidate.beneficiaries || []),
    candidate.orgType,
    candidate.name,
  ];
  return values.some((value) => {
    const text = normalizeText(value);
    return text.includes('indigen') || text.includes('first nations') || text.includes('aboriginal') || text.includes('reconciliation') || text.includes('torres strait');
  });
}

export function hasCommunitySignal(candidate) {
  const values = [
    ...(candidate.themes || []),
    ...(candidate.purposes || []),
    ...(candidate.sectors || []),
    ...(candidate.beneficiaries || []),
  ];
  return values.some((value) => {
    const text = normalizeText(value);
    return text.includes('community') || text.includes('social welfare') || text.includes('welfare') || text.includes('family') || text.includes('community_org');
  });
}

export function hasRegionalSignal(candidate) {
  const values = [
    ...(candidate.beneficiaries || []),
    ...(candidate.states || []),
    candidate.remoteness,
  ];
  return values.some((value) => {
    const text = normalizeText(value);
    return text.includes('regional') || text.includes('remote') || text.includes('very remote') || text.includes('rural');
  });
}

export function grantActability(candidate) {
  let score = 0;
  if (candidate.url) score += 1;
  if (candidate.deadline) score += 1;
  if (candidate.lastVerifiedAt) score += 1;
  if (candidate.amountMin || candidate.amountMax) score += 1;
  return score;
}

export function foundationRelationshipUtility(candidate) {
  let score = 0;
  if (candidate.website) score += 1;
  if (candidate.hasOpenPrograms) score += 2;
  if (candidate.hasApplicationTips) score += 1;
  if (candidate.totalGivingAnnual && candidate.totalGivingAnnual > 0) score += 1;
  if (candidate.avgGrantSize || candidate.grantRangeMin || candidate.grantRangeMax) score += 1;
  if (candidate.givingPhilosophy) score += 1;
  if (candidate.wealthSource) score += 0.5;
  if (candidate.boardMembersCount && candidate.boardMembersCount > 0) score += 0.5;
  if (candidate.enrichedAt) score += 0.5;
  if (candidate.profileConfidence === 'high') score += 1;
  if (candidate.profileConfidence === 'medium') score += 0.5;
  return score;
}

export function deliveryTrust(candidate) {
  let score = 0;
  if (candidate.website) score += 1;
  if (candidate.hasEnrichment) score += 1;
  if (candidate.pbi) score += 1;
  if (candidate.hpc) score += 1;
  if (candidate.profileConfidence === 'high') score += 1;
  if (candidate.profileConfidence === 'medium') score += 0.5;
  if (candidate.totalRevenue && candidate.totalRevenue > 0) score += 0.75;
  if (candidate.totalGrantsGiven && candidate.totalGrantsGiven > 0) score += 0.75;
  if (candidate.hasDescription) score += 0.5;
  if (candidate.hasBusinessModel) score += 0.75;
  if (candidate.certificationsCount && candidate.certificationsCount > 0) score += 0.75;
  if (candidate.sourcePrimary) score += 0.5;
  if (candidate.hasGeographicFocus) score += 0.5;
  return score;
}
