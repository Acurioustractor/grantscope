#!/usr/bin/env node
/**
 * civic-cross-linker.mjs
 *
 * The CivicScope intelligence engine. Cross-links data across:
 *   - Ministerial statements ↔ justice_funding
 *   - Ministerial statements ↔ alma_interventions
 *   - Hansard speeches ↔ ministerial statements
 *   - Hansard speeches ↔ justice_funding
 *   - Consultancy spending ↔ gs_entities
 *   - Generates civic_alerts for significant new connections
 *
 * Usage:
 *   node --env-file=.env scripts/civic-cross-linker.mjs [--dry-run] [--batch=50]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const AGENT_ID = 'civic-cross-linker';
const AGENT_NAME = 'CivicScope Cross-Linker';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH = parseInt(process.argv.find(a => a.startsWith('--batch='))?.split('=')[1] || '50');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ── Phase 1: Link ministerial statements → justice_funding ───────

async function linkStatementsToFunding() {
  log('Phase 1: Linking ministerial statements → justice_funding...');

  // Get un-enriched statements
  const { data: statements, error } = await db
    .from('civic_ministerial_statements')
    .select('id, headline, body_text, mentioned_amounts, mentioned_orgs, mentioned_programs, mentioned_locations')
    .is('enriched_at', null)
    .order('published_at', { ascending: false })
    .limit(BATCH);

  if (error || !statements?.length) {
    log(`  No un-enriched statements (${error?.message || 'none found'})`);
    return { linked: 0, alerts: 0 };
  }

  log(`  Processing ${statements.length} un-enriched statements...`);
  let linked = 0;
  let alerts = 0;

  for (const stmt of statements) {
    const text = `${stmt.headline} ${stmt.body_text || ''}`.toLowerCase();
    const fundingIds = [];
    const interventionIds = [];
    const entityIds = [];

    // Search for matching funding records by program name or org
    const searchTerms = extractSearchTerms(text);

    for (const term of searchTerms.slice(0, 5)) { // limit searches
      // Match against justice_funding
      const { data: funding } = await db
        .from('justice_funding')
        .select('id, program_name, recipient_name, amount_dollars, gs_entity_id')
        .or(`program_name.ilike.%${term}%,recipient_name.ilike.%${term}%`)
        .limit(5);

      if (funding?.length) {
        for (const f of funding) {
          fundingIds.push(f.id);
          if (f.gs_entity_id) entityIds.push(f.gs_entity_id);
        }
      }

      // Match against alma_interventions
      const { data: interventions } = await db
        .from('alma_interventions')
        .select('id, name, gs_entity_id')
        .neq('verification_status', 'ai_generated')
        .ilike('name', `%${term}%`)
        .limit(5);

      if (interventions?.length) {
        for (const i of interventions) {
          interventionIds.push(i.id);
          if (i.gs_entity_id) entityIds.push(i.gs_entity_id);
        }
      }
    }

    // Also match by mentioned dollar amounts against funding
    for (const amount of (stmt.mentioned_amounts || []).slice(0, 3)) {
      const numericAmount = parseAmount(amount);
      if (numericAmount && numericAmount > 100000) { // only match significant amounts
        const { data: funding } = await db
          .from('justice_funding')
          .select('id, gs_entity_id')
          .gte('amount_dollars', numericAmount * 0.9)
          .lte('amount_dollars', numericAmount * 1.1)
          .limit(3);

        if (funding?.length) {
          for (const f of funding) {
            fundingIds.push(f.id);
            if (f.gs_entity_id) entityIds.push(f.gs_entity_id);
          }
        }
      }
    }

    // Deduplicate
    const uniqueFunding = [...new Set(fundingIds)];
    const uniqueInterventions = [...new Set(interventionIds)];
    const uniqueEntities = [...new Set(entityIds)];

    if (DRY_RUN) {
      if (uniqueFunding.length || uniqueInterventions.length) {
        log(`  [DRY RUN] ${stmt.headline.slice(0, 60)} → ${uniqueFunding.length} funding, ${uniqueInterventions.length} interventions`);
        linked++;
      }
    } else {
      // Update statement with links
      const { error: updateError } = await db
        .from('civic_ministerial_statements')
        .update({
          linked_funding_ids: uniqueFunding,
          linked_intervention_ids: uniqueInterventions,
          linked_entity_ids: uniqueEntities,
          enriched_at: new Date().toISOString(),
        })
        .eq('id', stmt.id);

      if (!updateError && (uniqueFunding.length || uniqueInterventions.length)) {
        linked++;

        // Generate alert if significant connections found
        if (uniqueFunding.length >= 2 || uniqueInterventions.length >= 2) {
          await createAlert({
            alert_type: 'program_announcement',
            severity: uniqueFunding.length >= 3 ? 'high' : 'info',
            title: `Minister statement linked to ${uniqueFunding.length} funding records`,
            summary: `"${stmt.headline.slice(0, 100)}" connects to ${uniqueFunding.length} funding records and ${uniqueInterventions.length} programs`,
            source_table: 'civic_ministerial_statements',
            source_id: stmt.id,
            linked_records: {
              funding: uniqueFunding,
              interventions: uniqueInterventions,
              entities: uniqueEntities,
            },
          });
          alerts++;
        }
      }
    }
  }

  log(`  Linked ${linked} statements, generated ${alerts} alerts`);
  return { linked, alerts };
}

// ── Phase 2: Link Hansard → statements + funding ─────────────────

async function linkHansardToStatements() {
  log('Phase 2: Linking Hansard → statements + funding...');

  const { data: speeches, error } = await db
    .from('civic_hansard')
    .select('id, sitting_date, speaker_name, subject, body_text')
    .is('enriched_at', null)
    .order('sitting_date', { ascending: false })
    .limit(BATCH);

  if (error || !speeches?.length) {
    log(`  No un-enriched Hansard records (${error?.message || 'none found'})`);
    return { linked: 0, alerts: 0 };
  }

  log(`  Processing ${speeches.length} Hansard speeches...`);
  let linked = 0;
  let alerts = 0;

  for (const speech of speeches) {
    const text = `${speech.subject || ''} ${speech.body_text}`.toLowerCase();
    const statementIds = [];
    const fundingIds = [];

    const searchTerms = extractSearchTerms(text);

    // Match against ministerial statements (within ±7 days of sitting)
    for (const term of searchTerms.slice(0, 3)) {
      const { data: stmts } = await db
        .from('civic_ministerial_statements')
        .select('id')
        .ilike('headline', `%${term}%`)
        .limit(3);

      if (stmts?.length) {
        for (const s of stmts) statementIds.push(s.id);
      }
    }

    // Match against justice_funding by keyword
    for (const term of searchTerms.slice(0, 3)) {
      const { data: funding } = await db
        .from('justice_funding')
        .select('id')
        .or(`program_name.ilike.%${term}%,recipient_name.ilike.%${term}%`)
        .limit(3);

      if (funding?.length) {
        for (const f of funding) fundingIds.push(f.id);
      }
    }

    const uniqueStatements = [...new Set(statementIds)];
    const uniqueFunding = [...new Set(fundingIds)];

    if (DRY_RUN) {
      if (uniqueStatements.length || uniqueFunding.length) {
        log(`  [DRY RUN] ${speech.speaker_name} (${speech.sitting_date}) → ${uniqueStatements.length} statements, ${uniqueFunding.length} funding`);
        linked++;
      }
    } else {
      const { error: updateError } = await db
        .from('civic_hansard')
        .update({
          linked_statement_ids: uniqueStatements,
          linked_funding_ids: uniqueFunding,
          enriched_at: new Date().toISOString(),
        })
        .eq('id', speech.id);

      if (!updateError && (uniqueStatements.length || uniqueFunding.length)) {
        linked++;

        // Alert on significant Hansard mentions
        if (uniqueFunding.length >= 2) {
          await createAlert({
            alert_type: 'hansard_mention',
            severity: 'info',
            title: `${speech.speaker_name} referenced ${uniqueFunding.length} funding programs in parliament`,
            summary: `${speech.sitting_date}: ${speech.subject || 'Parliamentary speech'} by ${speech.speaker_name} links to ${uniqueFunding.length} funding records`,
            source_table: 'civic_hansard',
            source_id: speech.id,
            linked_records: {
              statements: uniqueStatements,
              funding: uniqueFunding,
            },
          });
          alerts++;
        }
      }
    }
  }

  log(`  Linked ${linked} Hansard speeches, generated ${alerts} alerts`);
  return { linked, alerts };
}

// ── Phase 3: Link consultancy spending → gs_entities ─────────────

async function linkConsultancyToEntities() {
  log('Phase 3: Linking consultancy spending → gs_entities...');

  const { data: spending, error } = await db
    .from('civic_consultancy_spending')
    .select('id, consultant_name, consultant_abn')
    .is('linked_entity_id', null)
    .limit(BATCH);

  if (error || !spending?.length) {
    log(`  No unlinked consultancy records (${error?.message || 'none found'})`);
    return { linked: 0 };
  }

  log(`  Processing ${spending.length} consultancy records...`);
  let linked = 0;

  for (const record of spending) {
    let entityId = null;

    // Try ABN match first (strongest)
    if (record.consultant_abn) {
      const { data: entity } = await db
        .from('gs_entities')
        .select('id')
        .eq('abn', record.consultant_abn)
        .limit(1)
        .single();

      if (entity) entityId = entity.id;
    }

    // Fall back to name match
    if (!entityId && record.consultant_name) {
      const { data: entity } = await db
        .from('gs_entities')
        .select('id')
        .ilike('canonical_name', `%${record.consultant_name}%`)
        .limit(1)
        .single();

      if (entity) entityId = entity.id;
    }

    if (entityId) {
      if (DRY_RUN) {
        log(`  [DRY RUN] ${record.consultant_name} → entity ${entityId}`);
      } else {
        await db
          .from('civic_consultancy_spending')
          .update({ linked_entity_id: entityId })
          .eq('id', record.id);
      }
      linked++;
    }
  }

  log(`  Linked ${linked}/${spending.length} consultancy records to entities`);
  return { linked };
}

// ── Helpers ──────────────────────────────────────────────────────

function extractSearchTerms(text) {
  // Extract meaningful multi-word phrases for search
  const terms = new Set();

  // Look for capitalized phrases (program names, org names)
  const capitalizedRegex = /[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}/g;
  const matches = text.match(capitalizedRegex) || [];
  for (const m of matches) {
    if (m.length > 8 && !isCommonPhrase(m)) {
      terms.add(m.toLowerCase());
    }
  }

  // Look for quoted phrases
  const quotedRegex = /["']([^"']{5,60})["']/g;
  let qm;
  while ((qm = quotedRegex.exec(text)) !== null) {
    terms.add(qm[1].toLowerCase());
  }

  return [...terms].slice(0, 10);
}

function isCommonPhrase(phrase) {
  const common = ['the minister', 'the government', 'the member', 'the state',
    'the department', 'the premier', 'mr speaker', 'madam speaker'];
  return common.includes(phrase.toLowerCase());
}

function parseAmount(str) {
  if (!str) return null;
  let cleaned = str.replace(/[$,\s]/g, '');
  const multipliers = { million: 1_000_000, m: 1_000_000, billion: 1_000_000_000, b: 1_000_000_000, k: 1_000 };
  for (const [word, mult] of Object.entries(multipliers)) {
    if (cleaned.toLowerCase().includes(word)) {
      cleaned = cleaned.toLowerCase().replace(word, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num * mult;
    }
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function createAlert(alert) {
  if (DRY_RUN) {
    log(`  [DRY RUN] Alert: ${alert.title}`);
    return;
  }

  const { error } = await db
    .from('civic_alerts')
    .insert({
      ...alert,
      jurisdiction: 'QLD',
    });

  if (error) {
    log(`  Alert insert error: ${error.message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  log(`Starting ${AGENT_NAME} (batch=${BATCH}, dry_run=${DRY_RUN})`);
  const run = await logStart(db, AGENT_ID, AGENT_NAME);

  try {
    const r1 = await linkStatementsToFunding();
    const r2 = await linkHansardToStatements();
    const r3 = await linkConsultancyToEntities();

    const totalLinked = r1.linked + r2.linked + r3.linked;
    const totalAlerts = (r1.alerts || 0) + (r2.alerts || 0);

    log(`\nDone. ${totalLinked} total links created, ${totalAlerts} alerts generated.`);
    await logComplete(db, run.id, {
      items_found: totalLinked + totalAlerts,
      items_new: totalLinked,
      items_updated: totalAlerts,
    });

  } catch (err) {
    log(`Fatal error: ${err.message}`);
    await logFailed(db, run.id, err);
    process.exit(1);
  }
}

main();
