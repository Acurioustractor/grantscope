#!/usr/bin/env node
/**
 * Refresh funder_context_snapshot from all source tables.
 *
 * For each unique funder_name appearing in alma_funding_opportunities OR
 * funder_allowlist, compute:
 *   - foundations profile match (fuzzy by name + abn)
 *   - ghl_contacts roll-up (count + recent contact)
 *   - foundation_grantees roll-up
 *   - xero_invoices/payments roll-up
 *   - notion_organizations match
 *   - act_grant_recommendation_decisions roll-up
 *   - relationship_score composite
 *
 * Idempotent: upserts by funder_name. Run nightly.
 *
 * Usage:
 *   node --env-file=.env scripts/refresh-funder-context.mjs [--dry-run] [--funder='Snow Foundation']
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const FUNDER_ARG = process.argv.find((a) => a.startsWith('--funder='));
const SINGLE_FUNDER = FUNDER_ARG ? FUNDER_ARG.split('=')[1] : null;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AGENT_ID = 'refresh-funder-context';

function normalise(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/\bpty\.?\s*ltd\.?\b/g, '')
    .replace(/\blimited\b/g, '')
    .replace(/\btrustee\s+for\s+(the\s+)?/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const GENERIC_TOKENS = new Set([
  'foundation','trust','limited','ltd','pty','inc','incorporated','the','for','and',
  'of','family','community','national','australia','australian','public','ancillary',
  'fund','funds','group','foundation\'s','company','corporation','services','project',
  'department','government','agency','council','office'
]);

function ilikeAny(name) {
  // Build ILIKE patterns that require DISTINCTIVE tokens (drop generic words).
  // BHP Foundation → distinctive=['bhp'] → pattern '%bhp%' (matches BHP rows only)
  // The Trustee For The Snow Foundation → distinctive=['snow'] → '%snow%'
  const tokens = normalise(name).split(' ').filter((w) => w.length >= 3 && !GENERIC_TOKENS.has(w));
  if (!tokens.length) return [`%${name}%`];
  const distinct = tokens.slice(0, 3);
  // Tight pattern: all distinctive tokens must appear (in any order)
  const tight = `%${distinct.join('%')}%`;
  // Fallback: original full name
  return Array.from(new Set([tight, `%${name}%`]));
}

async function collectFunderNames() {
  const seen = new Set();
  const sources = [];

  const { data: alma } = await supabase
    .from('alma_funding_opportunities')
    .select('funder_name');
  for (const r of alma ?? []) {
    if (r.funder_name && !seen.has(r.funder_name)) {
      seen.add(r.funder_name);
      sources.push({ funder_name: r.funder_name, source: 'alma' });
    }
  }

  const { data: allow } = await supabase
    .from('funder_allowlist')
    .select('funder_name, funder_aliases');
  for (const r of allow ?? []) {
    if (r.funder_name && !seen.has(r.funder_name)) {
      seen.add(r.funder_name);
      sources.push({ funder_name: r.funder_name, source: 'allowlist', aliases: r.funder_aliases });
    }
  }

  // Every Xero ACCREC payer is a real counterparty — surface them in the
  // snapshot so /org/act dashboard + kanban Won column see consistent context.
  // Case-insensitive dedup against names already seen from alma/allowlist.
  const seenLower = new Set([...seen].map((n) => n.toLowerCase()));
  const { data: xeroPayers } = await supabase
    .from('xero_invoices')
    .select('contact_name')
    .eq('type', 'ACCREC')
    .in('status', ['PAID', 'AUTHORISED', 'DRAFT']);
  const xeroNames = new Set();
  for (const r of xeroPayers ?? []) {
    if (r.contact_name) xeroNames.add(r.contact_name);
  }
  for (const name of xeroNames) {
    if (seenLower.has(name.toLowerCase())) continue;
    seen.add(name);
    seenLower.add(name.toLowerCase());
    sources.push({ funder_name: name, source: 'xero' });
  }

  return sources;
}

async function buildDossier(funderName, aliases = []) {
  const allNames = [funderName, ...(aliases ?? [])].filter(Boolean);
  const patterns = Array.from(new Set(allNames.flatMap(ilikeAny)));

  // foundations match — best by ILIKE
  const { data: foundationMatches } = await supabase
    .from('foundations')
    .select('id, name, acnc_abn, total_giving_annual, thematic_focus, geographic_focus, website')
    .or(patterns.map((p) => `name.ilike.${p}`).join(','))
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(1);
  const foundation = foundationMatches?.[0] ?? null;

  // ghl_contacts — ACT's people at this funder
  const { data: ghl } = await supabase
    .from('ghl_contacts')
    .select('full_name, email, last_contact_date, company_name')
    .or(patterns.map((p) => `company_name.ilike.${p}`).join(','))
    .order('last_contact_date', { ascending: false, nullsFirst: false })
    .limit(20);

  // foundation_grantees — what they've funded
  let granteeCount = 0;
  let recentGrantees = [];
  if (foundation?.id) {
    const { count } = await supabase
      .from('foundation_grantees')
      .select('*', { count: 'exact', head: true })
      .eq('foundation_id', foundation.id);
    granteeCount = count ?? 0;

    const { data: gs } = await supabase
      .from('foundation_grantees')
      .select('grantee_name')
      .eq('foundation_id', foundation.id)
      .order('grant_year', { ascending: false, nullsFirst: false })
      .limit(5);
    recentGrantees = Array.from(new Set((gs ?? []).map((g) => g.grantee_name).filter(Boolean)));
  }

  // xero_invoices — ACT ↔ funder financial flow
  const { data: xero } = await supabase
    .from('xero_invoices')
    .select('total, status, type, date')
    .or(patterns.map((p) => `contact_name.ilike.${p}`).join(','));
  let invoicedTotal = 0, paidTotal = 0, authorisedTotal = 0;
  let lastInvoiceDate = null, lastPaymentDate = null;
  for (const inv of xero ?? []) {
    const amt = Number(inv.total ?? 0);
    if (inv.type === 'ACCREC') {
      invoicedTotal += amt;
      if (!lastInvoiceDate || inv.date > lastInvoiceDate) lastInvoiceDate = inv.date;
      if (inv.status === 'PAID') {
        paidTotal += amt;
        if (!lastPaymentDate || inv.date > lastPaymentDate) lastPaymentDate = inv.date;
      } else if (inv.status === 'AUTHORISED') {
        authorisedTotal += amt;
      }
    }
  }

  // notion_organizations match
  const { data: notion } = await supabase
    .from('notion_organizations')
    .select('notion_id, name')
    .or(patterns.map((p) => `name.ilike.${p}`).join(','))
    .limit(1);
  const notionOrg = notion?.[0] ?? null;

  // act_grant_recommendation_decisions per funder
  // The decisions table joins back to opportunity_id → alma → funder_name
  const { data: ourOpps } = await supabase
    .from('alma_funding_opportunities')
    .select('id')
    .eq('funder_name', funderName);
  const oppIds = (ourOpps ?? []).map((o) => o.id);
  let decisionCounts = {};
  let totalDecisions = 0;
  if (oppIds.length) {
    const { data: dec } = await supabase
      .from('act_grant_recommendation_decisions')
      .select('decision')
      .in('opportunity_id', oppIds);
    for (const d of dec ?? []) {
      decisionCounts[d.decision] = (decisionCounts[d.decision] ?? 0) + 1;
      totalDecisions++;
    }
  }

  // Relationship score (0-100)
  const xeroPoints = Math.min(40, Math.floor((paidTotal + authorisedTotal) / 10000) * 2); // $5K = 1 pt, capped 40
  const recencyDays = ghl?.[0]?.last_contact_date
    ? Math.floor((Date.now() - new Date(ghl[0].last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
    : 9999;
  const contactPoints = recencyDays < 30 ? 20 : recencyDays < 90 ? 15 : recencyDays < 180 ? 10 : recencyDays < 365 ? 5 : 0;
  const decisionPoints = Math.min(20, totalDecisions * 5);
  const granteePoints = Math.min(20, Math.floor(granteeCount / 5));
  const relationshipScore = xeroPoints + contactPoints + decisionPoints + granteePoints;

  return {
    funder_name: funderName,
    funder_aliases: aliases,
    foundation_id: foundation?.id ?? null,
    abn: foundation?.acnc_abn ?? null,
    annual_giving: foundation?.total_giving_annual ?? null,
    thematic_focus: foundation?.thematic_focus ?? [],
    geographic_focus: foundation?.geographic_focus ?? [],
    website: foundation?.website ?? null,
    contacts_count: ghl?.length ?? 0,
    contacts: (ghl ?? []).slice(0, 10).map((c) => ({
      name: c.full_name,
      email: c.email,
      last_contact_date: c.last_contact_date,
    })),
    most_recent_contact_at: ghl?.[0]?.last_contact_date ?? null,
    grantee_count: granteeCount,
    recent_grantees: recentGrantees,
    xero_invoiced_total: invoicedTotal,
    xero_paid_total: paidTotal,
    xero_authorised_total: authorisedTotal,
    xero_last_invoice_date: lastInvoiceDate,
    xero_last_payment_date: lastPaymentDate,
    notion_org_id: notionOrg?.notion_id ?? null,
    notion_org_name: notionOrg?.name ?? null,
    decisions: decisionCounts,
    total_decisions: totalDecisions,
    relationship_score: relationshipScore,
    refreshed_at: new Date().toISOString(),
  };
}

async function run() {
  const runRow = await logStart(supabase, AGENT_ID, 'Refresh funder context snapshots');
  const runId = runRow?.id ?? null;
  const startedAt = Date.now();

  try {
    let funders = await collectFunderNames();
    if (SINGLE_FUNDER) {
      funders = funders.filter((f) => f.funder_name === SINGLE_FUNDER);
      if (!funders.length) funders = [{ funder_name: SINGLE_FUNDER, source: 'manual' }];
    }
    console.log(`Refreshing ${funders.length} funders${DRY_RUN ? ' [dry-run]' : ''}`);

    let upserted = 0, failed = 0;
    for (const f of funders) {
      try {
        const dossier = await buildDossier(f.funder_name, f.aliases);
        if (DRY_RUN) {
          console.log(`  [dry] ${f.funder_name}: score=${dossier.relationship_score} · paid=$${dossier.xero_paid_total} · contacts=${dossier.contacts_count} · grantees=${dossier.grantee_count}`);
        } else {
          const { error } = await supabase
            .from('funder_context_snapshot')
            .upsert(dossier, { onConflict: 'funder_name' });
          if (error) {
            console.error(`  FAILED ${f.funder_name}:`, error.message);
            failed++;
          } else {
            upserted++;
            console.log(`  ${f.funder_name.slice(0,50).padEnd(50)} score=${dossier.relationship_score} paid=$${Math.round(dossier.xero_paid_total).toLocaleString()} ctx=${dossier.contacts_count}/${dossier.grantee_count}/${dossier.total_decisions}`);
          }
        }
      } catch (err) {
        console.error(`  FAILED ${f.funder_name}:`, err.message);
        failed++;
      }
    }

    console.log(`\nDone in ${(Date.now() - startedAt) / 1000}s: upserted=${upserted} failed=${failed} of ${funders.length}`);
    if (runId) {
      await logComplete(supabase, runId, {
        items_found: funders.length,
        items_new: upserted,
        items_updated: 0,
        metadata: { failed },
      });
    }
  } catch (err) {
    console.error('refresh-funder-context failed:', err);
    if (runId) await logFailed(supabase, runId, err);
    process.exit(1);
  }
}

run();
