#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const CLASSIFIER_VERSION = 'wa-human-services-rules-v1';
const PAGE_SIZE = 1000;

const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const FAMILY_RULES = [
  ['youth_justice', [
    /youth justice/i, /juvenile justice/i, /young offender/i, /youth diversion/i,
    /bail support/i, /reintegration/i, /target 120/i, /youth engagement/i,
  ]],
  ['family_domestic_violence', [
    /family and domestic violence/i, /domestic and family violence/i, /coercive control/i,
    /family violence/i, /domestic violence/i, /women(?:'s)? refuge/i,
  ]],
  ['child_family', [
    /child protection/i, /out.of.home care/i, /foster care/i, /kinship care/i,
    /family support service/i, /intensive family support/i, /child and family service/i,
    /children and famil(?:y|ies)/i, /parenting support/i,
  ]],
  ['housing_homelessness', [
    /homelessness service/i, /homelessness support/i, /rough sleeper/i,
    /tenancy support/i, /supported accommodation/i, /crisis accommodation/i,
    /housing support service/i, /youth accommodation/i,
  ]],
  ['community_services', [
    /aboriginal community connectors?/i,
    /community service delivery/i, /community support service/i, /case management/i,
    /support coordination/i, /place.based service/i, /outreach service/i,
  ]],
  ['health_mental_health', [
    /mental health service/i, /mental health support/i, /social and emotional wellbeing/i,
    /alcohol and other drugs/i, /alcohol and drug service/i, /aod service/i,
    /counselling service/i, /suicide prevention/i, /community health service/i,
  ]],
  ['disability', [
    /disability support/i, /disability service/i, /supported independent living/i,
    /positive behaviour support/i, /carer support service/i,
  ]],
  ['employment_training', [
    /employment service/i, /job readiness/i, /work readiness/i, /vocational training/i,
    /training and employment/i, /workforce participation/i,
  ]],
  ['cultural_services', [
    /culturally safe (?:service|program|practice)/i, /cultural healing/i,
    /aboriginal cultural support/i, /on country (?:service|program)/i,
  ]],
];

const EXCLUSIONS = [
  ['construction', /\b(?:construction|construct|building works|capital works|refurbish|renovation|fit.?out|demolition)\b/i],
  ['maintenance', /\b(?:maintenance|repair works|facility management|facilities management|grounds maintenance)\b/i],
  ['cleaning', /\b(?:cleaning|waste removal|laundry service)\b/i],
  ['technology', /\b(?:software|hardware|ict|information technology|cyber|network|telecommunications|system implementation)\b/i],
  ['professional_design', /\b(?:architect|engineering consultancy|quantity survey|design consultant)\b/i],
  ['equipment_goods', /\b(?:equipment supply|medical equipment|office furniture|vehicle|fleet|uniform|consumables)\b/i],
  ['infrastructure', /\b(?:roadworks|civil works|utilities|drainage|sewer|electrical works|mechanical works)\b/i],
  ['recording_transcription', /\b(?:court recording|transcription service)\b/i],
];

function normaliseName(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\b(?:PTY|LTD|LIMITED|INCORPORATED|INC|CORPORATION|CORP)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchAll(table, columns, configure = (query) => query) {
  const records = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = configure(db.from(table).select(columns)).range(from, from + PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) throw error;
    records.push(...data);
    if (data.length < PAGE_SIZE) return records;
  }
}

function transitionWindow(expiryDate) {
  if (!expiryDate) return 'unknown';
  const expiry = new Date(expiryDate);
  const now = new Date();
  if (expiry < now) return 'expired';
  const months = (expiry.getUTCFullYear() - now.getUTCFullYear()) * 12
    + expiry.getUTCMonth() - now.getUTCMonth();
  if (months <= 12) return 'ending_12m';
  if (months <= 24) return 'ending_24m';
  return 'later';
}

function classify(contract) {
  const text = [contract.title, contract.description, contract.category, contract.buyer_name, contract.buyer_department]
    .filter(Boolean).join(' ');
  const families = FAMILY_RULES.map(([family, rules]) => ({
    family,
    signals: rules.filter((rule) => rule.test(text)).map((rule) => rule.source),
  })).filter((result) => result.signals.length);
  const exclusions = EXCLUSIONS.filter(([, rule]) => rule.test(text)).map(([name]) => name);
  const hardExclusion = exclusions.includes('recording_transcription');
  const positiveSignals = families.flatMap((result) => result.signals);
  if (contract.dcsp_policy_applicable) positiveSignals.unshift('source:dcsp_policy_applicable');
  const family = families[0]?.family ?? (contract.dcsp_policy_applicable ? 'community_services' : 'other');
  const buyerSignal = /department of communities|department of justice|mental health commission|department of health/i.test(text);
  const score = Math.min(100, positiveSignals.length * 25 + (contract.dcsp_policy_applicable ? 35 : 0) + (buyerSignal ? 10 : 0) - exclusions.length * 15);
  let candidateStatus = 'excluded';
  if (hardExclusion) candidateStatus = 'excluded';
  else if (positiveSignals.length && exclusions.length) candidateStatus = 'review';
  else if (positiveSignals.length && score >= 25) candidateStatus = 'candidate';
  return { family, positiveSignals, exclusions, score: Math.max(0, score), candidateStatus };
}

function buildEntityIndex(entities) {
  const names = new Map();
  const abns = new Map();
  for (const entity of entities) {
    const name = normaliseName(entity.canonical_name);
    if (name) names.set(name, [...(names.get(name) || []), entity]);
    if (entity.abn) abns.set(String(entity.abn).replace(/\D/g, ''), [...(abns.get(String(entity.abn).replace(/\D/g, '')) || []), entity]);
  }
  return { names, abns };
}

function matchEntity(contract, index) {
  if (contract.is_panel_contract || (contract.suppliers?.length ?? 0) > 1 || String(contract.supplier_name || '').includes(' | ')) {
    return { status: 'panel' };
  }
  const abn = String(contract.supplier_abn || '').replace(/\D/g, '');
  if (abn && index.abns.get(abn)?.length === 1) {
    return { status: 'matched', method: 'exact_abn', confidence: 1, entity: index.abns.get(abn)[0] };
  }
  const name = normaliseName(contract.supplier_name);
  const matches = name ? index.names.get(name) || [] : [];
  if (matches.length === 1) return { status: 'matched', method: 'unique_normalised_name', confidence: 0.9, entity: matches[0] };
  if (matches.length > 1) return { status: 'ambiguous', evidence: { normalised_name: name, candidate_entity_ids: matches.map((item) => item.id) } };
  return { status: 'unmatched', evidence: name ? { normalised_name: name } : {} };
}

function summarise(rows) {
  const countBy = (field) => Object.fromEntries([...new Set(rows.map((row) => row[field]))].sort().map((value) => [value, rows.filter((row) => row[field] === value).length]));
  return {
    records: rows.length,
    by_status: countBy('candidate_status'),
    by_family: countBy('service_family'),
    by_transition_window: countBy('transition_window'),
    kimberley_candidate_or_review: rows.filter((row) => row.is_kimberley && row.candidate_status !== 'excluded').length,
    entity_matches: rows.filter((row) => row.entity_match_status === 'matched').length,
    community_controlled_signals: rows.filter((row) => row.supplier_is_community_controlled === true).length,
    kimberley_sample: rows
      .filter((row) => row.is_kimberley && row.candidate_status !== 'excluded')
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 12)
      .map((row) => ({ source_contract_id: row.source_contract_id, family: row.service_family, status: row.candidate_status, score: row.relevance_score })),
  };
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  const [contracts, entities, existingRows, resolvedSupplierRows] = await Promise.all([
    fetchAll('state_tenders', 'id,source_id,title,description,category,buyer_name,buyer_department,supplier_name,supplier_abn,regions,expiry_date,is_panel_contract,suppliers,dcsp_policy_applicable,aboriginal_participation_requirements', (query) => query.in('source', ['tenders-wa', 'data-wa-tenders']).eq('state', 'WA').order('id')),
    fetchAll('gs_entities', 'id,gs_id,canonical_name,abn,is_community_controlled,source_datasets,source_count', (query) => query.eq('state', 'WA').order('id')),
    fetchAll('wa_transition_candidates', 'state_tender_id,evidence_status,review_status,review_notes,matched_entity_id,entity_match_status,entity_match_method,entity_match_confidence,supplier_is_community_controlled,entity_match_evidence', (query) => query.order('state_tender_id')),
    fetchAll('wa_supplier_entity_matches', 'state_tender_id', (query) => query.order('state_tender_id')),
  ]);
  const entityIndex = buildEntityIndex(entities);
  const existingByTender = new Map(existingRows.map((row) => [row.state_tender_id, row]));
  const resolvedTenderIds = new Set(resolvedSupplierRows.map((row) => row.state_tender_id));
  const rows = contracts.map((contract) => {
    const classification = classify(contract);
    const fallbackMatch = matchEntity(contract, entityIndex);
    const existing = existingByTender.get(contract.id);
    const useResolver = resolvedTenderIds.has(contract.id) && existing;
    const match = useResolver ? {
      status: existing.entity_match_status,
      method: existing.entity_match_method,
      confidence: existing.entity_match_confidence,
      entity: existing.matched_entity_id ? {
        id: existing.matched_entity_id,
        is_community_controlled: existing.supplier_is_community_controlled,
      } : null,
      evidence: existing.entity_match_evidence,
    } : fallbackMatch;
    const reviewed = existing && existing.review_status !== 'pending';
    return {
      state_tender_id: contract.id,
      source_contract_id: contract.source_id,
      service_family: classification.family,
      candidate_status: classification.candidateStatus,
      relevance_score: classification.score,
      positive_signals: classification.positiveSignals,
      exclusion_signals: classification.exclusions,
      classification_method: 'deterministic_rules',
      classifier_version: CLASSIFIER_VERSION,
      evidence_status: reviewed ? existing.evidence_status : classification.candidateStatus === 'excluded' ? 'excluded' : 'inferred',
      review_status: existing?.review_status ?? 'pending',
      is_kimberley: (contract.regions || []).some((region) => /kimberley/i.test(region)),
      transition_window: transitionWindow(contract.expiry_date),
      matched_entity_id: match.entity?.id ?? null,
      entity_match_status: match.status,
      entity_match_method: match.method ?? null,
      entity_match_confidence: match.confidence ?? null,
      supplier_is_community_controlled: match.entity?.is_community_controlled ?? null,
      entity_match_evidence: match.evidence ?? {
        gs_id: match.entity?.gs_id,
        canonical_name: match.entity?.canonical_name,
        source_count: match.entity?.source_count,
        source_datasets: match.entity?.source_datasets,
      },
      review_notes: existing?.review_notes ?? null,
      updated_at: new Date().toISOString(),
    };
  });

  if (APPLY) {
    for (let index = 0; index < rows.length; index += 500) {
      const { error } = await db.from('wa_transition_candidates').upsert(rows.slice(index, index + 500), { onConflict: 'state_tender_id' });
      if (error) throw error;
    }
    const { count, error } = await db.from('wa_transition_candidates').select('id', { count: 'exact', head: true });
    if (error) throw error;
    if (count !== rows.length) throw new Error(`Post-write mismatch: expected ${rows.length}, found ${count}`);
  }

  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', classifier_version: CLASSIFIER_VERSION, ...summarise(rows) }, null, 2));
}

main().catch((error) => {
  const detail = error instanceof Error ? error.stack : JSON.stringify(error, null, 2);
  console.error(`[wa-transition-candidates] ${detail}`);
  process.exit(1);
});
