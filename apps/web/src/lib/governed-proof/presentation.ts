import type { GovernedProofBundle } from './contracts';

type JsonObject = Record<string, unknown>;

export type DerivedProofPack = {
  headline: string;
  readiness: string;
  capitalStory: string;
  evidenceStory: string;
  voiceStory: string;
  fundingSnapshot: JsonObject;
  evidenceSnapshot: JsonObject;
  voiceSnapshot: JsonObject;
  strengths: string[];
  gaps: string[];
};

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function compactCurrency(value: number | null): string {
  if (value == null) return 'Unknown funding';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    notation: value >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function compactWhole(value: number | null): string {
  if (value == null) return '0';
  return new Intl.NumberFormat('en-AU', {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function themeLabel(theme: unknown): string | null {
  if (typeof theme === 'string' && theme.trim().length > 0) return theme.trim();
  if (theme && typeof theme === 'object' && !Array.isArray(theme)) {
    const name = (theme as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim().length > 0) return name.trim();
  }
  return null;
}

export function getProofPack(bundle: GovernedProofBundle): DerivedProofPack {
  const existing = asObject(bundle.outputContext?.proofPack);
  if (Object.keys(existing).length > 0) {
    return {
      headline: asString(existing.headline) ?? `A governed proof summary for postcode ${bundle.subjectId}.`,
      readiness: asString(existing.readiness) ?? 'in_progress',
      capitalStory: asString(existing.capitalStory) ?? 'Capital context is still being assembled.',
      evidenceStory: asString(existing.evidenceStory) ?? 'Evidence context is still being assembled.',
      voiceStory: asString(existing.voiceStory) ?? 'Voice context is still being assembled.',
      fundingSnapshot: asObject(existing.fundingSnapshot),
      evidenceSnapshot: asObject(existing.evidenceSnapshot),
      voiceSnapshot: asObject(existing.voiceSnapshot),
      strengths: asArray(existing.strengths).map(String),
      gaps: asArray(existing.gaps).map(String),
    };
  }

  const capitalContext = asObject(bundle.capitalContext);
  const evidenceContext = asObject(bundle.evidenceContext);
  const voiceContext = asObject(bundle.voiceContext);
  const governanceContext = asObject(bundle.governanceContext);

  const fundingSummaries = asArray(capitalContext.fundingSummaries).map(asObject);
  const fundingByPostcode =
    asObject(capitalContext.fundingByPostcode).postcode ? asObject(capitalContext.fundingByPostcode) : fundingSummaries[0] ?? {};
  const entitySamples = asArray(capitalContext.entitySamples).map(asObject);
  const interventions = asArray(evidenceContext.interventions).map(asObject);
  const organizations = asArray(evidenceContext.organizations).map(asObject);
  const stories = asArray(voiceContext.stories).map(asObject);
  const storytellers = asArray(voiceContext.storytellers).map(asObject);
  const linkedVoiceOrganizations = asArray(voiceContext.linkedOrganizations).map(asObject);

  const totalFunding = asNumber(fundingByPostcode.total_funding);
  const locality = asString(fundingByPostcode.locality);
  const remoteness = asString(fundingByPostcode.remoteness);
  const entityCount =
    asNumber(fundingByPostcode.entity_count) ??
    (entitySamples.length > 0 ? entitySamples.length : null);
  const relationshipCount = asNumber(fundingByPostcode.relationship_count);
  const communityControlledFunding = asNumber(fundingByPostcode.community_controlled_funding);
  const communityControlledCount = asNumber(fundingByPostcode.community_controlled_count);
  const seifaDecile = asNumber(fundingByPostcode.seifa_irsd_decile);

  const dominantThemes = Array.from(
    new Set(
      stories
        .flatMap((story) => asArray(story.themes))
        .map(themeLabel)
        .filter((value): value is string => Boolean(value))
    )
  ).slice(0, 6);

  const sampleStoryTitles = stories
    .map((story) => asString(story.title))
    .filter((value): value is string => Boolean(value))
    .slice(0, 4);

  const topOrganizationNames = organizations
    .map((organization) => asString(organization.name))
    .filter((value): value is string => Boolean(value))
    .slice(0, 4);

  const publishability =
    asString(governanceContext.publishability) ?? (stories.length > 0 ? 'partner' : 'internal');

  const strengths: string[] = [];
  const gaps: string[] = [];

  if (totalFunding != null && totalFunding > 0) {
    strengths.push(`${compactCurrency(totalFunding)} traced into postcode ${bundle.subjectId}`);
  } else {
    gaps.push('Capital flow is still thin or unresolved for this place');
  }

  if (organizations.length > 0 || interventions.length > 0) {
    strengths.push(
      `${organizations.length} organizations and ${interventions.length} interventions are linked through JusticeHub`
    );
  } else {
    gaps.push('JusticeHub evidence links are still thin');
  }

  if (stories.length > 0) {
    strengths.push(
      `${stories.length} governed stories from ${storytellers.length} storytellers are available for proof`
    );
  } else {
    gaps.push('No publishable community stories are attached yet');
  }

  if (linkedVoiceOrganizations.length === 0) {
    gaps.push('No voice organizations are linked from Empathy Ledger yet');
  }

  const readiness =
    totalFunding && interventions.length > 0 && stories.length > 0
      ? 'decision_ready'
      : stories.length > 0 && interventions.length > 0
        ? 'proof_ready_needs_capital_depth'
        : stories.length > 0
          ? 'voice_present_needs_linking'
          : interventions.length > 0
            ? 'evidence_present_needs_voice'
            : 'capital_only';

  return {
    headline:
      locality
        ? `${locality} ${bundle.subjectId}: ${compactCurrency(totalFunding)} linked to ${compactWhole(entityCount)} entities, ${stories.length} governed stories, and ${interventions.length} interventions.`
        : `Postcode ${bundle.subjectId}: ${compactCurrency(totalFunding)} linked to ${compactWhole(entityCount)} entities, ${stories.length} governed stories, and ${interventions.length} interventions.`,
    readiness,
    capitalStory:
      totalFunding != null
        ? `${compactCurrency(totalFunding)} is visible in the capital layer across ${compactWhole(entityCount)} mapped entities${relationshipCount != null ? ` and ${compactWhole(relationshipCount)} funding relationships` : ''}.`
        : 'Capital context is still thin for this place.',
    evidenceStory:
      organizations.length > 0 || interventions.length > 0
        ? `${organizations.length} organizations and ${interventions.length} interventions are currently linked in JusticeHub.`
        : 'No JusticeHub organizations are linked to this place yet.',
    voiceStory:
      stories.length > 0
        ? `${stories.length} governed stories from ${storytellers.length} storytellers are currently available under ${publishability} promotion settings.`
        : 'Community voice exists only as restricted or not-yet-linked material.',
    fundingSnapshot: {
      locality,
      remoteness,
      seifaDecile,
      totalFunding,
      communityControlledFunding,
      entityCount,
      communityControlledCount,
      relationshipCount,
    },
    evidenceSnapshot: {
      organizationCount: organizations.length,
      interventionCount: interventions.length,
      topOrganizationNames,
    },
    voiceSnapshot: {
      linkedOrganizationCount: linkedVoiceOrganizations.length,
      publishableStoryCount: stories.length,
      storytellerCount: storytellers.length,
      dominantThemes,
      sampleStoryTitles,
    },
    strengths,
    gaps,
  };
}
