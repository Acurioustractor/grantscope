import { createHash } from 'node:crypto';

export const FUNDING_PROFILE_COMPILER_VERSION = 'portfolio-v1';

export interface FundingProfileCompilerOrg {
  id: string;
  name: string;
  abn: string | null;
  additional_abns: string[] | null;
  org_type: string | null;
  org_status: string | null;
  auspice_org_name: string | null;
  geographic_focus: string[] | null;
}

export interface FundingProfileCompilerProject {
  id: string;
  org_profile_id?: string;
  parent_project_id?: string | null;
  code: string | null;
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  abn?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExistingFundingProfile {
  profile_version: string;
  completeness_status: 'baseline' | 'partial' | 'decision_ready';
  profile: Record<string, unknown>;
  provenance?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function unique(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex').slice(0, 12);
}

const FUNDING_METADATA_KEYS = [
  'aliases',
  'profile_summary',
  'funding_brief',
  'funding_tags',
  'proof_points',
  'required_grant_terms',
  'blocked_grant_terms',
  'pillar',
  'strategic_priority',
  'community_controlled',
  'cultural_authority',
  'product',
  'heritage',
  'creative',
] as const;

function relevantMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    FUNDING_METADATA_KEYS.flatMap(key => key in metadata ? [[key, metadata[key]]] : [])
  );
}

export function fundingProfileSourceHash(
  org: FundingProfileCompilerOrg,
  project: FundingProfileCompilerProject,
) {
  return hash({
    org: {
      id: org.id,
      name: org.name,
      abn: org.abn,
      additionalAbns: org.additional_abns,
      orgType: org.org_type,
      orgStatus: org.org_status,
      auspiceOrgName: org.auspice_org_name,
      geographicFocus: org.geographic_focus,
    },
    project: {
      id: project.id,
      code: project.code,
      name: project.name,
      slug: project.slug,
      description: project.description,
      category: project.category,
      parentProjectId: project.parent_project_id,
      status: project.status,
      abn: project.abn,
      metadata: relevantMetadata(asRecord(project.metadata)),
    },
  });
}

export function isFundingProfileCompiled(
  profile: Record<string, unknown>,
  org: FundingProfileCompilerOrg,
  project: FundingProfileCompilerProject,
) {
  const system = asRecord(profile._system);
  return system.compilerVersion === FUNDING_PROFILE_COMPILER_VERSION
    && system.sourceHash === fundingProfileSourceHash(org, project);
}

function baselineProfile(project: FundingProfileCompilerProject) {
  return {
    schemaVersion: 'project-funding-profile-v1',
    identity: {
      orgProjectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      slug: project.slug,
      aliases: [],
      category: project.category || null,
      parentProjectId: project.parent_project_id || null,
    },
    purpose: {
      publicSummary: project.description || null,
      outcomes: [],
      maturity: project.status || 'active',
    },
    entities: [],
    partnerPathways: [],
    geographies: [],
    beneficiaries: [],
    evidence: [],
    fundingNeed: { currency: 'AUD', amountMin: null, amountMax: null, blocks: [] },
    acceptedInstruments: [],
    constraints: [],
    relationships: [],
    unresolvedDecisions: [
      'Confirm applicant and contracting entities.',
      'Confirm delivery places and eligible geographies.',
      'Define costed funding blocks and acceptable instruments.',
      'Attach evidence for outcomes, authority and community benefit.',
    ],
  };
}

function completeness(profile: Record<string, unknown>) {
  const fundingNeed = asRecord(profile.fundingNeed);
  const hasEntities = asArray(profile.entities).length > 0;
  const hasBlocks = asArray(fundingNeed.blocks).length > 0;
  const hasGeographies = asArray(profile.geographies).length > 0;
  const hasEvidence = asArray(profile.evidence).length > 0;
  const unresolved = asArray(profile.unresolvedDecisions).length;
  if (hasEntities && hasBlocks && hasGeographies && hasEvidence && unresolved === 0) return 'decision_ready' as const;
  if (hasEntities || hasBlocks || hasGeographies || hasEvidence) return 'partial' as const;
  return 'baseline' as const;
}

export function fundingProfileText(profile: Record<string, unknown>) {
  const identity = asRecord(profile.identity);
  const purpose = asRecord(profile.purpose);
  const fundingNeed = asRecord(profile.fundingNeed);
  const searchContext = asRecord(profile.searchContext);
  return [
    asString(identity.projectName),
    ...asStringArray(identity.aliases),
    asString(purpose.publicSummary),
    ...asStringArray(purpose.outcomes),
    ...asStringArray(profile.themes),
    asString(searchContext.fundingBrief),
    ...asStringArray(searchContext.fundingTags),
    ...asStringArray(searchContext.proofPoints),
    ...asStringArray(searchContext.requiredGrantTerms),
    ...asStringArray(profile.geographies),
    ...asStringArray(profile.beneficiaries),
    ...asStringArray(profile.acceptedInstruments),
    ...asArray(fundingNeed.blocks).flatMap(block => {
      const row = asRecord(block);
      return [asString(row.label), ...asStringArray(row.keywords)];
    }),
  ].filter((value): value is string => Boolean(value)).join('\n').slice(0, 8000);
}

export function compileFundingProfile(input: {
  org: FundingProfileCompilerOrg;
  project: FundingProfileCompilerProject;
  existing?: ExistingFundingProfile;
}) {
  const { org, project, existing } = input;
  if (!project.code) throw new Error(`${project.name} needs a canonical project code`);
  const metadata = asRecord(project.metadata);
  const current: Record<string, unknown> = existing?.profile || baselineProfile(project);
  const currentIdentity = asRecord(current.identity);
  const currentPurpose = asRecord(current.purpose);
  const currentSearchContext = asRecord(current.searchContext);
  const canonicalSummary = asString(metadata.profile_summary);
  const existingSummary = asString(currentPurpose.publicSummary);
  const publicSummary = (!existing || existing.completeness_status === 'baseline') && canonicalSummary
    ? canonicalSummary
    : existingSummary || canonicalSummary || project.description || null;
  const aliases = unique([
    ...asStringArray(currentIdentity.aliases),
    ...asStringArray(metadata.aliases),
  ]);

  const sourceHash = fundingProfileSourceHash(org, project);
  const profile: Record<string, unknown> = {
    ...current,
    schemaVersion: 'project-funding-profile-v1',
    identity: {
      ...currentIdentity,
      orgProjectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      slug: project.slug,
      aliases,
      category: project.category || null,
      parentProjectId: project.parent_project_id || null,
    },
    purpose: {
      ...currentPurpose,
      publicSummary,
      outcomes: asStringArray(currentPurpose.outcomes),
      maturity: project.status || 'active',
    },
    entities: asArray(current.entities),
    partnerPathways: asArray(current.partnerPathways),
    geographies: asStringArray(current.geographies),
    beneficiaries: asStringArray(current.beneficiaries),
    evidence: asArray(current.evidence),
    fundingNeed: {
      currency: 'AUD',
      amountMin: null,
      amountMax: null,
      ...asRecord(current.fundingNeed),
      blocks: asArray(asRecord(current.fundingNeed).blocks),
    },
    acceptedInstruments: asStringArray(current.acceptedInstruments),
    constraints: asStringArray(current.constraints),
    relationships: asArray(current.relationships),
    unresolvedDecisions: asStringArray(current.unresolvedDecisions),
    themes: unique([...asStringArray(current.themes), ...asStringArray(metadata.funding_tags)]),
    organisationContext: {
      orgProfileId: org.id,
      name: org.name,
      abn: org.abn,
      additionalAbns: org.additional_abns || [],
      orgType: org.org_type,
      orgStatus: org.org_status,
      auspiceOrgName: org.auspice_org_name,
      geographicFocus: org.geographic_focus || [],
      projectAbn: project.abn || null,
      applicantRouteStatus: 'requires_project_decision',
    },
    searchContext: {
      ...currentSearchContext,
      fundingBrief: asString(metadata.funding_brief) || asString(currentSearchContext.fundingBrief),
      fundingTags: asStringArray(metadata.funding_tags).length
        ? asStringArray(metadata.funding_tags)
        : asStringArray(currentSearchContext.fundingTags),
      proofPoints: asStringArray(metadata.proof_points).length
        ? asStringArray(metadata.proof_points)
        : asStringArray(currentSearchContext.proofPoints),
      requiredGrantTerms: asStringArray(metadata.required_grant_terms).length
        ? asStringArray(metadata.required_grant_terms)
        : asStringArray(currentSearchContext.requiredGrantTerms),
      blockedGrantTerms: asStringArray(metadata.blocked_grant_terms).length
        ? asStringArray(metadata.blocked_grant_terms)
        : asStringArray(currentSearchContext.blockedGrantTerms),
    },
    _system: {
      compilerVersion: FUNDING_PROFILE_COMPILER_VERSION,
      sourceHash,
      ownership: {
        canonicalFacts: 'Supabase',
        operations: 'GHL',
        writing: 'Notion',
        discovery: 'GrantScope',
      },
    },
  };
  const profileVersion = `${project.code.toLowerCase()}-${hash(profile)}`;
  const previousProvenance = (Array.isArray(existing?.provenance) ? existing.provenance : []).filter(item => {
    const row = asRecord(item);
    return !(row.type === 'table' && ['org_profiles', 'org_projects'].includes(String(row.table || '')));
  });
  return {
    org_project_id: project.id,
    org_profile_id: project.org_profile_id || org.id,
    schema_version: 'project-funding-profile-v1',
    profile_version: profileVersion,
    completeness_status: completeness(profile),
    profile,
    embedding_text: fundingProfileText(profile),
    provenance: [
      ...previousProvenance,
      { type: 'table', table: 'org_profiles', id: org.id },
      { type: 'table', table: 'org_projects', id: project.id, sourceHash },
    ],
    created_by: 'funding-profile-compiler',
    is_current: true,
  };
}
