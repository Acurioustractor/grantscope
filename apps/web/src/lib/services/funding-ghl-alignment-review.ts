import { randomUUID } from 'node:crypto';
import { applyFundingNotionProjectRelations } from '@/lib/services/funding-ghl-alignment';
import { runFundingGhlAlignment } from '@/lib/services/funding-ghl-alignment';
import { getServiceSupabase } from '@/lib/supabase';

type CandidateRow = {
  ghl_opportunity_id: string;
  ghl_opportunity_name: string;
  classification: string;
  notion_funding_page_url: string | null;
  evidence: Record<string, unknown> | null;
};

type OpportunityRow = {
  ghl_id: string;
  ghl_contact_id: string | null;
};

type ContactRow = {
  ghl_id: string;
  full_name: string | null;
  company_name: string | null;
  tags: string[] | null;
  projects: string[] | null;
};

type ProjectRow = {
  code: string;
  name: string;
  slug: string;
  description: string | null;
};

type ProjectProfileRow = {
  project_code: string;
  project_label: string | null;
  theme_keywords: string[] | null;
};

type RecommendationRow = {
  opportunity_name: string;
  project_code: string;
  fit_score: number | null;
  is_strong_fit: boolean | null;
};

type Signal = {
  source: 'notion_collision' | 'contact_project' | 'contact_tag' | 'contact_history' | 'explicit_name' | 'theme' | 'grantscope';
  weight: number;
  detail: string;
};

export type FundingAlignmentSuggestion = {
  projectCode: string;
  projectName: string;
  confidence: number;
  verdict: 'recommended' | 'possible';
  evidence: Signal[];
};

export type FundingAlignmentReviewItem = {
  ghlOpportunityId: string;
  opportunityName: string;
  classification: string;
  notionUrl: string | null;
  contact: {
    name: string | null;
    company: string | null;
    tags: string[];
    projects: string[];
  } | null;
  suggestions: FundingAlignmentSuggestion[];
  recommendation: 'recommended' | 'ambiguous' | 'none';
};

const GENERIC_THEMES = new Set([
  'aboriginal',
  'arts',
  'community',
  'community-led',
  'cultural',
  'enterprise',
  'first nations',
  'grant',
  'indigenous',
  'infrastructure',
  'place',
  'place-based',
  'regional',
  'research',
  'support',
  'youth',
]);

function normalized(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function includesPhrase(text: string, phrase: string): boolean {
  const normalizedText = ` ${normalized(text)} `;
  const normalizedPhrase = normalized(phrase);
  return Boolean(normalizedPhrase && normalizedText.includes(` ${normalizedPhrase} `));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map(item => item.trim()).filter(Boolean) : [];
}

function projectAliases(project: ProjectRow, profile: ProjectProfileRow | undefined): string[] {
  return [...new Set([
    project.code,
    project.code.replace(/^ACT-/, ''),
    project.name,
    project.slug,
    profile?.project_label || '',
  ].map(normalized).filter(alias => alias.length >= 3))];
}

function addSignal(
  signals: Map<string, Signal[]>,
  projectCode: string | null | undefined,
  signal: Signal,
  projects: Map<string, ProjectRow>
) {
  if (!projectCode || !projects.has(projectCode)) return;
  const existing = signals.get(projectCode) || [];
  if (!existing.some(item => item.source === signal.source && item.detail === signal.detail)) {
    existing.push(signal);
    signals.set(projectCode, existing);
  }
}

function resolveProjectCode(
  value: string,
  aliasesByCode: Map<string, string[]>
): string | null {
  const target = normalized(value);
  if (!target) return null;
  const matches = [...aliasesByCode.entries()]
    .filter(([, aliases]) => aliases.includes(target))
    .map(([code]) => code);
  return matches.length === 1 ? matches[0] : null;
}

function collisionProjectCodes(evidence: Record<string, unknown> | null): string[] {
  const collisions = Array.isArray(evidence?.titleCollisions) ? evidence.titleCollisions : [];
  return [...new Set(collisions.flatMap(collision => {
    if (!collision || typeof collision !== 'object') return [];
    const row = collision as { projectCodes?: unknown; relatedProjects?: unknown };
    const direct = stringArray(row.projectCodes);
    const related = Array.isArray(row.relatedProjects)
      ? row.relatedProjects.flatMap(project => {
        if (!project || typeof project !== 'object') return [];
        const code = (project as { code?: unknown }).code;
        return typeof code === 'string' && code.trim() ? [code.trim()] : [];
      })
      : [];
    return [...direct, ...related];
  }))];
}

export function rankFundingAlignmentSuggestions(input: {
  candidate: CandidateRow;
  contact: ContactRow | null;
  projects: ProjectRow[];
  profiles: ProjectProfileRow[];
  recommendations: RecommendationRow[];
  contactHistory: Array<{ project_code: string }>;
}): FundingAlignmentSuggestion[] {
  const projects = new Map(input.projects.map(project => [project.code, project]));
  const profiles = new Map(input.profiles.map(profile => [profile.project_code, profile]));
  const aliasesByCode = new Map(input.projects.map(project => [
    project.code,
    projectAliases(project, profiles.get(project.code)),
  ]));
  const signals = new Map<string, Signal[]>();

  for (const code of collisionProjectCodes(input.candidate.evidence)) {
    addSignal(signals, code, {
      source: 'notion_collision',
      weight: 0.99,
      detail: 'Legacy Notion page with the same title has an explicit project relation.',
    }, projects);
  }

  for (const value of input.contact?.projects || []) {
    const code = resolveProjectCode(value, aliasesByCode);
    addSignal(signals, code, {
      source: 'contact_project',
      weight: 0.96,
      detail: `GHL contact project field: ${value}`,
    }, projects);
  }

  for (const tag of input.contact?.tags || []) {
    if (!tag.toLowerCase().startsWith('project:')) continue;
    const value = tag.slice(tag.indexOf(':') + 1);
    const code = resolveProjectCode(value, aliasesByCode);
    addSignal(signals, code, {
      source: 'contact_tag',
      weight: 0.92,
      detail: `GHL contact tag: ${tag}`,
    }, projects);
  }

  for (const history of input.contactHistory) {
    addSignal(signals, history.project_code, {
      source: 'contact_history',
      weight: 0.88,
      detail: 'The same GHL contact has another governed opportunity for this project.',
    }, projects);
  }

  for (const project of input.projects) {
    const aliases = aliasesByCode.get(project.code) || [];
    const explicit = aliases
      .filter(alias => alias.length >= 4 && !['core', 'studio'].includes(alias))
      .find(alias => includesPhrase(input.candidate.ghl_opportunity_name, alias));
    if (explicit) {
      addSignal(signals, project.code, {
        source: 'explicit_name',
        weight: 0.95,
        detail: `Opportunity title explicitly names “${explicit}”.`,
      }, projects);
    }

    const profile = profiles.get(project.code);
    const matchedThemes = (profile?.theme_keywords || [])
      .map(normalized)
      .filter(theme => theme.length >= 5 && !GENERIC_THEMES.has(theme))
      .filter(theme => includesPhrase(input.candidate.ghl_opportunity_name, theme))
      .slice(0, 3);
    if (matchedThemes.length) {
      addSignal(signals, project.code, {
        source: 'theme',
        weight: Math.min(0.72, 0.56 + (matchedThemes.length * 0.05)),
        detail: `Distinct project themes in title: ${matchedThemes.join(', ')}.`,
      }, projects);
    }
  }

  for (const recommendation of input.recommendations) {
    if (normalized(recommendation.opportunity_name) !== normalized(input.candidate.ghl_opportunity_name)) continue;
    const fitScore = Number(recommendation.fit_score || 0);
    if (fitScore < 50) continue;
    addSignal(signals, recommendation.project_code, {
      source: 'grantscope',
      weight: Math.min(0.78, fitScore / 100),
      detail: `GrantScope exact-title project fit: ${fitScore}/100${recommendation.is_strong_fit ? ' (strong fit)' : ''}.`,
    }, projects);
  }

  return [...signals.entries()]
    .map(([projectCode, evidence]) => {
      const maximum = Math.max(...evidence.map(signal => signal.weight));
      const sourceCount = new Set(evidence.map(signal => signal.source)).size;
      const confidence = Math.min(0.99, maximum + Math.max(0, sourceCount - 1) * 0.03);
      const project = projects.get(projectCode);
      return {
        projectCode,
        projectName: project?.name || projectCode,
        confidence: Number(confidence.toFixed(2)),
        verdict: confidence >= 0.8 ? 'recommended' as const : 'possible' as const,
        evidence: evidence.sort((a, b) => b.weight - a.weight),
      };
    })
    .filter(suggestion => suggestion.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence || a.projectCode.localeCompare(b.projectCode))
    .slice(0, 3);
}

export async function getFundingGhlAlignmentReviewQueue() {
  const db = getServiceSupabase();
  const candidatesResult = await db
    .from('funding_ghl_alignment_candidates')
    .select('ghl_opportunity_id, ghl_opportunity_name, classification, notion_funding_page_url, evidence')
    .eq('status', 'blocked')
    .order('ghl_opportunity_name');
  if (candidatesResult.error) throw new Error(`Load funding review candidates: ${candidatesResult.error.message}`);
  const candidates = (candidatesResult.data || []) as CandidateRow[];
  const opportunityIds = candidates.map(candidate => candidate.ghl_opportunity_id);
  if (!opportunityIds.length) {
    return { summary: { total: 0, recommended: 0, ambiguous: 0, none: 0 }, projects: [], items: [] };
  }

  const [opportunitiesResult, projectsResult, profilesResult, recommendationsResult] = await Promise.all([
    db.from('ghl_opportunities').select('ghl_id, ghl_contact_id').in('ghl_id', opportunityIds),
    db.from('org_projects').select('code, name, slug, description').eq('status', 'active').not('code', 'is', null).order('name'),
    db.from('act_grant_recommendation_projects').select('project_code, project_label, theme_keywords').eq('in_scope', true),
    db.from('act_grant_recommendations_current')
      .select('opportunity_name, project_code, fit_score, is_strong_fit')
      .in('opportunity_name', candidates.map(candidate => candidate.ghl_opportunity_name)),
  ]);
  if (opportunitiesResult.error) throw new Error(`Load review opportunities: ${opportunitiesResult.error.message}`);
  if (projectsResult.error) throw new Error(`Load review projects: ${projectsResult.error.message}`);
  if (profilesResult.error) throw new Error(`Load project funding profiles: ${profilesResult.error.message}`);
  if (recommendationsResult.error) throw new Error(`Load GrantScope recommendation evidence: ${recommendationsResult.error.message}`);

  const opportunities = (opportunitiesResult.data || []) as OpportunityRow[];
  const opportunityById = new Map(opportunities.map(opportunity => [opportunity.ghl_id, opportunity]));
  const contactIds = [...new Set(opportunities.map(opportunity => opportunity.ghl_contact_id).filter((id): id is string => Boolean(id)))];
  const [contactsResult, historyResult] = await Promise.all([
    contactIds.length
      ? db.from('ghl_contacts').select('ghl_id, full_name, company_name, tags, projects').in('ghl_id', contactIds)
      : Promise.resolve({ data: [], error: null }),
    contactIds.length
      ? db.from('ghl_opportunities').select('ghl_contact_id, project_code').in('ghl_contact_id', contactIds).not('project_code', 'is', null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (contactsResult.error) throw new Error(`Load GHL contact context: ${contactsResult.error.message}`);
  if (historyResult.error) throw new Error(`Load governed contact history: ${historyResult.error.message}`);
  const contacts = new Map(((contactsResult.data || []) as ContactRow[]).map(contact => [contact.ghl_id, contact]));
  const historyByContact = new Map<string, Array<{ project_code: string }>>();
  for (const row of (historyResult.data || []) as Array<{ ghl_contact_id: string; project_code: string }>) {
    const values = historyByContact.get(row.ghl_contact_id) || [];
    values.push({ project_code: row.project_code });
    historyByContact.set(row.ghl_contact_id, values);
  }

  const projects = (projectsResult.data || []) as ProjectRow[];
  const profiles = (profilesResult.data || []) as ProjectProfileRow[];
  const recommendations = (recommendationsResult.data || []) as RecommendationRow[];
  const items: FundingAlignmentReviewItem[] = candidates.map(candidate => {
    const opportunity = opportunityById.get(candidate.ghl_opportunity_id);
    const contact = opportunity?.ghl_contact_id ? contacts.get(opportunity.ghl_contact_id) || null : null;
    const suggestions = rankFundingAlignmentSuggestions({
      candidate,
      contact,
      projects,
      profiles,
      recommendations,
      contactHistory: opportunity?.ghl_contact_id ? historyByContact.get(opportunity.ghl_contact_id) || [] : [],
    });
    const top = suggestions[0];
    const runnerUp = suggestions[1];
    const recommendation = top?.confidence >= 0.8 && (!runnerUp || top.confidence - runnerUp.confidence >= 0.15)
      ? 'recommended'
      : suggestions.length
        ? 'ambiguous'
        : 'none';
    return {
      ghlOpportunityId: candidate.ghl_opportunity_id,
      opportunityName: candidate.ghl_opportunity_name,
      classification: candidate.classification,
      notionUrl: candidate.notion_funding_page_url,
      contact: contact ? {
        name: contact.full_name,
        company: contact.company_name,
        tags: contact.tags || [],
        projects: contact.projects || [],
      } : null,
      suggestions,
      recommendation,
    };
  });
  return {
    summary: {
      total: items.length,
      recommended: items.filter(item => item.recommendation === 'recommended').length,
      ambiguous: items.filter(item => item.recommendation === 'ambiguous').length,
      none: items.filter(item => item.recommendation === 'none').length,
    },
    projects: projects.map(project => ({ code: project.code, name: project.name })),
    items,
  };
}

export async function applyFundingGhlAlignmentReviews(input: {
  assignments: Array<{ ghlOpportunityId: string; projectCode: string }>;
  reviewedBy: string;
}) {
  if (!input.assignments.length) throw new Error('At least one assignment is required');
  if (input.assignments.length > 100) throw new Error('A review batch cannot exceed 100 assignments');
  const duplicateIds = input.assignments.map(item => item.ghlOpportunityId);
  if (new Set(duplicateIds).size !== duplicateIds.length) throw new Error('A GHL opportunity can appear only once per batch');

  const db = getServiceSupabase();
  const queue = await getFundingGhlAlignmentReviewQueue();
  const itemById = new Map(queue.items.map(item => [item.ghlOpportunityId, item]));
  const activeCodes = new Set(queue.projects.map(project => project.code));
  for (const assignment of input.assignments) {
    if (!itemById.has(assignment.ghlOpportunityId)) {
      throw new Error(`GHL opportunity ${assignment.ghlOpportunityId} is not in the current review queue`);
    }
    if (!activeCodes.has(assignment.projectCode)) {
      throw new Error(`Project code ${assignment.projectCode} is not an active canonical project`);
    }
  }

  const batchId = randomUUID();
  const now = new Date().toISOString();
  const reviewRows = input.assignments.map(assignment => ({
    batch_id: batchId,
    ghl_opportunity_id: assignment.ghlOpportunityId,
    project_code: assignment.projectCode,
    decision: 'approved',
    status: 'pending',
    suggestion_snapshot: {
      selectedProjectCode: assignment.projectCode,
      suggestions: itemById.get(assignment.ghlOpportunityId)?.suggestions || [],
    },
    reviewed_by: input.reviewedBy,
    created_at: now,
  }));
  const inserted = await db.from('funding_ghl_alignment_reviews').insert(reviewRows).select('id, ghl_opportunity_id');
  if (inserted.error) throw new Error(`Create funding review receipts: ${inserted.error.message}`);
  if (inserted.data?.length !== reviewRows.length) {
    throw new Error(`Funding review receipt mismatch: attempted ${reviewRows.length}, wrote ${inserted.data?.length || 0}`);
  }

  const relationResults = await applyFundingNotionProjectRelations(input.assignments);
  for (const result of relationResults) {
    const update = await db.from('funding_ghl_alignment_reviews').update({
      status: result.error ? 'failed' : 'applied',
      notion_funding_page_id: result.notionPageId || null,
      notion_funding_page_url: result.notionPageUrl || null,
      error: result.error || null,
      completed_at: new Date().toISOString(),
    }).eq('batch_id', batchId).eq('ghl_opportunity_id', result.ghlOpportunityId);
    if (update.error) throw new Error(`Update funding review receipt: ${update.error.message}`);
  }

  const applied = relationResults.filter(result => !result.error);
  const alignment = applied.length
    ? await runFundingGhlAlignment('manual', { createInbox: true, applySafe: true })
    : null;
  return {
    batchId,
    attempted: relationResults.length,
    applied: applied.length,
    failed: relationResults.length - applied.length,
    results: relationResults,
    alignment,
  };
}
