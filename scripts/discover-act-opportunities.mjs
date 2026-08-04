#!/usr/bin/env node

import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { assessGrantEvidence, normaliseGrantName } from './lib/grant-evidence-gate.mjs';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const arg = (name) => process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
const DRY_RUN = process.argv.includes('--dry-run');
const PROVIDER = arg('--provider') || 'octen';
const FIXTURE = arg('--fixture');
const EXPLICIT_QUERY = arg('--query');
const PROJECT_FILTER = arg('--project');
const COUNT = Math.min(20, Math.max(1, Number(arg('--count') || 8)));
const OFFICIAL_DOMAINS = (arg('--official-domains') || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const AGENT_ID = `discover-act-opportunities-${PROVIDER}`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function hostFor(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function fingerprint(result, projectCode) {
  const host = hostFor(result.url) || 'invalid';
  const basis = `${projectCode}|${host}|${normaliseGrantName(result.title)}`;
  return createHash('sha256').update(basis).digest('hex');
}

function providerCost(result, response, resultCount) {
  const responseShare = response.cost_usd == null ? null : Number(response.cost_usd) / Math.max(1, resultCount);
  const value = result.cost_usd ?? responseShare;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

async function loadProjects() {
  if (EXPLICIT_QUERY || (FIXTURE && PROJECT_FILTER)) {
    return [{
      project_code: PROJECT_FILTER || 'ACT-CORE',
      notes: 'Explicit ACT opportunity search',
      theme_keywords: [],
      query: EXPLICIT_QUERY || `Fixture discovery for ${PROJECT_FILTER}`,
    }];
  }

  const { data, error } = await supabase
    .from('act_grant_recommendation_projects')
    .select('project_code, notes, theme_keywords')
    .eq('in_scope', true);
  if (error) throw new Error(`Could not load ACT projects: ${error.message}`);

  return (data ?? [])
    .filter((project) => !PROJECT_FILTER || project.project_code === PROJECT_FILTER)
    .map((project) => ({
      ...project,
      query: [
        '"applications open" grant Australia',
        project.notes,
        (project.theme_keywords ?? []).slice(0, 5).join(' '),
        'deadline eligibility amount',
      ].filter(Boolean).join(' '),
    }));
}

async function octenSearch(query) {
  const apiKey = process.env.OCTEN_API_KEY;
  if (!apiKey) throw new Error('OCTEN_API_KEY is required unless --fixture is supplied');
  const response = await fetch('https://api.octen.ai/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ query, count: COUNT }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Octen search failed (${response.status})`);
  const body = await response.json();
  return {
    raw: body,
    results: body.data?.results ?? [],
    cost_usd: body.meta?.cost_usd ?? null,
  };
}

async function fixtureSearch() {
  const body = JSON.parse(await readFile(FIXTURE, 'utf8'));
  return {
    raw: body,
    results: body.data?.results ?? body.results ?? [],
    cost_usd: body.meta?.cost_usd ?? body.cost_usd ?? 0,
  };
}

async function runSearch(query) {
  if (FIXTURE) return fixtureSearch();
  if (PROVIDER === 'octen') return octenSearch(query);
  throw new Error(`Unsupported provider "${PROVIDER}". Add an adapter before using it.`);
}

function candidateFromResult(result, response, project, rank, retrievedAt) {
  const sourceUrl = result.url;
  const host = hostFor(sourceUrl);
  const autoOfficial = Boolean(host?.endsWith('.gov.au') || host === 'gov.au');
  const explicitlyOfficial = Boolean(host && OFFICIAL_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  ));
  const official = autoOfficial || explicitlyOfficial;
  const quote = String(result.highlight || result.snippet || '').trim();
  const evidenceUrl = sourceUrl;

  const candidate = {
    fingerprint: fingerprint(result, project.project_code),
    provider: PROVIDER,
    provider_result_id: result.id ?? null,
    search_query: project.query,
    result_rank: rank + 1,
    name: result.title ?? null,
    funder_name: result.author ?? result.authors ?? null,
    source_url: sourceUrl,
    application_url: null,
    official_domains: official && host ? [host] : [],
    official_source_confirmed: official,
    deadline: null,
    intake_type: 'unknown',
    next_review_at: null,
    eligible_org_types: [],
    eligibility_criteria: {},
    funding_amount_status: 'unknown',
    amount_min: null,
    amount_max: null,
    project_codes: [project.project_code],
    project_fit_reason: `Discovered by a search scoped to ${project.project_code}; substantive fit still requires evidence.`,
    evidence: {
      ...(official && quote ? {
        official_source: { url: evidenceUrl, quote },
      } : {}),
      ...(quote ? {
        named_round: { url: evidenceUrl, quote: `${result.title}. ${quote}` },
      } : {}),
    },
    provider_cost_usd: providerCost(result, response, response.results.length),
    retrieved_at: retrievedAt,
    raw_result: result,
  };
  const assessment = assessGrantEvidence(candidate);
  return {
    ...candidate,
    gate_status: assessment.status,
    failed_requirements: assessment.failed_requirements,
    evidence_completeness: assessment.evidence_completeness,
    passes: assessment.passes,
  };
}

async function main() {
  const run = DRY_RUN
    ? { id: null }
    : await logStart(supabase, AGENT_ID, 'Discover ACT opportunity signals');
  const projects = await loadProjects();
  const candidates = [];
  let totalCostUsd = 0;

  try {
    for (const project of projects) {
      const response = await runSearch(project.query);
      const retrievedAt = new Date().toISOString();
      response.results.forEach((result, index) => {
        if (!result?.url || !result?.title) return;
        const candidate = candidateFromResult(result, response, project, index, retrievedAt);
        candidates.push(candidate);
        totalCostUsd += candidate.provider_cost_usd ?? 0;
      });
    }

    const reviewable = candidates.filter((candidate) => candidate.passes).length;
    const averageCompleteness = candidates.length
      ? Math.round(candidates.reduce((sum, candidate) => sum + candidate.evidence_completeness, 0) / candidates.length)
      : 0;

    console.log(JSON.stringify({
      provider: PROVIDER,
      projects: projects.length,
      signals: candidates.length,
      eligible_for_review: reviewable,
      average_evidence_completeness: averageCompleteness,
      reported_cost_usd: Number(totalCostUsd.toFixed(6)),
      dry_run: DRY_RUN,
    }, null, 2));

    if (!DRY_RUN && candidates.length) {
      const rows = candidates.map(({ passes: _passes, ...candidate }) => candidate);
      const { error } = await supabase
        .from('act_opportunity_observatory')
        .upsert(rows, { onConflict: 'fingerprint' });
      if (error) throw new Error(`Could not store Observatory signals: ${error.message}`);
    }

    if (run.id) {
      await logComplete(supabase, run.id, {
        items_found: candidates.length,
        items_new: candidates.length,
        metadata: {
          provider: PROVIDER,
          eligible_for_review: reviewable,
          average_evidence_completeness: averageCompleteness,
          reported_cost_usd: totalCostUsd,
        },
      });
    }
  } catch (error) {
    if (run.id) await logFailed(supabase, run.id, error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
