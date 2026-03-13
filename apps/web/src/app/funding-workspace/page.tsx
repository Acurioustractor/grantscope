import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import {
  coerceStateSignal,
  compactUnique,
  detectFundingPowerTheme,
  fundingPowerThemeDescription,
  fundingPowerThemeLabel,
  type FundingPowerTheme,
  mapThemeToCharityPurpose,
  mapThemeToSocialEnterpriseSector,
  normaliseTheme,
} from '../components/funding-intelligence-utils';

export const dynamic = 'force-dynamic';

type SavedGrantWorkspaceRow = {
  id: string;
  grant_id: string;
  stars: number;
  color: string | null;
  stage: string;
  notes: string | null;
  updated_at: string;
  grant: {
    id: string;
    name: string;
    provider: string;
    program: string | null;
    program_type: string | null;
    amount_min: number | null;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[] | null;
    focus_areas: string[] | null;
    source: string | null;
    geography: string | null;
    application_status: string | null;
    last_verified_at: string | null;
    url: string | null;
  };
};

type SavedFoundationWorkspaceRow = {
  id: string;
  foundation_id: string;
  stars: number;
  stage: string;
  notes: string | null;
  last_contact_date: string | null;
  updated_at: string;
  alignment_score: number | null;
  alignment_reasons: string[] | null;
  foundation: {
    id: string;
    name: string;
    type: string | null;
    website: string | null;
    total_giving_annual: number | null;
    thematic_focus: string[] | null;
    geographic_focus: string[] | null;
    profile_confidence: string | null;
    enriched_at: string | null;
    giving_philosophy: string | null;
    application_tips: string | null;
    avg_grant_size: number | null;
    grant_range_min: number | null;
    grant_range_max: number | null;
    wealth_source: string | null;
  };
};

type FoundationPowerProfile = {
  foundation_id: string;
  capital_holder_class: string;
  capital_source_class: string;
  reportable_in_power_map: boolean;
  openness_score: number | null;
  gatekeeping_score: number | null;
};

type CharityCandidate = {
  abn: string;
  name: string;
  purposes: string[] | null;
  beneficiaries: string[] | null;
  operating_states: string[] | null;
  pbi: boolean | null;
  hpc: boolean | null;
  website: string | null;
  total_revenue: number | null;
  total_grants_given: number | null;
  has_enrichment: boolean | null;
  ben_aboriginal_tsi: boolean | null;
  ben_rural_regional_remote: boolean | null;
  ben_people_with_disabilities: boolean | null;
  ben_youth: boolean | null;
  readinessScore?: number;
  score?: number;
  reasons?: string[];
};

type SocialEnterpriseCandidate = {
  id: string;
  name: string;
  org_type: string;
  state: string | null;
  sector: string[] | null;
  source_primary: string | null;
  target_beneficiaries: string[] | null;
  website: string | null;
  profile_confidence: string | null;
  geographic_focus: string[] | null;
  certifications: unknown[] | null;
  description: string | null;
  business_model: string | null;
  readinessScore?: number;
  score?: number;
  reasons?: string[];
};

type BlindSpotRow = {
  postcode: string;
  state: string | null;
  remoteness: string | null;
  entity_count: number | null;
  total_funding: number | null;
  locality: string | null;
  lga_name: string | null;
};

type FundingWorkspaceSearchParams = {
  lens?: string;
  state?: string;
  theme?: string;
};

type PowerSearchLens = 'pressure' | 'alternatives' | 'captured';

type PowerSearchRow = BlindSpotRow & {
  localCommunityControlledCount: number;
  localThemedEnterpriseCount: number;
  stateThemedCommunityOrgCount: number;
  localAlternativeCount: number;
  stateThinDistrictCount: number;
  stateVeryThinDistrictCount: number;
  stateMaxCapturePct: number | null;
  justiceRows: number;
  score: number;
  reasons: string[];
};

type NdisSupplyRow = {
  state_code: string;
  service_district_name: string;
  provider_count: number;
};

type NdisConcentrationRow = {
  state_code: string;
  service_district_name: string;
  support_class: string;
  payment_share_top10_pct: number | null;
  payment_band: string | null;
};

type OrgProfileDetail = {
  id: string;
  name: string;
  description: string | null;
  mission: string | null;
  website: string | null;
  geographic_focus: string[] | null;
  org_type: string | null;
  projects: Array<Record<string, unknown>> | null;
};

type GrantRelationShape = SavedGrantWorkspaceRow & {
  grant: SavedGrantWorkspaceRow['grant'] | SavedGrantWorkspaceRow['grant'][];
};

type FoundationRelationShape = SavedFoundationWorkspaceRow & {
  foundation: SavedFoundationWorkspaceRow['foundation'] | SavedFoundationWorkspaceRow['foundation'][];
};

const ACTIVE_GRANT_STAGES = ['discovered', 'researching', 'pursuing', 'submitted', 'negotiating', 'approved'];
const ACTIVE_FOUNDATION_STAGES = ['discovered', 'researching', 'connected', 'active_relationship'];
const VALID_STATE_CODES = new Set(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);

function formatCurrency(amount: number | null | undefined) {
  if (!amount) return 'Unknown';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${Math.round(amount).toLocaleString()}`;
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return 'No date set';
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeDate(value: string | null | undefined) {
  if (!value) return 'No date set';
  const now = new Date();
  const target = new Date(value);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d ago`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return `${diffDays}d`;
}

function pct(value: number | null | undefined) {
  return value == null ? '—' : `${Math.round(value)}%`;
}

function grantStageLabel(stage: string) {
  return stage.replace(/_/g, ' ');
}

function foundationStageLabel(stage: string) {
  return stage.replace(/_/g, ' ');
}

function powerClassLabel(value: string | null | undefined) {
  if (!value) return 'Unclassified';
  return value.replace(/_/g, ' ');
}

function opennessLabel(score: number | null | undefined) {
  if (score == null) return 'Unknown openness';
  if (score >= 0.6) return 'Open capital';
  if (score < 0.35) return 'Gatekept capital';
  return 'Mixed access';
}

function confidenceBadge(confidence: string | null | undefined) {
  switch (confidence) {
    case 'high':
      return 'border-money bg-money-light text-money';
    case 'medium':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    default:
      return 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red';
  }
}

function overlapSignals(targets: string[], values: string[] | null | undefined) {
  if (!targets.length || !values?.length) return [];
  const normalizedTargets = new Set(targets.map((value) => value.toLowerCase()));
  return values.filter((value) => normalizedTargets.has(value.toLowerCase()));
}

function philanthropyPlausibility(
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

function charityReadiness(charity: CharityCandidate) {
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

function socialEnterpriseReadiness(enterprise: SocialEnterpriseCandidate) {
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

function collectTopThemes(
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

function collectStateSignals(
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

function hasDisabilitySignal(values: Array<string | null | undefined>) {
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

function remotenessBoost(remoteness: string | null | undefined) {
  const value = normaliseTheme(remoteness);
  if (!value) return 0;
  if (value.includes('very remote')) return 3;
  if (value.includes('remote')) return 2.5;
  if (value.includes('regional')) return 1.5;
  return 0.5;
}

function powerLensLabel(lens: PowerSearchLens) {
  switch (lens) {
    case 'alternatives':
      return 'Back alternatives';
    case 'captured':
      return 'Captured markets';
    default:
      return 'Pressure points';
  }
}

function powerThemeCharityPurposes(theme: FundingPowerTheme) {
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

function powerThemeSocialSectors(theme: FundingPowerTheme) {
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

function powerThemeAlternativeLabel(theme: FundingPowerTheme) {
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

function hasPowerThemeEnterpriseSignal(
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

function hasPowerThemeCommunityOrgSignal(
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

function buildPowerSearchRow(
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

function buildProfileChecklist(
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

function scoreCharityCandidate(
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

function scoreSocialEnterpriseCandidate(
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

function grantNextMove(grant: SavedGrantWorkspaceRow, orgName: string) {
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

function foundationNextMove(foundation: SavedFoundationWorkspaceRow, orgName: string) {
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

function sliceNonZero<T extends { score?: number | null }>(rows: T[], limit = 6) {
  return rows.filter((row) => (row.score || 0) > 0).slice(0, limit);
}

function normalizeGrantRow(row: GrantRelationShape): SavedGrantWorkspaceRow {
  return {
    ...row,
    grant: Array.isArray(row.grant) ? row.grant[0] : row.grant,
  };
}

function normalizeFoundationRow(row: FoundationRelationShape): SavedFoundationWorkspaceRow {
  return {
    ...row,
    foundation: Array.isArray(row.foundation) ? row.foundation[0] : row.foundation,
  };
}

export default async function FundingWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<FundingWorkspaceSearchParams>;
}) {
  const params = await searchParams;
  const authSupabase = await createSupabaseServer();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/funding-workspace');
  }

  const db = getServiceSupabase();
  const orgContext = await getCurrentOrgProfileContext(db, user.id);

  const baseGrantSelect = `
    id,
    grant_id,
    stars,
    color,
    stage,
    notes,
    updated_at,
    grant:grant_opportunities(
      id,
      name,
      provider,
      program,
      program_type,
      amount_min,
      amount_max,
      closes_at,
      categories,
      focus_areas,
      source,
      geography,
      application_status,
      last_verified_at,
      url
    )
  `;

  const baseFoundationSelect = `
    id,
    foundation_id,
    stars,
    stage,
    notes,
    last_contact_date,
    updated_at,
    alignment_score,
    alignment_reasons,
    foundation:foundations(
      id,
      name,
      type,
      website,
      total_giving_annual,
      thematic_focus,
      geographic_focus,
      profile_confidence,
      enriched_at,
      giving_philosophy,
      application_tips,
      avg_grant_size,
      grant_range_min,
      grant_range_max,
      wealth_source
    )
  `;

  const [orgSavedGrantsResult, orgSavedFoundationsResult, profileResult] = await Promise.all([
    orgContext.orgProfileId
      ? db
          .from('saved_grants')
          .select(baseGrantSelect)
          .eq('org_profile_id', orgContext.orgProfileId)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] as SavedGrantWorkspaceRow[] }),
    orgContext.orgProfileId
      ? db
          .from('saved_foundations')
          .select(baseFoundationSelect)
          .eq('org_profile_id', orgContext.orgProfileId)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] as SavedFoundationWorkspaceRow[] }),
    orgContext.orgProfileId
      ? db
          .from('org_profiles')
          .select('id, name, description, mission, website, geographic_focus, org_type, projects')
          .eq('id', orgContext.orgProfileId)
          .maybeSingle()
      : Promise.resolve({ data: null as OrgProfileDetail | null }),
  ]);

  const orgSavedGrants = ((orgSavedGrantsResult.data || []) as GrantRelationShape[]).map(normalizeGrantRow);
  const orgSavedFoundations = ((orgSavedFoundationsResult.data || []) as FoundationRelationShape[]).map(normalizeFoundationRow);
  const profile = (profileResult.data || null) as OrgProfileDetail | null;

  let workspaceScope: 'team' | 'personal' = orgSavedGrants.length + orgSavedFoundations.length > 0 ? 'team' : 'personal';
  let savedGrants = orgSavedGrants;
  let savedFoundations = orgSavedFoundations;

  if (workspaceScope === 'personal') {
    const [personalGrantsResult, personalFoundationsResult] = await Promise.all([
      db
        .from('saved_grants')
        .select(baseGrantSelect)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      db
        .from('saved_foundations')
        .select(baseFoundationSelect)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
    ]);

    savedGrants = ((personalGrantsResult.data || []) as GrantRelationShape[]).map(normalizeGrantRow);
    savedFoundations = ((personalFoundationsResult.data || []) as FoundationRelationShape[]).map(normalizeFoundationRow);
  }

  const foundationPowerIds = compactUnique(savedFoundations.map((foundation) => foundation.foundation_id));
  const { data: foundationPowerRows } = foundationPowerIds.length
    ? await db
        .from('foundation_power_profiles')
        .select('foundation_id, capital_holder_class, capital_source_class, reportable_in_power_map, openness_score, gatekeeping_score')
        .in('foundation_id', foundationPowerIds)
    : { data: [] as FoundationPowerProfile[] };
  const foundationPowerMap = new Map<string, FoundationPowerProfile>();
  for (const row of (foundationPowerRows || []) as FoundationPowerProfile[]) {
    foundationPowerMap.set(row.foundation_id, row);
  }

  const topThemes = collectTopThemes(savedGrants, savedFoundations);
  const stateSignals = collectStateSignals(savedGrants, savedFoundations, profile);
  const disabilityThemeActive = hasDisabilitySignal(topThemes);
  const inferredPowerTheme =
    detectFundingPowerTheme(params.theme) ||
    detectFundingPowerTheme(topThemes.join(' ')) ||
    (disabilityThemeActive ? 'disability_ndis' : 'indigenous_community');
  const activePowerTheme = inferredPowerTheme as FundingPowerTheme;
  const activeLens: PowerSearchLens =
    params.lens === 'alternatives' || params.lens === 'captured' ? params.lens : 'pressure';
  const requestedState = params.state?.toUpperCase();
  const activePowerState = requestedState && VALID_STATE_CODES.has(requestedState) ? requestedState : '';
  const charityPurposeSignals = compactUnique(
    [
      ...topThemes.map((theme) => mapThemeToCharityPurpose(theme)),
      ...powerThemeCharityPurposes(activePowerTheme),
    ].filter(Boolean),
    4,
  );
  const socialSectorSignals = compactUnique(
    [
      ...topThemes.map((theme) => mapThemeToSocialEnterpriseSector(theme)),
      ...powerThemeSocialSectors(activePowerTheme),
    ].filter(Boolean),
    4,
  );

  let charityQuery = db
    .from('v_charity_explorer')
    .select('abn, name, purposes, beneficiaries, operating_states, pbi, hpc, website, total_revenue, total_grants_given, has_enrichment, ben_aboriginal_tsi, ben_rural_regional_remote, ben_people_with_disabilities, ben_youth, is_foundation')
    .eq('is_foundation', false)
    .limit(40);
  if (charityPurposeSignals.length > 0) {
    charityQuery = charityQuery.overlaps('purposes', charityPurposeSignals);
  }
  if (stateSignals.length > 0) {
    charityQuery = charityQuery.overlaps('operating_states', stateSignals);
  }

  let socialEnterpriseQuery = db
    .from('social_enterprises')
    .select('id, name, org_type, state, sector, source_primary, target_beneficiaries, website, profile_confidence, geographic_focus, certifications, description, business_model')
    .limit(40);
  if (socialSectorSignals.length > 0) {
    socialEnterpriseQuery = socialEnterpriseQuery.overlaps('sector', socialSectorSignals);
  }
  if (stateSignals.length > 0) {
    socialEnterpriseQuery = socialEnterpriseQuery.in('state', stateSignals);
  }

  let blindSpotQuery = db
    .from('mv_funding_by_postcode')
    .select('postcode, state, remoteness, entity_count, total_funding')
    .lte('entity_count', 5)
    .order('entity_count', { ascending: true })
    .order('total_funding', { ascending: true })
    .limit(24);
  if (activePowerState) {
    blindSpotQuery = blindSpotQuery.eq('state', activePowerState);
  } else if (stateSignals.length > 0) {
    blindSpotQuery = blindSpotQuery.in('state', stateSignals);
  }

  let ndisSupplyQuery = db
    .from('v_ndis_provider_supply_summary')
    .select('state_code, service_district_name, provider_count')
    .neq('state_code', 'ALL')
    .neq('state_code', 'OT')
    .neq('state_code', 'State_Missing')
    .eq('service_district_name', 'ALL')
    .order('provider_count', { ascending: false })
    .limit(8);
  if (stateSignals.length > 0) {
    ndisSupplyQuery = ndisSupplyQuery.in('state_code', stateSignals);
  }

  let ndisDistrictQuery = db
    .from('v_ndis_provider_supply_summary')
    .select('state_code, service_district_name, provider_count')
    .neq('state_code', 'ALL')
    .neq('state_code', 'OT')
    .neq('state_code', 'State_Missing')
    .neq('service_district_name', 'ALL')
    .neq('service_district_name', 'Other')
    .not('service_district_name', 'ilike', '%Missing%')
    .order('provider_count', { ascending: true })
    .limit(18);
  if (stateSignals.length > 0) {
    ndisDistrictQuery = ndisDistrictQuery.in('state_code', stateSignals);
  }

  let ndisConcentrationQuery = db
    .from('ndis_market_concentration')
    .select('state_code, service_district_name, support_class, payment_share_top10_pct, payment_band')
    .neq('state_code', 'ALL')
    .neq('state_code', 'OT')
    .neq('state_code', 'State_Missing')
    .neq('service_district_name', 'ALL')
    .neq('service_district_name', 'Other')
    .not('service_district_name', 'ilike', '%Missing%')
    .in('support_class', ['Core', 'Capacity Building'])
    .not('payment_share_top10_pct', 'is', null)
    .neq('payment_band', '< 1m')
    .order('payment_share_top10_pct', { ascending: false })
    .limit(120);
  if (stateSignals.length > 0) {
    ndisConcentrationQuery = ndisConcentrationQuery.in('state_code', stateSignals);
  }

  let disabilitySocialEnterpriseQuery = db
    .from('social_enterprises')
    .select('id', { count: 'exact', head: true })
    .contains('target_beneficiaries', ['people_with_disability']);
  if (stateSignals.length > 0) {
    disabilitySocialEnterpriseQuery = disabilitySocialEnterpriseQuery.in('state', stateSignals);
  }

  let disabilityCommunityOrgQuery = db
    .from('community_orgs')
    .select('id', { count: 'exact', head: true })
    .contains('domain', ['disability']);
  if (stateSignals.length > 0) {
    disabilityCommunityOrgQuery = disabilityCommunityOrgQuery.overlaps(
      'geographic_focus',
      stateSignals.map((state) => `AU-${state}`),
    );
  }

  const [
    charitiesResult,
    socialEnterprisesResult,
    blindSpotsResult,
    ndisSupplyResult,
    ndisDistrictResult,
    ndisConcentrationResult,
    disabilitySocialEnterpriseResult,
    disabilityCommunityOrgResult,
  ] = await Promise.all([
    charityQuery,
    socialEnterpriseQuery,
    blindSpotQuery,
    ndisSupplyQuery,
    ndisDistrictQuery,
    ndisConcentrationQuery,
    disabilitySocialEnterpriseQuery,
    disabilityCommunityOrgQuery,
  ]);

  const blindSpotRows = (blindSpotsResult.data || []) as Array<{
    postcode: string;
    state: string | null;
    remoteness: string | null;
    entity_count: number | null;
    total_funding: number | null;
  }>;

  const postcodeLookup = blindSpotRows.length
    ? await db
        .from('postcode_geo')
        .select('postcode, locality, lga_name')
        .in(
          'postcode',
          compactUnique(blindSpotRows.map((row) => row.postcode), blindSpotRows.length),
        )
    : { data: [] as Array<{ postcode: string; locality: string | null; lga_name: string | null }> };

  const postcodeMap = new Map(
    (postcodeLookup.data || []).map((row) => [row.postcode, row]),
  );

  const blindSpotPostcodes = compactUnique(blindSpotRows.map((row) => row.postcode), blindSpotRows.length);
  const blindSpotStates = compactUnique(blindSpotRows.map((row) => row.state), blindSpotRows.length).filter((value) =>
    VALID_STATE_CODES.has(value),
  );

  const [localEntitySignalsResult, localSocialEnterpriseSignalsResult, communityOrgSignalsResult, justiceStateCounts] = await Promise.all([
    blindSpotPostcodes.length > 0
      ? db
          .from('gs_entities')
          .select('postcode, state, is_community_controlled')
          .in('postcode', blindSpotPostcodes)
          .in('state', blindSpotStates.length > 0 ? blindSpotStates : Array.from(VALID_STATE_CODES))
      : Promise.resolve({ data: [] as Array<{ postcode: string | null; state: string | null; is_community_controlled: boolean | null }> }),
    blindSpotPostcodes.length > 0
      ? db
          .from('social_enterprises')
          .select('postcode, state, target_beneficiaries, org_type, sector')
          .in('postcode', blindSpotPostcodes)
          .in('state', blindSpotStates.length > 0 ? blindSpotStates : Array.from(VALID_STATE_CODES))
      : Promise.resolve({
          data: [] as Array<{
            postcode: string | null;
            state: string | null;
            target_beneficiaries: string[] | null;
            org_type: string;
            sector: string[] | null;
          }>,
        }),
    blindSpotStates.length > 0
      ? db
          .from('community_orgs')
          .select('geographic_focus, domain')
          .overlaps('geographic_focus', blindSpotStates.map((state) => `AU-${state}`))
      : Promise.resolve({ data: [] as Array<{ geographic_focus: string[] | null; domain: string[] | null }> }),
    Promise.all(
      (blindSpotStates.length > 0 ? blindSpotStates : ['QLD']).map(async (state) => {
        const { count } = await db
          .from('justice_funding')
          .select('id', { count: 'exact', head: true })
          .eq('state', state);
        return { state, count: count || 0 };
      }),
    ),
  ]);

  const localCommunityControlledMap = new Map<string, number>();
  for (const row of localEntitySignalsResult.data || []) {
    if (!row.postcode || !row.state || !row.is_community_controlled) continue;
    const key = `${row.state}:${row.postcode}`;
    localCommunityControlledMap.set(key, (localCommunityControlledMap.get(key) || 0) + 1);
  }

  const localThemedEnterpriseMap = new Map<string, number>();
  for (const row of localSocialEnterpriseSignalsResult.data || []) {
    if (!row.postcode || !row.state) continue;
    if (!hasPowerThemeEnterpriseSignal(row, activePowerTheme)) continue;
    const key = `${row.state}:${row.postcode}`;
    localThemedEnterpriseMap.set(key, (localThemedEnterpriseMap.get(key) || 0) + 1);
  }

  const stateThemedCommunityOrgMap = new Map<string, number>();
  for (const row of communityOrgSignalsResult.data || []) {
    if (!hasPowerThemeCommunityOrgSignal(row, activePowerTheme)) continue;
    for (const geography of row.geographic_focus || []) {
      const state = geography.replace(/^AU-/, '').trim().toUpperCase();
      if (!VALID_STATE_CODES.has(state)) continue;
      stateThemedCommunityOrgMap.set(state, (stateThemedCommunityOrgMap.get(state) || 0) + 1);
    }
  }

  const justiceCountByState = new Map(justiceStateCounts.map((entry) => [entry.state, entry.count]));

  const matchedCharities = sliceNonZero(
    ((charitiesResult.data || []) as CharityCandidate[])
      .map((charity) => scoreCharityCandidate(charity, charityPurposeSignals, stateSignals))
      .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.total_grants_given || 0) - (a.total_grants_given || 0)),
  );

  const matchedSocialEnterprises = sliceNonZero(
    ((socialEnterprisesResult.data || []) as SocialEnterpriseCandidate[])
      .map((enterprise) => scoreSocialEnterpriseCandidate(enterprise, socialSectorSignals, stateSignals))
      .sort((a, b) => (b.score || 0) - (a.score || 0)),
  );
  const disabilityDeliveryRelevant =
    disabilityThemeActive ||
    matchedCharities.some((charity) => charity.ben_people_with_disabilities) ||
    matchedSocialEnterprises.some((enterprise) => (enterprise.target_beneficiaries || []).includes('people_with_disability'));

  const blindSpots: BlindSpotRow[] = blindSpotRows.map((row) => ({
    ...row,
    locality: postcodeMap.get(row.postcode)?.locality || null,
    lga_name: postcodeMap.get(row.postcode)?.lga_name || null,
  }));

  const ndisStates = (ndisSupplyResult.data || []) as NdisSupplyRow[];
  const ndisDistricts = ((ndisDistrictResult.data || []) as NdisSupplyRow[]).filter(
    (row) => row.service_district_name !== 'Other' && !/missing/i.test(row.service_district_name),
  );
  const ndisConcentrations = ((ndisConcentrationResult.data || []) as NdisConcentrationRow[]).filter(
    (row) => row.service_district_name !== 'Other' && !/missing/i.test(row.service_district_name),
  );
  const concentrationByDistrict = new Map<string, NdisConcentrationRow>();
  for (const row of ndisConcentrations) {
    const key = `${row.state_code}:${row.service_district_name}`;
    const current = concentrationByDistrict.get(key);
    if (!current || (row.payment_share_top10_pct || 0) > (current.payment_share_top10_pct || 0)) {
      concentrationByDistrict.set(key, row);
    }
  }
  const ndisHotspots = ndisDistricts
    .map((row) => {
      const concentration = concentrationByDistrict.get(`${row.state_code}:${row.service_district_name}`);
      const squeeze =
        concentration?.payment_share_top10_pct != null
          ? Number(((concentration.payment_share_top10_pct * 100) / Math.max(row.provider_count, 1)).toFixed(1))
          : null;
      return {
        ...row,
        payment_share_top10_pct: concentration?.payment_share_top10_pct ?? null,
        support_class: concentration?.support_class ?? null,
        payment_band: concentration?.payment_band ?? null,
        squeeze,
      };
    })
    .filter((row) => row.payment_share_top10_pct != null)
    .sort((a, b) => (b.squeeze || 0) - (a.squeeze || 0))
    .slice(0, 6);
  const thinNdisDistrictCount = ndisDistricts.filter((row) => row.provider_count < 100).length;
  const disabilityDeliveryGraphCount =
    (disabilitySocialEnterpriseResult.count || 0) + (disabilityCommunityOrgResult.count || 0);

  const ndisStateStats = new Map<string, { thin: number; veryThin: number; maxCapture: number | null }>();
  for (const state of compactUnique(
    [...ndisDistricts.map((row) => row.state_code), ...ndisHotspots.map((row) => row.state_code)],
    20,
  )) {
    const stateDistricts = ndisDistricts.filter((row) => row.state_code === state);
    const stateHotspots = ndisHotspots.filter((row) => row.state_code === state);
    ndisStateStats.set(state, {
      thin: stateDistricts.filter((row) => row.provider_count < 100).length,
      veryThin: stateDistricts.filter((row) => row.provider_count < 30).length,
      maxCapture: stateHotspots.reduce<number | null>(
        (max, row) => (row.payment_share_top10_pct != null && (max == null || row.payment_share_top10_pct > max) ? row.payment_share_top10_pct : max),
        null,
      ),
    });
  }

  const powerSearchRows = blindSpots
    .map((spot) => {
      const stateStats = ndisStateStats.get(spot.state || '') || { thin: 0, veryThin: 0, maxCapture: null };
      const key = `${spot.state}:${spot.postcode}`;
      return buildPowerSearchRow(
        spot,
        activeLens,
        activePowerTheme,
        stateStats.thin,
        stateStats.veryThin,
        stateStats.maxCapture,
        localCommunityControlledMap.get(key) || 0,
        localThemedEnterpriseMap.get(key) || 0,
        stateThemedCommunityOrgMap.get(spot.state || '') || 0,
        justiceCountByState.get(spot.state || '') || 0,
      );
    })
    .sort((a, b) => b.score - a.score || (a.entity_count || 0) - (b.entity_count || 0))
    .slice(0, 6);

  const availablePowerStates = compactUnique(blindSpots.map((spot) => spot.state), blindSpots.length).filter((value) =>
    VALID_STATE_CODES.has(value),
  );
  const availablePowerThemes: FundingPowerTheme[] = [
    'indigenous_community',
    'youth_justice',
    'housing_homelessness',
    'regional_regenerative',
    'disability_ndis',
  ];

  const activeGrants = savedGrants.filter((grant) => ACTIVE_GRANT_STAGES.includes(grant.stage));
  const activeFoundations = savedFoundations.filter((foundation) => ACTIVE_FOUNDATION_STAGES.includes(foundation.stage));
  const upcomingDeadlines = activeGrants.filter((grant) => {
    if (!grant.grant.closes_at) return false;
    const closesAt = new Date(grant.grant.closes_at);
    const now = new Date();
    return closesAt.getTime() >= now.getTime() && closesAt.getTime() <= now.getTime() + 45 * 24 * 60 * 60 * 1000;
  });

  const nextMoves = [
    ...activeGrants.slice(0, 4).map((grant) => ({
      type: 'Grant',
      name: grant.grant.name,
      href: `/grants/${grant.grant_id}`,
      detail: grantNextMove(grant, profile?.name || orgContext.profile?.name || 'your organisation'),
      meta: `${grantStageLabel(grant.stage)} · ${formatRelativeDate(grant.grant.closes_at)}`,
    })),
    ...savedFoundations.slice(0, 4).map((foundation) => ({
      type: 'Foundation',
      name: foundation.foundation.name,
      href: `/foundations/${foundation.foundation_id}`,
      detail: foundationNextMove(foundation, profile?.name || orgContext.profile?.name || 'your organisation'),
      meta: `${foundationStageLabel(foundation.stage)} · ${foundation.last_contact_date ? `last contact ${formatShortDate(foundation.last_contact_date)}` : 'no contact logged'}`,
    })),
  ].slice(0, 6);

  const profileChecklist = buildProfileChecklist(profile, savedFoundations, matchedCharities, matchedSocialEnterprises);
  const profileReadyCount = profileChecklist.filter((item) => item.done).length;

  return (
    <div className="space-y-8">
      <section className="border-4 border-bauhaus-black bg-bauhaus-black p-6 sm:p-8 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-yellow mb-3">Operating Layer</p>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <h1 className="text-4xl font-black uppercase tracking-tight">Funding Workspace</h1>
            <p className="mt-3 text-white/80 font-medium max-w-3xl">
              One place to move from live grants to philanthropic relationships, delivery partners,
              coverage blind spots, and profile readiness. This is the operating system layer the
              current grants and foundations directories were missing.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/grants"
              className="px-4 py-3 border-2 border-white text-white text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-bauhaus-black transition-colors"
            >
              Search grants
            </Link>
            <Link
              href="/foundations"
              className="px-4 py-3 border-2 border-white text-white text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-bauhaus-black transition-colors"
            >
              Search foundations
            </Link>
            <Link
              href="/profile"
              className="px-4 py-3 border-2 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-colors"
            >
              Update profile
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
          <span className="px-2.5 py-1 border-2 border-white/30 text-white/80">
            {workspaceScope === 'team' ? 'Team working set' : 'Personal working set'}
          </span>
          {profile?.name && (
            <span className="px-2.5 py-1 border-2 border-bauhaus-blue text-bauhaus-blue bg-link-light">
              {profile.name}
            </span>
          )}
          {topThemes.slice(0, 4).map((theme) => (
            <span key={theme} className="px-2.5 py-1 border-2 border-white/20 text-white/70">
              {theme.replace(/_/g, ' ')}
            </span>
          ))}
        </div>

        {workspaceScope === 'personal' && orgContext.orgProfileId && (
          <div className="mt-5 border-2 border-bauhaus-red bg-bauhaus-red/10 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red mb-1">System gap</p>
            <p className="text-sm font-medium text-white/90">
              You have an organisation profile, but no funding records are team-shared yet. The workspace is
              falling back to one person&apos;s saved grants and funders. That is useful for testing, but not yet
              an enterprise operating layer.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-0 md:grid-cols-2 xl:grid-cols-4 border-4 border-bauhaus-black bg-white">
        {[
          { label: 'Tracked grants', value: savedGrants.length, detail: `${upcomingDeadlines.length} deadlines inside 45 days` },
          { label: 'Tracked funders', value: savedFoundations.length, detail: `${activeFoundations.length} relationships beyond cold discovery` },
          { label: 'Delivery leads', value: matchedCharities.length + matchedSocialEnterprises.length, detail: `${matchedCharities.length} charities · ${matchedSocialEnterprises.length} social enterprises` },
          { label: 'Profile readiness', value: `${profileReadyCount}/${profileChecklist.length}`, detail: 'What philanthropy and corporates will want to see' },
        ].map((metric, index) => (
          <div key={metric.label} className={`p-5 ${index > 0 ? 'border-t-4 md:border-t-0 md:border-l-4' : ''} border-bauhaus-black`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{metric.label}</p>
            <div className="mt-3 text-5xl font-black text-bauhaus-black">{metric.value}</div>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted">{metric.detail}</p>
          </div>
        ))}
      </section>

      <section className="border-4 border-bauhaus-black bg-white">
        <div className="border-b-4 border-bauhaus-black bg-bauhaus-yellow px-5 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-black/70 mb-2">Cross-area power search</p>
              <h2 className="text-2xl font-black text-bauhaus-black">Find where money, service power, and community alternatives collide</h2>
              <p className="mt-2 text-sm font-medium text-bauhaus-muted">
                {fundingPowerThemeDescription(activePowerTheme)} Search across grant coverage, philanthropy context,
                NDIS market pressure, and local community-rooted delivery. Justice funding is currently strongest in QLD,
                so the justice lens is most informative there.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['pressure', 'alternatives', 'captured'] as PowerSearchLens[]).map((lens) => (
                <Link
                  key={lens}
                  href={`/funding-workspace?${new URLSearchParams({
                    lens,
                    theme: activePowerTheme,
                    ...(activePowerState ? { state: activePowerState } : {}),
                  }).toString()}`}
                  className={`px-3 py-2 border-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                    activeLens === lens
                      ? 'border-bauhaus-black bg-bauhaus-black text-white'
                      : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black'
                  }`}
                >
                  {powerLensLabel(lens)}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {availablePowerThemes.map((theme) => (
              <Link
                key={theme}
                href={`/funding-workspace?${new URLSearchParams({
                  lens: activeLens,
                  theme,
                  ...(activePowerState ? { state: activePowerState } : {}),
                }).toString()}`}
                className={`px-3 py-2 border-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  activePowerTheme === theme
                    ? 'border-bauhaus-red bg-bauhaus-red text-white'
                    : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black'
                }`}
              >
                {fundingPowerThemeLabel(theme)}
              </Link>
            ))}
          </div>

          {availablePowerStates.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/funding-workspace?${new URLSearchParams({ lens: activeLens, theme: activePowerTheme }).toString()}`}
                className={`px-3 py-2 border-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  !activePowerState
                    ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue'
                    : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black'
                }`}
              >
                All scoped states
              </Link>
              {availablePowerStates.map((state) => (
                <Link
                  key={state}
                  href={`/funding-workspace?${new URLSearchParams({ lens: activeLens, theme: activePowerTheme, state }).toString()}`}
                  className={`px-3 py-2 border-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                    activePowerState === state
                      ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue'
                      : 'border-bauhaus-black/20 text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black'
                  }`}
                >
                  {state}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-0 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="border-b-4 xl:border-b-0 xl:border-r-4 border-bauhaus-black">
            <div className="grid gap-0 md:grid-cols-2 2xl:grid-cols-4 border-b-4 border-bauhaus-black">
              {[
                {
                  label: 'Issue area',
                  value: fundingPowerThemeLabel(activePowerTheme),
                  detail: fundingPowerThemeDescription(activePowerTheme),
                },
                {
                  label: 'Active lens',
                  value: powerLensLabel(activeLens),
                  detail:
                    activeLens === 'pressure'
                      ? `Power pressure in ${fundingPowerThemeLabel(activePowerTheme).toLowerCase()}`
                      : activeLens === 'alternatives'
                        ? `Places where ${powerThemeAlternativeLabel(activePowerTheme).toLowerCase()} are worth backing`
                        : `Places where ${fundingPowerThemeLabel(activePowerTheme).toLowerCase()} power is concentrated`,
                },
                {
                  label: 'Hotspots shown',
                  value: powerSearchRows.length,
                  detail: activePowerState ? `Filtered to ${activePowerState}` : 'Across the current funding footprint',
                },
                {
                  label: 'Justice lens',
                  value: activePowerState === 'QLD' || (!activePowerState && powerSearchRows.some((row) => row.justiceRows > 0)) ? 'Live' : 'Partial',
                  detail: 'Current justice funding layer is strongest in Queensland',
                },
              ].map((metric, index) => (
                <div key={metric.label} className={`p-5 ${index > 0 ? 'border-t-4 md:border-t-0 md:border-l-4' : ''} border-bauhaus-black`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{metric.label}</p>
                  <div className="mt-3 text-3xl font-black text-bauhaus-black">{metric.value}</div>
                  <p className="mt-2 text-sm font-medium text-bauhaus-muted">{metric.detail}</p>
                </div>
              ))}
            </div>
            <div className="divide-y-4 divide-bauhaus-black">
              {powerSearchRows.map((row) => (
                <div key={`${activeLens}-${row.state}-${row.postcode}`} className="p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-2xl">
                      <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                        <span className="px-2 py-1 border-2 border-bauhaus-black text-bauhaus-black">
                          {row.locality || row.postcode} {row.state ? `· ${row.state}` : ''}
                        </span>
                        {row.remoteness && (
                          <span className="px-2 py-1 border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue">
                            {row.remoteness}
                          </span>
                        )}
                        {row.justiceRows > 0 && (
                          <span className="px-2 py-1 border-2 border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red">
                            Justice layer live
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-2xl font-black text-bauhaus-black">
                        {row.lga_name || 'Local funding hotspot'} with {powerLensLabel(activeLens).toLowerCase()}
                      </h3>
                      <p className="mt-2 text-sm font-medium text-bauhaus-muted">
                        {(row.reasons || []).join(' · ')}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/places/${row.postcode}`}
                          className="inline-flex px-3 py-2 border-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
                        >
                          Open place
                        </Link>
                        <Link
                          href="/reports/ndis-market"
                          className="inline-flex px-3 py-2 border-2 border-bauhaus-black/20 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors"
                        >
                          Open NDIS layer
                        </Link>
                        <Link
                          href={`/social-enterprises?${new URLSearchParams({
                            ...(row.state ? { state: row.state } : {}),
                            beneficiaries: 'people_with_disability',
                          }).toString()}`}
                          className="inline-flex px-3 py-2 border-2 border-bauhaus-black/20 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors"
                        >
                          Find alternatives
                        </Link>
                      </div>
                    </div>
                    <div className="min-w-[240px] border-2 border-bauhaus-black p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Search score</p>
                      <div className="mt-3 text-4xl font-black text-bauhaus-black">{row.score.toFixed(1)}</div>
                      <div className="mt-3 space-y-2 text-sm font-medium text-bauhaus-black">
                        <p>{row.stateThinDistrictCount} thin disability districts</p>
                        <p>{row.stateVeryThinDistrictCount} very thin districts</p>
                        <p>{row.stateMaxCapturePct != null ? `${pct(row.stateMaxCapturePct)} top-10 capture` : 'No capture data yet'}</p>
                        <p>{row.localCommunityControlledCount} community-controlled entities</p>
                        <p>{row.localThemedEnterpriseCount} {powerThemeAlternativeLabel(activePowerTheme).toLowerCase()}</p>
                        <p>{row.stateThemedCommunityOrgCount} themed community orgs in-state</p>
                        <p>{row.entity_count ?? 0} funded organisations tracked</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {powerSearchRows.length === 0 && (
                <div className="p-5 text-sm font-medium text-bauhaus-muted">
                  No cross-area hotspots surfaced for this scope yet. Broaden the geography or save more grants and funders first.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="border-b-4 border-bauhaus-black bg-bauhaus-black px-5 py-4 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-yellow mb-2">How to use it</p>
              <h3 className="text-2xl font-black">Search the broken system, not just the directory</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="border-2 border-bauhaus-black px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Pressure points</p>
                <p className="mt-2 text-sm font-medium text-bauhaus-black">
                  Start here when you want to know where money is flowing into a thin or captured {fundingPowerThemeLabel(activePowerTheme).toLowerCase()} market while local funding coverage is weak.
                </p>
              </div>
              <div className="border-2 border-bauhaus-black px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Back alternatives</p>
                <p className="mt-2 text-sm font-medium text-bauhaus-black">
                  Use this when philanthropy, corporates, or commissioners want to support {powerThemeAlternativeLabel(activePowerTheme).toLowerCase()} instead of the same incumbents.
                </p>
              </div>
              <div className="border-2 border-bauhaus-black px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Captured markets</p>
                <p className="mt-2 text-sm font-medium text-bauhaus-black">
                  Use this to spot where concentration and thin supply reinforce each other in {fundingPowerThemeLabel(activePowerTheme).toLowerCase()} work.
                </p>
              </div>
              <div className="border-2 border-bauhaus-red bg-bauhaus-red/5 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">System honesty</p>
                <p className="mt-2 text-sm font-medium text-bauhaus-black">
                  This layer already joins grants, foundations, NDIS supply, and community alternatives. Justice funding is still strongest in QLD,
                  so treat non-QLD justice signals as partial until that dataset broadens.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-red px-5 py-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 mb-2">Next moves</p>
            <h2 className="text-2xl font-black">What needs attention now</h2>
          </div>
          <div className="grid gap-0 md:grid-cols-2">
            {nextMoves.length > 0 ? (
              nextMoves.map((move, index) => (
                <Link
                  key={`${move.type}-${move.name}`}
                  href={move.href}
                  className={`block p-5 ${index > 0 ? 'border-t-4 md:border-t-0 md:border-l-4' : ''} border-bauhaus-black hover:bg-bauhaus-canvas transition-colors`}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{move.type}</p>
                  <h3 className="mt-2 text-lg font-black text-bauhaus-black">{move.name}</h3>
                  <p className="mt-3 text-sm font-medium text-bauhaus-black">{move.detail}</p>
                  <p className="mt-3 text-xs font-black uppercase tracking-widest text-bauhaus-blue">{move.meta}</p>
                </Link>
              ))
            ) : (
              <div className="p-5">
                <p className="text-sm font-medium text-bauhaus-muted">
                  Nothing is in the working set yet. Save grants and foundations first so the workspace can generate real next moves.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-blue px-5 py-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 mb-2">Fundability profile</p>
            <h2 className="text-2xl font-black">What funders will look for</h2>
          </div>
          <div className="p-5 space-y-3">
            {profileChecklist.map((item) => (
              <div key={item.label} className={`border-2 px-4 py-3 ${item.done ? 'border-money bg-money-light/40' : 'border-bauhaus-red bg-bauhaus-red/5'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-bauhaus-black">{item.label}</h3>
                    <p className="mt-1 text-sm font-medium text-bauhaus-muted">{item.detail}</p>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${item.done ? 'text-money' : 'text-bauhaus-red'}`}>
                    {item.done ? 'Ready' : 'Needs work'}
                  </span>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Link
                href="/profile"
                className="inline-flex px-4 py-3 border-2 border-bauhaus-black text-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
              >
                Improve organisation profile
              </Link>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-black px-5 py-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-yellow mb-2">Live opportunities</p>
            <h2 className="text-2xl font-black">Grant pipeline</h2>
          </div>
          <div className="divide-y-4 divide-bauhaus-black">
            {savedGrants.slice(0, 6).map((grant) => (
              <div key={grant.id} className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 border-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                        {grantStageLabel(grant.stage)}
                      </span>
                      {grant.grant.last_verified_at && (
                        <span className="px-2 py-1 border-2 border-bauhaus-blue text-[10px] font-black uppercase tracking-widest text-bauhaus-blue bg-link-light">
                          Verified {formatShortDate(grant.grant.last_verified_at)}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-xl font-black text-bauhaus-black">{grant.grant.name}</h3>
                    <p className="mt-1 text-sm font-medium text-bauhaus-muted">{grant.grant.provider}</p>
                    <p className="mt-3 text-sm font-medium text-bauhaus-black">
                      {grant.notes?.trim() || 'No internal note yet. This is still just a directory record.'}
                    </p>
                  </div>
                  <div className="min-w-[200px] border-2 border-bauhaus-black p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Opportunity snapshot</p>
                    <div className="mt-3 space-y-2 text-sm font-medium text-bauhaus-black">
                      <p>{formatCurrency(grant.grant.amount_max || grant.grant.amount_min)}</p>
                      <p>{grant.grant.closes_at ? `Closes ${formatShortDate(grant.grant.closes_at)} (${formatRelativeDate(grant.grant.closes_at)})` : 'Ongoing / no deadline'}</p>
                      <p>{compactUnique([...(grant.grant.categories || []), ...(grant.grant.focus_areas || [])], 3).join(' · ') || 'No tagged focus areas'}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/grants/${grant.grant_id}`} className="inline-flex px-3 py-2 border-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors">
                        Open grant
                      </Link>
                      <Link href="/tracker" className="inline-flex px-3 py-2 border-2 border-bauhaus-black/20 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
                        Open tracker
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {savedGrants.length === 0 && (
              <div className="p-5">
                <p className="text-sm font-medium text-bauhaus-muted">
                  No grants are saved yet. Search live opportunities first, then bring the real working set back here.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-yellow px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-black/70 mb-2">Relationship pipeline</p>
            <h2 className="text-2xl font-black text-bauhaus-black">Foundation and funder coverage</h2>
          </div>
          <div className="divide-y-4 divide-bauhaus-black">
            {savedFoundations.slice(0, 6).map((foundation) => (
              <div key={foundation.id} className="p-5">
                {(() => {
                  const plausibility = philanthropyPlausibility(foundation, topThemes, stateSignals);
                  const power = foundationPowerMap.get(foundation.foundation_id);
                  return (
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 border-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                        {foundationStageLabel(foundation.stage)}
                      </span>
                      <span className={`px-2 py-1 border-2 text-[10px] font-black uppercase tracking-widest ${confidenceBadge(foundation.foundation.profile_confidence)}`}>
                        {foundation.foundation.profile_confidence || 'low'} confidence
                      </span>
                      {power && (
                        <>
                          <span className={`px-2 py-1 border-2 text-[10px] font-black uppercase tracking-widest ${
                            power.reportable_in_power_map
                              ? 'border-bauhaus-black bg-bauhaus-black text-white'
                              : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                          }`}>
                            {power.reportable_in_power_map ? 'Capital holder' : 'Operator'}
                          </span>
                          <span className={`px-2 py-1 border-2 text-[10px] font-black uppercase tracking-widest ${
                            (power.openness_score || 0) >= 0.6
                              ? 'border-money bg-money-light text-money'
                              : (power.gatekeeping_score || 0) >= 0.45
                                ? 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red'
                                : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                          }`}>
                            {opennessLabel(power.openness_score)}
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-3 text-xl font-black text-bauhaus-black">{foundation.foundation.name}</h3>
                    <p className="mt-1 text-sm font-medium text-bauhaus-muted">
                      {formatCurrency(foundation.foundation.total_giving_annual)} annual giving
                    </p>
                    <p className="mt-3 text-sm font-medium text-bauhaus-black">
                      {foundation.notes?.trim() || 'No relationship note yet. This funder is still a cold record.'}
                    </p>
                    {plausibility.reasons.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                        {plausibility.reasons.map((reason) => (
                          <span key={reason} className="px-2 py-1 border-2 border-bauhaus-black/15 text-bauhaus-muted bg-bauhaus-canvas">
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="min-w-[220px] border-2 border-bauhaus-black p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Funder fit signals</p>
                    <div className="mt-3 space-y-2 text-sm font-medium text-bauhaus-black">
                      <p>Philanthropy plausibility {plausibility.score.toFixed(1)}/10</p>
                      {power && <p>{powerClassLabel(power.capital_holder_class)} · {powerClassLabel(power.capital_source_class)}</p>}
                      <p>{compactUnique(foundation.foundation.thematic_focus || [], 3).join(' · ') || 'No focus tags'}</p>
                      <p>{compactUnique(foundation.foundation.geographic_focus || [], 2).join(' · ') || 'No geography tags'}</p>
                      <p>
                        {foundation.foundation.avg_grant_size || foundation.foundation.grant_range_min || foundation.foundation.grant_range_max
                          ? `Typical ask ${formatCurrency(foundation.foundation.avg_grant_size || foundation.foundation.grant_range_max || foundation.foundation.grant_range_min)}`
                          : 'Grant-size discipline not yet mapped'}
                      </p>
                      {power && power.reportable_in_power_map && (
                        <p>Gatekeeping pressure {Math.round((power.gatekeeping_score || 0) * 100)}%</p>
                      )}
                      <p>{foundation.last_contact_date ? `Last contact ${formatShortDate(foundation.last_contact_date)}` : 'No contact logged'}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/foundations/${foundation.foundation_id}`} className="inline-flex px-3 py-2 border-2 border-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors">
                        Open foundation
                      </Link>
                      <Link href="/foundations/tracker" className="inline-flex px-3 py-2 border-2 border-bauhaus-black/20 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
                        Open tracker
                      </Link>
                    </div>
                  </div>
                </div>
                  );
                })()}
              </div>
            ))}
            {savedFoundations.length === 0 && (
              <div className="p-5">
                <p className="text-sm font-medium text-bauhaus-muted">
                  No foundations are saved yet. Search funders, then bring the real relationship pipeline back here.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-blue px-5 py-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 mb-2">Delivery ecosystem</p>
            <h2 className="text-2xl font-black">Who could actually do the work</h2>
          </div>
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="border-b-4 lg:border-b-0 lg:border-r-4 border-bauhaus-black">
              <div className="p-5 border-b-2 border-bauhaus-black">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Charities</p>
                <p className="mt-2 text-sm font-medium text-bauhaus-muted">
                  Use this to see who is already operating in the causes and places your funding thesis touches.
                </p>
              </div>
              <div className="divide-y-2 divide-bauhaus-black/10">
                {matchedCharities.map((charity) => (
                  <Link key={charity.abn} href={`/charities/${charity.abn}`} className="block p-5 hover:bg-bauhaus-canvas transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-bauhaus-black">{charity.name}</h3>
                        <p className="mt-1 text-sm font-medium text-bauhaus-muted">
                          {(charity.reasons || []).join(' · ') || 'Relevant operating organisation'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-bauhaus-black">{charity.score}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">match</p>
                        <p className="mt-2 text-xs font-black uppercase tracking-widest text-bauhaus-blue">
                          readiness {charity.readinessScore?.toFixed(1) || '0.0'}/6
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                      {charity.beneficiaries?.includes('First Nations') && (
                        <span className="px-2 py-1 border-2 border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red">First Nations</span>
                      )}
                      {charity.pbi && (
                        <span className="px-2 py-1 border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue">PBI</span>
                      )}
                      {charity.hpc && (
                        <span className="px-2 py-1 border-2 border-money bg-money-light text-money">HPC</span>
                      )}
                      {charity.ben_rural_regional_remote && (
                        <span className="px-2 py-1 border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue">Regional / remote</span>
                      )}
                      {charity.total_grants_given && charity.total_grants_given > 0 && (
                        <span className="px-2 py-1 border-2 border-bauhaus-black text-bauhaus-black">Grant history</span>
                      )}
                    </div>
                  </Link>
                ))}
                {matchedCharities.length === 0 && (
                  <div className="p-5 text-sm font-medium text-bauhaus-muted">
                    No clear charity matches yet. That means the current funding thesis is too loose or the sector view needs expanding.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="p-5 border-b-2 border-bauhaus-black">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Social enterprises</p>
                <p className="mt-2 text-sm font-medium text-bauhaus-muted">
                  Pressure-test whether delivery could happen through Indigenous business, community enterprise, or market-based partners.
                </p>
              </div>
              <div className="divide-y-2 divide-bauhaus-black/10">
                {matchedSocialEnterprises.map((enterprise) => (
                  <Link key={enterprise.id} href={`/social-enterprises/${enterprise.id}`} className="block p-5 hover:bg-bauhaus-canvas transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-bauhaus-black">{enterprise.name}</h3>
                        <p className="mt-1 text-sm font-medium text-bauhaus-muted">
                          {(enterprise.reasons || []).join(' · ') || 'Relevant market-facing delivery partner'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-bauhaus-black">{enterprise.score}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">match</p>
                        <p className="mt-2 text-xs font-black uppercase tracking-widest text-bauhaus-blue">
                          readiness {enterprise.readinessScore?.toFixed(1) || '0.0'}/6
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                      <span className="px-2 py-1 border-2 border-bauhaus-black text-bauhaus-black">{enterprise.org_type.replace(/_/g, ' ')}</span>
                      {enterprise.source_primary && (
                        <span className="px-2 py-1 border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue">{enterprise.source_primary}</span>
                      )}
                      {enterprise.business_model && (
                        <span className="px-2 py-1 border-2 border-money bg-money-light text-money">Model mapped</span>
                      )}
                      {(enterprise.certifications || []).length > 0 && (
                        <span className="px-2 py-1 border-2 border-bauhaus-black text-bauhaus-black">{(enterprise.certifications || []).length} certs</span>
                      )}
                    </div>
                  </Link>
                ))}
                {matchedSocialEnterprises.length === 0 && (
                  <div className="p-5 text-sm font-medium text-bauhaus-muted">
                    No strong social enterprise matches yet. Search the broader directory before assuming charity is the only delivery model.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-red px-5 py-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 mb-2">Need-first lens</p>
            <h2 className="text-2xl font-black">Coverage blind spots</h2>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm font-medium text-bauhaus-muted">
              These are not the places with the highest measured need. They are the places in your current geography
              footprint where recorded funding coverage looks thin, so you should inspect them before chasing the loudest opportunity.
            </p>
            <div className="space-y-3">
              {blindSpots.map((spot) => (
                <Link
                  key={spot.postcode}
                  href={`/places/${spot.postcode}`}
                  className="block border-2 border-bauhaus-black px-4 py-3 hover:bg-bauhaus-canvas transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-bauhaus-black">
                        {spot.locality || spot.postcode} {spot.state ? `· ${spot.state}` : ''}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-bauhaus-muted">
                        {spot.lga_name || 'Local place'} · {spot.remoteness || 'Unknown remoteness'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-bauhaus-black">{spot.entity_count ?? 0} funded orgs</p>
                      <p className="text-sm font-medium text-bauhaus-muted">{formatCurrency(spot.total_funding)} tracked</p>
                    </div>
                  </div>
                </Link>
              ))}
              {blindSpots.length === 0 && (
                <div className="text-sm font-medium text-bauhaus-muted">
                  No clear blind spots surfaced for the current geography footprint yet. Open the place explorer to widen the scan.
                </div>
              )}
            </div>
            <div className="pt-2">
              <Link
                href="/places"
                className="inline-flex px-4 py-3 border-2 border-bauhaus-black text-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
              >
                Open place coverage explorer
              </Link>
            </div>
          </div>
        </section>
      </div>

      {disabilityDeliveryRelevant && (
        <section className="border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-yellow px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-black/70 mb-2">Disability market layer</p>
            <h2 className="text-2xl font-black text-bauhaus-black">NDIS supply and capture pressure</h2>
          </div>
          <div className="grid gap-0 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b-4 xl:border-b-0 xl:border-r-4 border-bauhaus-black">
              <div className="grid gap-0 md:grid-cols-3 border-b-4 border-bauhaus-black">
                {[
                  {
                    label: 'Active providers',
                    value: ndisStates.reduce((sum, row) => sum + row.provider_count, 0).toLocaleString('en-AU'),
                    detail: `${ndisStates.length} scoped states`,
                  },
                  {
                    label: 'Thin districts',
                    value: thinNdisDistrictCount.toLocaleString('en-AU'),
                    detail: 'Under 100 providers',
                  },
                  {
                    label: 'Delivery graph',
                    value: disabilityDeliveryGraphCount.toLocaleString('en-AU'),
                    detail: `${disabilitySocialEnterpriseResult.count || 0} enterprises · ${disabilityCommunityOrgResult.count || 0} orgs`,
                  },
                ].map((metric, index) => (
                  <div key={metric.label} className={`p-5 ${index > 0 ? 'border-t-4 md:border-t-0 md:border-l-4' : ''} border-bauhaus-black`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{metric.label}</p>
                    <div className="mt-3 text-4xl font-black text-bauhaus-black">{metric.value}</div>
                    <p className="mt-2 text-sm font-medium text-bauhaus-muted">{metric.detail}</p>
                  </div>
                ))}
              </div>
              <div className="p-5">
                <p className="text-sm font-medium text-bauhaus-muted mb-4">
                  If this funding thesis touches disability, care, or support work, do not stop at grant categories.
                  Pressure-test whether the service market is already thin or captured before backing another incumbent.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/reports/ndis-market" className="inline-flex px-4 py-3 border-2 border-bauhaus-black text-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors">
                    Open NDIS market report
                  </Link>
                  <Link href="/reports/youth-justice" className="inline-flex px-4 py-3 border-2 border-bauhaus-black/20 text-bauhaus-muted text-[10px] font-black uppercase tracking-widest hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
                    Compare with youth justice
                  </Link>
                  <Link href="/places" className="inline-flex px-4 py-3 border-2 border-bauhaus-black/20 text-bauhaus-muted text-[10px] font-black uppercase tracking-widest hover:border-bauhaus-black hover:text-bauhaus-black transition-colors">
                    Open place coverage
                  </Link>
                </div>
              </div>
            </div>
            <div className="grid gap-0 md:grid-cols-2">
              <div className="border-b-4 md:border-b-0 md:border-r-4 border-bauhaus-black">
                <div className="p-5 border-b-2 border-bauhaus-black">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Thin supply</p>
                  <p className="mt-2 text-sm font-medium text-bauhaus-muted">Districts where provider coverage drops away first.</p>
                </div>
                <div className="divide-y-2 divide-bauhaus-black/10">
                  {ndisDistricts.slice(0, 6).map((row) => (
                    <div key={`${row.state_code}-${row.service_district_name}`} className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-bauhaus-black">{row.service_district_name}</h3>
                          <p className="mt-1 text-sm font-medium text-bauhaus-muted">{row.state_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-bauhaus-black">{row.provider_count.toLocaleString('en-AU')}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">providers</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="p-5 border-b-2 border-bauhaus-black">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Captured markets</p>
                  <p className="mt-2 text-sm font-medium text-bauhaus-muted">Places where thin supply and concentrated payments reinforce each other.</p>
                </div>
                <div className="divide-y-2 divide-bauhaus-black/10">
                  {ndisHotspots.slice(0, 6).map((row) => (
                    <div key={`${row.state_code}-${row.service_district_name}-hotspot`} className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-bauhaus-black">{row.service_district_name}</h3>
                          <p className="mt-1 text-sm font-medium text-bauhaus-muted">
                            {row.state_code} · {row.support_class || 'Core'} · {row.payment_band || 'band unknown'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-bauhaus-red">{pct(row.payment_share_top10_pct)}</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">top 10 share</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {ndisHotspots.length === 0 && (
                    <div className="p-5 text-sm font-medium text-bauhaus-muted">
                      No concentrated disability markets surfaced for the current state lens yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
