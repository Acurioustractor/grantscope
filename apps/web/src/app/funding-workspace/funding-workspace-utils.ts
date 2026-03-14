import {
  coerceStateSignal,
  compactUnique,
  type FundingPowerTheme,
  fundingPowerThemeLabel,
  normaliseTheme,
} from '../components/funding-intelligence-utils';

import type {
  BlindSpotRow,
  CharityCandidate,
  FoundationRelationShape,
  GrantRelationShape,
  OrgProfileDetail,
  PowerSearchLens,
  PowerSearchRow,
  SavedFoundationWorkspaceRow,
  SavedGrantWorkspaceRow,
  SocialEnterpriseCandidate,
} from './funding-workspace-types';

export const ACTIVE_GRANT_STAGES = ['discovered', 'researching', 'pursuing', 'submitted', 'negotiating', 'approved'];
export const ACTIVE_FOUNDATION_STAGES = ['discovered', 'researching', 'connected', 'active_relationship'];
export const VALID_STATE_CODES = new Set(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);

export function formatCurrency(amount: number | null | undefined) {
  if (!amount) return 'Unknown';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${Math.round(amount).toLocaleString()}`;
}

export function formatShortDate(value: string | null | undefined) {
  if (!value) return 'No date set';
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeDate(value: string | null | undefined) {
  if (!value) return 'No date set';
  const now = new Date();
  const target = new Date(value);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d ago`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `${diffDays}d`;
}

export function pct(value: number | null | undefined) {
  return value == null ? '—' : `${Math.round(value)}%`;
}

export function grantStageLabel(stage: string) {
  return stage.replace(/_/g, ' ');
}

export function foundationStageLabel(stage: string) {
  return stage.replace(/_/g, ' ');
}

export function powerClassLabel(value: string | null | undefined) {
  if (!value) return 'Unclassified';
  return value.replace(/_/g, ' ');
}

export function opennessLabel(score: number | null | undefined) {
  if (score == null) return 'Unknown openness';
  if (score >= 0.6) return 'Open capital';
  if (score < 0.35) return 'Gatekept capital';
  return 'Mixed access';
}

export function confidenceBadge(confidence: string | null | undefined) {
  switch (confidence) {
    case 'high':
      return 'border-money bg-money-light text-money';
    case 'medium':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    default:
      return 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red';
  }
}

export function overlapSignals(targets: string[], values: string[] | null | undefined) {
  if (!targets.length || !values?.length) return [];
  const normalizedTargets = new Set(targets.map((value) => value.toLowerCase()));
  return values.filter((value) => normalizedTargets.has(value.toLowerCase()));
}

export function philanthropyPlausibility(
  foundation: SavedFoundationWorkspaceRow,
  themeSignals: string[],
  stateSignals: string[],
) {
  const reasons: string[] = [];
  let score = 0;
  const thematicMatches = overlapSignals(themeSignals, foundation.foundation.thematic_focus || []);
  const geographicMatches = overlapSignals(stateSignals, foundation.foundation.geographic_focus || []);

  if (thematicMatches.length > 0) {
    score += Math.min(3, thematicMatches.length * 1.5);
    reasons.push(`Themes line up with ${thematicMatches.slice(0, 2).join(', ')}`);
  }
  if (geographicMatches.length > 0) {
    score += Math.min(2, geographicMatches.length);
    reasons.push(`Active in ${geographicMatches.slice(0, 2).join(', ')}`);
  }
  if (foundation.foundation.application_tips) {
    score += 1.5;
    reasons.push('Application guidance is published');
  }
  if (foundation.foundation.giving_philosophy) {
    score += 1;
    reasons.push('Giving philosophy is documented');
  }
  if (foundation.foundation.avg_grant_size || foundation.foundation.grant_range_min || foundation.foundation.grant_range_max) {
    score += 1;
    reasons.push('Grant-size expectations are legible');
  }
  if (foundation.foundation.total_giving_annual && foundation.foundation.total_giving_annual > 0) {
    score += 1;
  }
  if (foundation.last_contact_date) {
    score += 1;
    reasons.push('There is already contact history');
  }
  if (foundation.foundation.profile_confidence === 'high') {
    score += 1.5;
  } else if (foundation.foundation.profile_confidence === 'medium') {
    score += 1;
  }
  if (foundation.foundation.wealth_source) {
    score += 0.5;
  }

  return {
    score: Math.round(score * 10) / 10,
    reasons: reasons.slice(0, 4),
  };
}

export function charityReadiness(charity: CharityCandidate) {
  let score = 0;
  const reasons: string[] = [];

  if (charity.website) {
    score += 1;
    reasons.push('Public website');
  }
  if (charity.has_enrichment) {
    score += 1;
    reasons.push('Enriched operating profile');
  }
  if (charity.pbi) {
    score += 1;
    reasons.push('PBI status');
  }
  if (charity.hpc) {
    score += 1;
    reasons.push('HPC status');
  }
  if (charity.total_revenue && charity.total_revenue > 0) {
    score += 1;
    reasons.push(`Revenue ${formatCurrency(charity.total_revenue)}`);
  }
  if (charity.total_grants_given && charity.total_grants_given > 0) {
    score += 1;
    reasons.push('Already trusted with grants');
  }
  if (charity.ben_aboriginal_tsi) score += 1;
  if (charity.ben_rural_regional_remote) score += 0.75;
  if (charity.ben_people_with_disabilities) score += 0.5;
  if (charity.ben_youth) score += 0.5;

  return { score: Math.round(score * 10) / 10, reasons: reasons.slice(0, 4) };
}

export function socialEnterpriseReadiness(enterprise: SocialEnterpriseCandidate) {
  let score = 0;
  const reasons: string[] = [];

  if (enterprise.website) {
    score += 1;
    reasons.push('Public website');
  }
  if (enterprise.business_model) {
    score += 1;
    reasons.push('Business model described');
  }
  if (enterprise.description) {
    score += 1;
    reasons.push('Delivery description is present');
  }
  if (enterprise.profile_confidence === 'high') {
    score += 1.5;
    reasons.push('High-confidence profile');
  } else if (enterprise.profile_confidence === 'medium') {
    score += 1;
  }
  if ((enterprise.certifications || []).length > 0) {
    score += 1;
    reasons.push(`${(enterprise.certifications || []).length} certifications recorded`);
  }
  if ((enterprise.geographic_focus || []).length > 0) {
    score += 0.75;
    reasons.push('Geographic footprint declared');
  }
  if (enterprise.source_primary) {
    score += 0.75;
    reasons.push(`Source lineage via ${enterprise.source_primary}`);
  }

  return { score: Math.round(score * 10) / 10, reasons: reasons.slice(0, 4) };
}

export function collectTopThemes(
  grants: SavedGrantWorkspaceRow[],
  foundations: SavedFoundationWorkspaceRow[],
) {
  return compactUnique(
    [
      ...grants.flatMap((grant) => grant.grant.categories || []),
      ...grants.flatMap((grant) => grant.grant.focus_areas || []),
      ...foundations.flatMap((foundation) => foundation.foundation.thematic_focus || []),
    ],
    6,
  );
}

export function collectStateSignals(
  grants: SavedGrantWorkspaceRow[],
  foundations: SavedFoundationWorkspaceRow[],
  profile: OrgProfileDetail | null,
) {
  const states = compactUnique(
    [
      ...grants.map((grant) => grant.grant.geography || ''),
      ...foundations.flatMap((foundation) => foundation.foundation.geographic_focus || []),
      ...(profile?.geographic_focus || []),
    ]
      .map(coerceStateSignal)
      .filter((value) => VALID_STATE_CODES.has(value)),
    6,
  );
  return states;
}

export function hasDisabilitySignal(values: Array<string | null | undefined>) {
  return values.some((value) => {
    const theme = normaliseTheme(value);
    return (
      theme.includes('disab') ||
      theme.includes('ndis') ||
      theme.includes('autis') ||
      theme.includes('care') ||
      theme.includes('support')
    );
  });
}

export function remotenessBoost(remoteness: string | null | undefined) {
  const value = normaliseTheme(remoteness);
  if (!value) return 0;
  if (value.includes('very remote')) return 3;
  if (value.includes('remote')) return 2.5;
  if (value.includes('regional')) return 1.5;
  return 0.5;
}

export function powerLensLabel(lens: PowerSearchLens) {
  switch (lens) {
    case 'alternatives':
      return 'Back alternatives';
    case 'captured':
      return 'Captured markets';
    default:
      return 'Pressure points';
  }
}

export function powerThemeCharityPurposes(theme: FundingPowerTheme) {
  switch (theme) {
    case 'indigenous_community':
      return ['Reconciliation', 'Social Welfare', 'Human Rights'];
    case 'youth_justice':
      return ['Social Welfare', 'Human Rights', 'Education'];
    case 'housing_homelessness':
      return ['Social Welfare', 'Human Rights'];
    case 'regional_regenerative':
      return ['Environment', 'Education', 'Culture'];
    default:
      return ['Health', 'Social Welfare'];
  }
}

export function powerThemeSocialSectors(theme: FundingPowerTheme) {
  switch (theme) {
    case 'indigenous_community':
      return ['indigenous', 'community', 'employment'];
    case 'youth_justice':
      return ['community', 'education', 'employment'];
    case 'housing_homelessness':
      return ['housing', 'community', 'health'];
    case 'regional_regenerative':
      return ['environment', 'food', 'community'];
    default:
      return ['health', 'community'];
  }
}

export function powerThemeAlternativeLabel(theme: FundingPowerTheme) {
  switch (theme) {
    case 'indigenous_community':
      return 'Indigenous or community-rooted enterprises';
    case 'youth_justice':
      return 'Youth / justice-aligned enterprises';
    case 'housing_homelessness':
      return 'Housing / homelessness-aligned enterprises';
    case 'regional_regenerative':
      return 'Regional / regenerative enterprises';
    default:
      return 'Disability-focused enterprises';
  }
}

export function hasPowerThemeEnterpriseSignal(
  enterprise: Pick<SocialEnterpriseCandidate, 'org_type' | 'sector' | 'target_beneficiaries'>,
  theme: FundingPowerTheme,
) {
  const sectorText = (enterprise.sector || []).map(normaliseTheme);
  const beneficiaryText = (enterprise.target_beneficiaries || []).map(normaliseTheme);
  switch (theme) {
    case 'indigenous_community':
      return (
        enterprise.org_type === 'indigenous_business' ||
        beneficiaryText.some((value) => value.includes('indigenous') || value.includes('aboriginal') || value.includes('torres strait'))
      );
    case 'youth_justice':
      return beneficiaryText.some(
        (value) => value.includes('youth') || value.includes('prisoner') || value.includes('offender') || value.includes('justice'),
      );
    case 'housing_homelessness':
      return beneficiaryText.some((value) => value.includes('homeless')) || sectorText.some((value) => value.includes('housing'));
    case 'regional_regenerative':
      return (
        beneficiaryText.some((value) => value.includes('geographic community') || value.includes('environmental sustainability')) ||
        sectorText.some((value) => value.includes('environment') || value.includes('food') || value.includes('community'))
      );
    default:
      return enterprise.org_type === 'disability_enterprise' || hasDisabilitySignal(enterprise.target_beneficiaries || []);
  }
}

export function hasPowerThemeCommunityOrgSignal(
  row: { domain: string[] | null },
  theme: FundingPowerTheme,
) {
  const domains = (row.domain || []).map(normaliseTheme);
  switch (theme) {
    case 'indigenous_community':
      return domains.some((value) => value.includes('indigenous') || value.includes('first nations'));
    case 'youth_justice':
      return domains.some((value) => value.includes('youth') || value.includes('law') || value.includes('social welfare'));
    case 'housing_homelessness':
      return domains.some((value) => value.includes('housing') || value.includes('homeless') || value.includes('social welfare'));
    case 'regional_regenerative':
      return domains.some((value) => value.includes('environment') || value.includes('community development') || value.includes('community'));
    default:
      return domains.some((value) => value.includes('disability') || value.includes('health'));
  }
}

export function buildPowerSearchRow(
  spot: BlindSpotRow,
  lens: PowerSearchLens,
  theme: FundingPowerTheme,
  stateThinDistrictCount: number,
  stateVeryThinDistrictCount: number,
  stateMaxCapturePct: number | null,
  localCommunityControlledCount: number,
  localThemedEnterpriseCount: number,
  stateThemedCommunityOrgCount: number,
  justiceRows: number,
): PowerSearchRow {
  const localAlternativeCount = localCommunityControlledCount + localThemedEnterpriseCount;
  const lowFunding = !spot.total_funding || spot.total_funding < 1_000_000;
  const sparseCoverage = (spot.entity_count || 0) <= 2;
  let score = 0;
  const reasons: string[] = [];

  if (stateThinDistrictCount > 0) reasons.push(`${stateThinDistrictCount} thin disability districts in ${spot.state}`);
  if (stateVeryThinDistrictCount > 0) reasons.push(`${stateVeryThinDistrictCount} very thin districts`);
  if (stateMaxCapturePct != null && stateMaxCapturePct >= 80) reasons.push(`Top providers capture ${pct(stateMaxCapturePct)} in parts of ${spot.state}`);
  if (justiceRows > 0) reasons.push(`${justiceRows.toLocaleString('en-AU')} justice funding records in ${spot.state}`);
  if (localCommunityControlledCount > 0) reasons.push(`${localCommunityControlledCount} community-controlled entities locally`);
  if (localThemedEnterpriseCount > 0) reasons.push(`${localThemedEnterpriseCount} ${powerThemeAlternativeLabel(theme).toLowerCase()} locally`);
  if (stateThemedCommunityOrgCount > 0) reasons.push(`${stateThemedCommunityOrgCount} ${fundingPowerThemeLabel(theme).toLowerCase()} community organisations in-state`);
  if (lowFunding) reasons.push('Tracked funding is thin');
  if (sparseCoverage) reasons.push('Very few funded organisations are visible');

  switch (lens) {
    case 'alternatives':
      score += localAlternativeCount * 4;
      score += stateThemedCommunityOrgCount * 0.35;
      score += stateThinDistrictCount * 2;
      score += stateVeryThinDistrictCount;
      score += (stateMaxCapturePct || 0) / 12;
      score += justiceRows > 0 ? 3 : 0;
      score += remotenessBoost(spot.remoteness);
      if (sparseCoverage) score += 1.5;
      break;
    case 'captured':
      score += (stateMaxCapturePct || 0) / 5;
      score += stateThinDistrictCount * 2;
      score += stateVeryThinDistrictCount * 1.5;
      score += justiceRows > 0 ? (theme === 'youth_justice' ? 5 : 2) : 0;
      score += localAlternativeCount === 0 ? 4 : Math.max(0, 2 - localAlternativeCount);
      score += sparseCoverage ? 2 : 0;
      break;
    default:
      score += stateThinDistrictCount * 3;
      score += stateVeryThinDistrictCount * 2;
      score += (stateMaxCapturePct || 0) / 8;
      score += justiceRows > 0 ? (theme === 'youth_justice' ? 9 : 6) : 0;
      score += remotenessBoost(spot.remoteness);
      score += sparseCoverage ? 2 : 0;
      score += lowFunding ? 2 : 0;
      score += localAlternativeCount > 0 ? 1 + Math.min(4, localAlternativeCount) : 0;
      score += stateThemedCommunityOrgCount * 0.25;
      break;
  }

  if (theme === 'indigenous_community') {
    score += localCommunityControlledCount * 4 + localThemedEnterpriseCount * 3;
  } else if (theme === 'housing_homelessness') {
    score += (lowFunding ? 3 : 0) + localThemedEnterpriseCount * 2.5;
  } else if (theme === 'regional_regenerative') {
    score += remotenessBoost(spot.remoteness) * 1.5 + localThemedEnterpriseCount * 2.5;
  } else if (theme === 'disability_ndis') {
    score += stateThinDistrictCount * 1.5 + (stateMaxCapturePct || 0) / 10;
  }

  return {
    ...spot,
    localCommunityControlledCount,
    localThemedEnterpriseCount,
    stateThemedCommunityOrgCount,
    localAlternativeCount,
    stateThinDistrictCount,
    stateVeryThinDistrictCount,
    stateMaxCapturePct,
    justiceRows,
    score: Math.round(score * 10) / 10,
    reasons: compactUnique(reasons, 5),
  };
}

export function buildProfileChecklist(
  profile: OrgProfileDetail | null,
  foundations: SavedFoundationWorkspaceRow[],
  matchedCharities: CharityCandidate[],
  matchedSocialEnterprises: SocialEnterpriseCandidate[],
) {
  const projectCount = Array.isArray(profile?.projects) ? profile?.projects.length : 0;
  return [
    {
      label: 'Mission written',
      done: Boolean(profile?.mission),
      detail: profile?.mission ? 'Your profile can speak to purpose immediately.' : 'Write a concrete mission before asking philanthropy to respond.',
    },
    {
      label: 'Website published',
      done: Boolean(profile?.website),
      detail: profile?.website ? 'A live website gives funders basic trust signals.' : 'Add a public website or landing page before outreach.',
    },
    {
      label: 'Place focus declared',
      done: Boolean(profile?.geographic_focus?.length),
      detail: profile?.geographic_focus?.length ? profile?.geographic_focus.join(', ') : 'Name the geographies you actually serve.',
    },
    {
      label: 'Project examples in profile',
      done: projectCount > 0,
      detail: projectCount > 0 ? `${projectCount} projects already strengthen your profile.` : 'Add concrete projects so funders can see what delivery looks like.',
    },
    {
      label: 'Funder relationship notes live',
      done: foundations.some((foundation) => Boolean(foundation.notes?.trim())),
      detail: foundations.some((foundation) => Boolean(foundation.notes?.trim()))
        ? 'At least one funder already has context recorded.'
        : 'Record why a funder fits, who to approach, and what not to ask for.',
    },
    {
      label: 'Delivery partners identified',
      done: matchedCharities.length + matchedSocialEnterprises.length > 0,
      detail: matchedCharities.length + matchedSocialEnterprises.length > 0
        ? 'You already have a live partner scan for this funding thesis.'
        : 'Map likely charities and social enterprises before you pitch scale.',
    },
  ];
}

export function scoreCharityCandidate(
  charity: CharityCandidate,
  purposeSignals: string[],
  stateSignals: string[],
) {
  const reasons: string[] = [];
  let score = 0;
  const readiness = charityReadiness(charity);
  const purposeMatches = (charity.purposes || []).filter((purpose) => purposeSignals.includes(purpose));
  const stateMatches = (charity.operating_states || []).filter((state) => stateSignals.includes(state));
  if (purposeMatches.length > 0) {
    score += purposeMatches.length * 3;
    reasons.push(`Works in ${purposeMatches.slice(0, 2).join(', ')}`);
  }
  if (stateMatches.length > 0) {
    score += Math.min(2, stateMatches.length) * 2;
    reasons.push(`Active in ${stateMatches.slice(0, 2).join(', ')}`);
  }
  if (charity.beneficiaries?.includes('First Nations') || charity.ben_aboriginal_tsi) {
    score += 2;
    reasons.push('Explicit First Nations beneficiary focus');
  }
  if (charity.ben_rural_regional_remote) {
    score += 1;
    reasons.push('Regional / remote beneficiary coverage');
  }
  score += readiness.score * 0.75;
  return { ...charity, readinessScore: readiness.score, score, reasons: compactUnique([...reasons, ...readiness.reasons], 5) };
}

export function scoreSocialEnterpriseCandidate(
  enterprise: SocialEnterpriseCandidate,
  sectorSignals: string[],
  stateSignals: string[],
) {
  const reasons: string[] = [];
  let score = 0;
  const readiness = socialEnterpriseReadiness(enterprise);
  const sectorMatches = (enterprise.sector || []).filter((sector) => sectorSignals.includes(sector));
  if (sectorMatches.length > 0) {
    score += sectorMatches.length * 3;
    reasons.push(`Works in ${sectorMatches.slice(0, 2).join(', ')}`);
  }
  const geoMatches = compactUnique([
    ...(enterprise.state && stateSignals.includes(enterprise.state) ? [enterprise.state] : []),
    ...((enterprise.geographic_focus || []).filter((value) => stateSignals.includes(value))),
  ], 2);
  if (geoMatches.length > 0) {
    score += geoMatches.length * 2;
    reasons.push(`Present in ${geoMatches.join(', ')}`);
  }
  if (enterprise.org_type === 'indigenous_business') {
    score += 2;
    reasons.push('Indigenous business');
  }
  if (enterprise.org_type === 'social_enterprise') {
    score += 1;
  }
  score += readiness.score * 0.75;
  return { ...enterprise, readinessScore: readiness.score, score, reasons: compactUnique([...reasons, ...readiness.reasons], 5) };
}

export function grantNextMove(grant: SavedGrantWorkspaceRow, orgName: string) {
  if (!grant.notes?.trim()) {
    return `Write why ${grant.grant.name} matters for ${orgName} before moving it forward.`;
  }
  if (grant.stage === 'researching') {
    return `Turn research into a go / no-go call and decide who owns the draft.`;
  }
  if (grant.stage === 'pursuing') {
    return `Pull together the delivery case, partner evidence, and budget before submission.`;
  }
  if (grant.stage === 'submitted') {
    return `Track follow-up dates and prepare proof assets for any clarification request.`;
  }
  if (grant.grant.closes_at) {
    return `Deadline is ${formatRelativeDate(grant.grant.closes_at)}. Keep the application moving.`;
  }
  return `Qualify fit, funding amount, and delivery evidence before you commit attention.`;
}

export function foundationNextMove(foundation: SavedFoundationWorkspaceRow, orgName: string) {
  if (!foundation.notes?.trim()) {
    return `Record the case for fit with ${orgName} before making contact.`;
  }
  if (foundation.stage === 'discovered') {
    return 'Move from discovery into research: recent giving, board logic, and introduction path.';
  }
  if (foundation.stage === 'researching' && !foundation.last_contact_date) {
    return 'Prepare first contact or a warm introduction route.';
  }
  if (foundation.stage === 'connected') {
    return 'Log the next follow-up and keep the relationship from going cold.';
  }
  if (foundation.stage === 'active_relationship') {
    return 'Use the relationship actively: update, ask, or stewardship next step.';
  }
  return 'Keep the relationship current and avoid treating the funder like a cold directory record.';
}

export function sliceNonZero<T extends { score?: number | null }>(rows: T[], limit = 6) {
  return rows.filter((row) => (row.score || 0) > 0).slice(0, limit);
}

export function normalizeGrantRow(row: GrantRelationShape): SavedGrantWorkspaceRow {
  return {
    ...row,
    grant: Array.isArray(row.grant) ? row.grant[0] : row.grant,
  };
}

export function normalizeFoundationRow(row: FoundationRelationShape): SavedFoundationWorkspaceRow {
  return {
    ...row,
    foundation: Array.isArray(row.foundation) ? row.foundation[0] : row.foundation,
  };
}
