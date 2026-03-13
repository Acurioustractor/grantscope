#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logComplete, logFailed, logStart } from './lib/log-agent-run.mjs';

const VERSION = 'v1';
const BATCH_SIZE = 250;

function parseArgs(argv) {
  const options = {
    limit: null,
    foundationId: null,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit' && argv[i + 1]) {
      options.limit = Number(argv[++i]);
    } else if (arg === '--foundation-id' && argv[i + 1]) {
      options.foundationId = argv[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function hasText(value) {
  return Boolean(value && String(value).trim().length > 0);
}

function normalizeScore(value) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function arrayCount(value) {
  return Array.isArray(value) ? value.length : 0;
}

function classifyFoundation(row, programStats) {
  const name = String(row.name || '');
  const website = String(row.website || '');
  const description = String(row.description || '');
  const givingPhilosophy = String(row.giving_philosophy || '');
  const applicationTips = String(row.application_tips || '');
  const type = String(row.type || '').toLowerCase();
  const lowerIdentity = `${name} ${website}`.toLowerCase();
  const lowerText = `${name} ${website} ${description} ${givingPhilosophy}`.toLowerCase();

  const openPrograms = programStats?.open ?? 0;
  const closedPrograms = programStats?.closed ?? 0;
  const publicGrantSurface = openPrograms + closedPrograms > 0;
  const thematicCount = arrayCount(row.thematic_focus);
  const geographicCount = arrayCount(row.geographic_focus);
  const notableGrantCount = arrayCount(row.notable_grants);

  const funderShape =
    /(foundation|trust|fund|philanthrop|community foundation|giving|scholarship|fellowship)/i.test(
      `${name} ${website}`,
    );
  const institutionalOperator =
    /(university|school|college|tafe|legal aid|health network|hospital|catholic education|education office|council|shire|commission|government|department)/i.test(
      lowerIdentity,
    ) || /(primary health network|phn)/i.test(lowerText);
  const religiousOperator =
    /(church|parish|diocese|catholic|anglican|bible society|latter-day saint|redeemed christian|ministry)/i.test(
      lowerIdentity,
    );
  const serviceOperator =
    /(world vision|red cross|compassion|flying doctor|barnardos|mission australia|salvation army|support services|support service|society|health limited|children's service|family support|service of australia)/i.test(
      lowerIdentity,
    );
  const communityFoundation =
    /(community foundation|community trust|community fund)/i.test(lowerText);

  const explicitGrantSignals = [
    hasText(applicationTips),
    hasText(givingPhilosophy),
    publicGrantSurface,
    (Number(row.avg_grant_size) || 0) > 0,
    (Number(row.grant_range_min) || 0) > 0,
    (Number(row.grant_range_max) || 0) > 0,
    thematicCount > 0,
    geographicCount > 0,
    notableGrantCount > 0,
  ].filter(Boolean).length;

  let capitalHolderClass = 'unclear';
  let capitalSourceClass = 'unknown';
  let reportableInPowerMap = false;
  const reasons = [];
  let confidence = 'low';

  if (type === 'private_ancillary_fund' || type === 'public_ancillary_fund') {
    capitalHolderClass = 'philanthropic_capital_holder';
    capitalSourceClass = 'ancillary_fund';
    reportableInPowerMap = true;
    confidence = 'high';
    reasons.push('Explicit ancillary fund structure');
  } else if (type === 'corporate_foundation' && !institutionalOperator && !serviceOperator) {
    capitalHolderClass = 'philanthropic_capital_holder';
    capitalSourceClass = communityFoundation ? 'community_foundation' : 'corporate_foundation';
    reportableInPowerMap = true;
    confidence = 'high';
    reasons.push('Corporate foundation with philanthropic structure');
  } else if (type === 'trust' && (funderShape || publicGrantSurface || explicitGrantSignals >= 3) && !institutionalOperator && !religiousOperator) {
    capitalHolderClass = 'philanthropic_capital_holder';
    capitalSourceClass = communityFoundation ? 'community_foundation' : 'family_trust';
    reportableInPowerMap = true;
    confidence = publicGrantSurface ? 'high' : 'medium';
    reasons.push(publicGrantSurface ? 'Trust with real grant programs' : 'Trust with strong philanthropic signals');
  } else if (institutionalOperator) {
    capitalHolderClass = 'institutional_operator';
    capitalSourceClass = 'institutional_endowment';
    reportableInPowerMap = false;
    confidence = 'high';
    reasons.push('Institutional operator or public service body');
  } else if (religiousOperator) {
    capitalHolderClass = 'religious_operator';
    capitalSourceClass = 'religious_network';
    reportableInPowerMap = false;
    confidence = 'high';
    reasons.push('Religious network operator rather than philanthropic capital holder');
  } else if (serviceOperator && !funderShape && type === 'grantmaker') {
    capitalHolderClass = 'service_operator';
    capitalSourceClass = 'service_revenue';
    reportableInPowerMap = false;
    confidence = 'high';
    reasons.push('Service delivery charity or operator is not treated as a standalone capital holder');
  } else if (serviceOperator && !publicGrantSurface && explicitGrantSignals < 4) {
    capitalHolderClass = 'service_operator';
    capitalSourceClass = 'service_revenue';
    reportableInPowerMap = false;
    confidence = 'high';
    reasons.push('Service delivery operator with weak public grantmaker evidence');
  } else if (funderShape || publicGrantSurface || explicitGrantSignals >= 4) {
    capitalHolderClass = type === 'grantmaker' ? 'intermediary_grantmaker' : 'philanthropic_capital_holder';
    capitalSourceClass = communityFoundation
      ? 'community_foundation'
      : type === 'grantmaker'
        ? 'mixed'
        : 'unknown';
    reportableInPowerMap = true;
    confidence = publicGrantSurface || explicitGrantSignals >= 5 ? 'medium' : 'low';
    reasons.push(publicGrantSurface ? 'Publishes grant-like programs' : 'Shows multiple public grantmaker signals');
  } else {
    reasons.push('Insufficient evidence of philanthropic capital holding');
  }

  if (openPrograms > 0) reasons.push(`${openPrograms} open programs`);
  if (hasText(applicationTips)) reasons.push('shares application guidance');
  if (hasText(givingPhilosophy)) reasons.push('explains giving philosophy');
  if (thematicCount > 0) reasons.push(`declares ${thematicCount} thematic focus areas`);
  if (geographicCount > 0) reasons.push(`declares ${geographicCount} geographic focus areas`);

  let opennessScore = 0;
  opennessScore += publicGrantSurface ? 0.35 : 0;
  opennessScore += hasText(applicationTips) ? 0.18 : 0;
  opennessScore += hasText(givingPhilosophy) ? 0.14 : 0;
  opennessScore += (Number(row.avg_grant_size) || Number(row.grant_range_min) || Number(row.grant_range_max)) > 0 ? 0.12 : 0;
  opennessScore += notableGrantCount > 0 ? 0.08 : 0;
  opennessScore += thematicCount > 0 ? 0.07 : 0;
  opennessScore += geographicCount > 0 ? 0.06 : 0;
  opennessScore += row.profile_confidence === 'high' ? 0.05 : row.profile_confidence === 'medium' ? 0.03 : 0;
  opennessScore = normalizeScore(opennessScore);

  let approachabilityScore = opennessScore;
  approachabilityScore += reportableInPowerMap ? 0.1 : -0.15;
  approachabilityScore += publicGrantSurface ? 0.12 : 0;
  approachabilityScore -= capitalHolderClass === 'intermediary_grantmaker' ? 0.05 : 0;
  approachabilityScore -= capitalHolderClass === 'service_operator' || capitalHolderClass === 'institutional_operator' ? 0.2 : 0;
  approachabilityScore = normalizeScore(approachabilityScore);

  const totalGiving = Number(row.total_giving_annual) || 0;
  let capitalPowerScore = totalGiving > 0 ? Math.log10(totalGiving + 1) / 9 : 0;
  capitalPowerScore += type === 'private_ancillary_fund' || type === 'public_ancillary_fund' ? 0.08 : 0;
  capitalPowerScore = normalizeScore(capitalPowerScore);

  let gatekeepingScore = capitalPowerScore * (1 - opennessScore * 0.75);
  gatekeepingScore += reportableInPowerMap ? 0.05 : 0;
  gatekeepingScore -= publicGrantSurface ? 0.04 : 0;
  gatekeepingScore = normalizeScore(gatekeepingScore);

  return {
    foundation_id: row.id,
    capital_holder_class: capitalHolderClass,
    capital_source_class: capitalSourceClass,
    reportable_in_power_map: reportableInPowerMap,
    public_grant_surface: publicGrantSurface,
    openness_score: opennessScore,
    approachability_score: approachabilityScore,
    gatekeeping_score: gatekeepingScore,
    capital_power_score: capitalPowerScore,
    classification_confidence: confidence,
    classifier_version: VERSION,
    reasons: Array.from(new Set(reasons)).slice(0, 12),
    evidence: {
      foundation_type: row.type,
      open_program_count: openPrograms,
      closed_program_count: closedPrograms,
      has_application_tips: hasText(applicationTips),
      has_giving_philosophy: hasText(givingPhilosophy),
      thematic_focus_count: thematicCount,
      geographic_focus_count: geographicCount,
      notable_grants_count: notableGrantCount,
      profile_confidence: row.profile_confidence,
      total_giving_annual: totalGiving,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const run = await logStart(supabase, 'classify-foundation-power-profiles', 'Classify Foundation Power Profiles');

  try {
    const selectColumns = [
      'id',
      'name',
      'type',
      'website',
      'description',
      'total_giving_annual',
      'avg_grant_size',
      'grant_range_min',
      'grant_range_max',
      'thematic_focus',
      'geographic_focus',
      'profile_confidence',
      'giving_philosophy',
      'application_tips',
      'notable_grants',
    ].join(', ');

    const foundations = [];
    let offset = 0;
    let remaining = args.limit ?? Number.POSITIVE_INFINITY;

    while (remaining > 0) {
      const pageSize = Math.min(BATCH_SIZE, remaining);
      let query = supabase
        .from('foundations')
        .select(selectColumns)
        .gt('total_giving_annual', 0)
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (args.foundationId) {
        query = query.eq('id', args.foundationId);
      }

      const { data: pageRows, error: foundationsError } = await query;
      if (foundationsError) throw foundationsError;

      if (!pageRows || pageRows.length === 0) break;
      foundations.push(...pageRows);

      if (args.foundationId) break;
      if (args.limit) {
        remaining -= pageRows.length;
      }
      if (pageRows.length < pageSize) break;
      offset += pageRows.length;
    }

    const { data: programRows, error: programError } = await supabase
      .from('foundation_programs')
      .select('foundation_id, status')
      .in('status', ['open', 'closed']);
    if (programError) throw programError;

    const programMap = new Map();
    for (const row of programRows || []) {
      const current = programMap.get(row.foundation_id) || { open: 0, closed: 0 };
      if (row.status === 'open') current.open += 1;
      if (row.status === 'closed') current.closed += 1;
      programMap.set(row.foundation_id, current);
    }

    const classified = (foundations || []).map((row) => classifyFoundation(row, programMap.get(row.id)));
    const reportable = classified.filter((row) => row.reportable_in_power_map).length;
    const excluded = classified.length - reportable;

    if (args.dryRun) {
      console.log(JSON.stringify({ checked: classified.length, reportable, excluded, sample: classified.slice(0, 10) }, null, 2));
      await logComplete(supabase, run.id, {
        items_found: classified.length,
        items_new: 0,
        items_updated: 0,
        status: 'success',
      });
      return;
    }

    let updated = 0;
    for (const chunk of chunkArray(classified, BATCH_SIZE)) {
      const { error } = await supabase
        .from('foundation_power_profiles')
        .upsert(chunk, { onConflict: 'foundation_id' });
      if (error) throw error;
      updated += chunk.length;
    }

    console.log(
      `[classify-foundation-power-profiles] checked=${classified.length} reportable=${reportable} excluded=${excluded} upserted=${updated}`,
    );

    await logComplete(supabase, run.id, {
      items_found: classified.length,
      items_new: reportable,
      items_updated: updated,
      status: 'success',
    });
  } catch (error) {
    await logFailed(supabase, run.id, error);
    console.error('[classify-foundation-power-profiles] Fatal:', error.message);
    process.exit(1);
  }
}

main();
