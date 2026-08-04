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
 *   - gmail_messages roll-up (count + latest thread signal)
 *   - act_grant_recommendation_decisions roll-up
 *   - relationship_score composite
 *
 * Idempotent: upserts by funder_name. Run nightly.
 *
 * Usage:
 *   node --env-file=.env scripts/refresh-funder-context.mjs [--dry-run] [--act-portfolio] [--funder='Snow Foundation'] [--offset=0] [--limit=50]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const ACT_PORTFOLIO_ONLY = process.argv.includes('--act-portfolio');
const FUNDER_ARG = process.argv.find((a) => a.startsWith('--funder='));
const SINGLE_FUNDER = FUNDER_ARG ? FUNDER_ARG.split('=')[1] : null;
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Math.max(0, Number.parseInt(LIMIT_ARG.split('=')[1] ?? '', 10) || 0) : 0;
const OFFSET_ARG = process.argv.find((a) => a.startsWith('--offset='));
const OFFSET = OFFSET_ARG ? Math.max(0, Number.parseInt(OFFSET_ARG.split('=')[1] ?? '', 10) || 0) : 0;

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

const EMAIL_GENERIC_TOKENS = new Set([
  ...GENERIC_TOKENS,
  'act',
  'arts',
  'art',
  'love',
  'adult',
  'learning',
  'research',
  'education',
  'science',
  'data',
  'gallery',
  'college',
  'school',
  'health',
  'management',
  'youth',
  'first',
  'nations',
  'indigenous',
  'people',
]);

function organisationIdentity(value) {
  return normalise(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token))
    .join(' ');
}

function websiteDomain(value) {
  if (!value) return null;
  try {
    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function emailDomain(value) {
  return String(value ?? '').toLowerCase().split('@')[1]?.replace(/[>,;]+$/, '') || null;
}

function contactMatchesFunder(names, website, companyName, email) {
  const funderDomain = websiteDomain(website);
  const contactDomain = emailDomain(email);
  if (funderDomain && contactDomain && (contactDomain === funderDomain || contactDomain.endsWith(`.${funderDomain}`))) {
    return true;
  }

  const companyTokens = organisationIdentity(companyName).split(' ').filter(Boolean);
  if (!companyTokens.length) return false;
  return names.some((name) => {
    const required = organisationIdentity(name).split(' ').filter(Boolean).slice(0, 3);
    if (!required.length || !required.every((token) => companyTokens.includes(token))) return false;
    return required.length > 1 || companyTokens.length === 1;
  });
}

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

function distinctiveTokens(name) {
  return normalise(name)
    .split(' ')
    .filter((w) => w.length >= 3 && !GENERIC_TOKENS.has(w));
}

function emailSearchNeedles(names) {
  const needles = new Set();
  for (const name of names) {
    const tokens = distinctiveTokens(name)
      .filter((token) => token.length >= 6 && !EMAIL_GENERIC_TOKENS.has(token));

    for (const token of tokens.slice(0, 3)) {
      needles.add(token);
    }

    if (tokens.length >= 2) {
      needles.add(tokens.slice(0, 3).join(' '));
    }
  }
  return Array.from(needles).slice(0, 8);
}

function compactEmailText(value, limit = 220) {
  const text = String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function emailSummary(rows) {
  if (!rows.length) return null;
  const latest = rows[0];
  const subjects = Array.from(new Set(rows.map((row) => compactEmailText(row.subject, 90)).filter(Boolean))).slice(0, 3);
  const people = Array.from(new Set(rows.map((row) => compactEmailText(row.from_name || row.from_email, 60)).filter(Boolean))).slice(0, 3);
  const latestSubject = compactEmailText(latest.subject, 100) || 'No subject';
  const latestSender = compactEmailText(latest.from_name || latest.from_email, 70) || 'Unknown sender';
  const latestSnippet = compactEmailText(latest.snippet || latest.body_text, 180);
  const subjectLine = subjects.length > 1 ? `Threads: ${subjects.join(' · ')}.` : '';
  const peopleLine = people.length ? `People: ${people.join(' · ')}.` : '';
  const snippetLine = latestSnippet ? `Latest note: ${latestSnippet}` : '';
  return compactEmailText(
    `Latest: ${latestSubject} from ${latestSender}. ${subjectLine} ${peopleLine} ${snippetLine}`,
    520,
  );
}

let gmailMessagesCache = null;

async function loadGmailMessages() {
  if (gmailMessagesCache) return gmailMessagesCache;

  const [{ data, error }, { data: contextEvents, error: contextError }] = await Promise.all([
    supabase
      .from('gmail_messages')
      .select('subject, snippet, from_name, from_email, body_text, keywords, received_date, sent_date, synced_at, created_at')
      .limit(5000),
    supabase
      .from('opportunity_context_events')
      .select('title, summary, actor_name, actor_email, organisation, happened_at, updated_at')
      .eq('source_system', 'gmail')
      .limit(5000),
  ]);

  if (error) {
    console.warn(`  Gmail mirror load skipped: ${error.message}`);
  }
  if (contextError) console.warn(`  Structured Gmail context load skipped: ${contextError.message}`);

  const mirrorRows = data ?? [];
  const structuredRows = (contextEvents ?? []).map((event) => ({
    organisation: event.organisation,
    subject: event.title,
    snippet: event.summary,
    from_name: event.actor_name,
    from_email: event.actor_email,
    body_text: null,
    keywords: [event.organisation].filter(Boolean),
    received_date: event.happened_at,
    sent_date: null,
    synced_at: event.updated_at,
    created_at: event.updated_at,
  }));

  gmailMessagesCache = [...mirrorRows, ...structuredRows].map((row) => ({
    ...row,
    message_date: row.received_date ?? row.sent_date ?? row.synced_at ?? row.created_at ?? null,
    haystack: [
      row.subject,
      row.snippet,
      row.from_name,
      row.from_email,
      row.body_text,
      ...(Array.isArray(row.keywords) ? row.keywords : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  }));
  return gmailMessagesCache;
}

async function collectEmailContext(names) {
  const needles = emailSearchNeedles(names);
  const messages = await loadGmailMessages();
  const nameKeys = new Set(names.map((name) => organisationIdentity(name)).filter(Boolean));
  const exactOrganisationRows = messages.filter(
    (row) => row.organisation && nameKeys.has(organisationIdentity(row.organisation)),
  );
  const candidates = exactOrganisationRows.length > 0
    ? exactOrganisationRows
    : needles.length > 0
      ? messages.filter((row) => needles.some((needle) => row.haystack.includes(needle)))
      : [];
  const recent = candidates
    .sort((left, right) => new Date(right.message_date ?? 0).getTime() - new Date(left.message_date ?? 0).getTime())
    .slice(0, 5);
  const latest = recent[0]?.message_date ?? null;

  return {
    email_count: recent.length,
    email_last_date: latest,
    email_summary: emailSummary(recent),
  };
}

async function collectFunderNames() {
  const seen = new Set();
  const sources = [];

  if (!ACT_PORTFOLIO_ONLY) {
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
  }

  // ACT's working portfolio is the primary relationship surface. Include every
  // matched foundation even when it has not appeared in ALMA, an allowlist, or Xero.
  const { data: actProfile } = await supabase
    .from('org_profiles')
    .select('id')
    .eq('slug', 'act')
    .maybeSingle();
  if (actProfile?.id) {
    const { data: portfolioRows } = await supabase
      .from('org_project_foundations')
      .select('foundation_id, foundation:foundations(id, name)')
      .eq('org_profile_id', actProfile.id);
    const seenNormalised = new Set([...seen].map((name) => normalise(name)));
    for (const row of portfolioRows ?? []) {
      const foundation = Array.isArray(row.foundation) ? row.foundation[0] : row.foundation;
      const name = foundation?.name;
      const key = normalise(name);
      if (!name || !key) continue;
      if (seenNormalised.has(key)) {
        const existing = sources.find((source) => normalise(source.funder_name) === key);
        if (existing && !existing.foundation_id) existing.foundation_id = foundation?.id ?? row.foundation_id;
        continue;
      }
      seen.add(name);
      seenNormalised.add(key);
      sources.push({ funder_name: name, foundation_id: foundation?.id ?? row.foundation_id, source: 'act_portfolio' });
    }
  }

  // Every Xero ACCREC payer is a real counterparty — surface them in the
  // snapshot so /org/act dashboard + kanban Won column see consistent context.
  // Case-insensitive dedup against names already seen from alma/allowlist.
  if (!ACT_PORTFOLIO_ONLY) {
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
  }

  return sources;
}

async function buildDossier(funderName, aliases = [], canonicalFoundationId = null) {
  const allNames = [funderName, ...(aliases ?? [])].filter(Boolean);
  const patterns = Array.from(new Set(allNames.flatMap(ilikeAny)));

  // foundations match — best by ILIKE
  let foundationQuery = supabase
    .from('foundations')
    .select('id, name, acnc_abn, total_giving_annual, thematic_focus, geographic_focus, website');
  foundationQuery = canonicalFoundationId
    ? foundationQuery.eq('id', canonicalFoundationId)
    : foundationQuery.or(patterns.map((p) => `name.ilike.${p}`).join(','));
  const { data: foundationMatches } = await foundationQuery
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(1);
  const foundation = foundationMatches?.[0] ?? null;

  // ghl_contacts — ACT's people at this funder
  const ghlOrFilters = [
    ...patterns.map((p) => `company_name.ilike.${p}`),
    ...(websiteDomain(foundation?.website) ? [`email.ilike.%@${websiteDomain(foundation.website)}`] : []),
  ];
  const { data: rawGhl } = await supabase
    .from('ghl_contacts')
    .select('full_name, email, last_contact_date, company_name')
    .or(ghlOrFilters.join(','))
    .order('last_contact_date', { ascending: false, nullsFirst: false })
    .limit(200);
  const ghl = (rawGhl ?? []).filter((contact) => contactMatchesFunder(
    allNames,
    foundation?.website,
    contact.company_name,
    contact.email,
  )).slice(0, 20);

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

  // gmail_messages — local read-only mailbox mirror, summary only.
  const emailContext = await collectEmailContext(allNames);

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
  const emailDays = emailContext.email_last_date
    ? Math.floor((Date.now() - new Date(emailContext.email_last_date).getTime()) / (1000 * 60 * 60 * 24))
    : 9999;
  const emailPoints = emailContext.email_count <= 0
    ? 0
    : emailDays < 90
      ? 12
      : emailDays < 365
        ? 8
        : 3;
  const relationshipScore = xeroPoints + contactPoints + decisionPoints + granteePoints + emailPoints;

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
    email_count: emailContext.email_count,
    email_last_date: emailContext.email_last_date,
    email_summary: emailContext.email_summary,
    decisions: decisionCounts,
    total_decisions: totalDecisions,
    relationship_score: relationshipScore,
    refreshed_at: new Date().toISOString(),
  };
}

async function run() {
  const runRow = DRY_RUN ? { id: null } : await logStart(supabase, AGENT_ID, 'Refresh funder context snapshots');
  const runId = runRow?.id ?? null;
  const startedAt = Date.now();

  try {
    let funders = await collectFunderNames();
    if (SINGLE_FUNDER) {
      funders = funders.filter((f) => f.funder_name === SINGLE_FUNDER);
      if (!funders.length) funders = [{ funder_name: SINGLE_FUNDER, source: 'manual' }];
    }
    if (OFFSET > 0 || LIMIT > 0) {
      funders = funders.slice(OFFSET, LIMIT > 0 ? OFFSET + LIMIT : undefined);
    }
    console.log(`Refreshing ${funders.length} funders${DRY_RUN ? ' [dry-run]' : ''}`);

    let upserted = 0, failed = 0;
    for (const f of funders) {
      try {
        const dossier = await buildDossier(f.funder_name, f.aliases, f.foundation_id);
        if (DRY_RUN) {
          console.log(`  [dry] ${f.funder_name}: score=${dossier.relationship_score} · paid=$${dossier.xero_paid_total} · contacts=${dossier.contacts_count} · emails=${dossier.email_count} · grantees=${dossier.grantee_count}`);
        } else {
          const { error } = await supabase
            .from('funder_context_snapshot')
            .upsert(dossier, { onConflict: 'funder_name' });
          if (error) {
            console.error(`  FAILED ${f.funder_name}:`, error.message);
            failed++;
          } else {
            upserted++;
            console.log(`  ${f.funder_name.slice(0,50).padEnd(50)} score=${dossier.relationship_score} paid=$${Math.round(dossier.xero_paid_total).toLocaleString()} ctx=${dossier.contacts_count}/${dossier.email_count}/${dossier.grantee_count}/${dossier.total_decisions}`);
          }
        }
      } catch (err) {
        console.error(`  FAILED ${f.funder_name}:`, err.message);
        failed++;
      }
    }

    console.log(`\nDone in ${(Date.now() - startedAt) / 1000}s: upserted=${upserted} failed=${failed} of ${funders.length}`);
    if (!DRY_RUN && runId) {
      await logComplete(supabase, runId, {
        items_found: funders.length,
        items_new: upserted,
        items_updated: 0,
        metadata: { failed },
      });
    }
  } catch (err) {
    console.error('refresh-funder-context failed:', err);
    if (!DRY_RUN && runId) await logFailed(supabase, runId, err);
    process.exit(1);
  }
}

run();
