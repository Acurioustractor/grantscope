#!/usr/bin/env node

/**
 * Link ACT's curated contacts and unlinked GHL companies to CivicGraph entities.
 *
 * Safety rules:
 * - never overwrite an existing entity link
 * - GHL-to-CivicGraph links belong in contact_entity_links; the similarly named
 *   ghl_contacts.canonical_entity_id points to a different legacy entity table
 * - accept only a unique foundation name, unique organisation website domain,
 *   or unique exact canonical entity name
 * - leave abbreviations, generic organisations, and ambiguous matches alone
 *
 * Usage:
 *   node --env-file=.env scripts/link-act-crm-entities.mjs
 *   node --env-file=.env scripts/link-act-crm-entities.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const GENERIC_ORGANISATIONS = new Set([
  'independent',
  'self employed',
  'self employed youth justice',
  'bigpond',
  'axt',
]);

const GENERIC_TOKENS = new Set([
  'the', 'pty', 'ltd', 'limited', 'inc', 'incorporated', 'company', 'corporation',
  'trustee', 'for', 'trust', 'group', 'organisation', 'organization', 'australia',
  'australian', 'foundation', 'community', 'services', 'service', 'department',
]);

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.au', 'outlook.com',
  'live.com', 'live.com.au', 'icloud.com', 'me.com', 'yahoo.com', 'yahoo.com.au',
  'bigpond.com', 'bigpond.net.au',
]);

const SHARED_ORGANISATION_DOMAINS = new Set([
  'act.gov.au', 'nsw.gov.au', 'nt.gov.au', 'qld.gov.au', 'sa.gov.au', 'tas.gov.au',
  'vic.gov.au', 'wa.gov.au',
]);

function normaliseOrganisation(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bthe\s+trustee\s+for\s+(the\s+)?/g, ' ')
    .replace(/\btrustee\s+for\s+(the\s+)?/g, ' ')
    .replace(/\bpty\.?\s*ltd\.?\b/g, ' ')
    .replace(/\blimited\b|\bincorporated\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function domainFromEmail(value) {
  const domain = String(value ?? '').toLowerCase().split('@')[1]?.replace(/[>,;]+$/, '') || null;
  return domain && !PUBLIC_EMAIL_DOMAINS.has(domain) && !SHARED_ORGANISATION_DOMAINS.has(domain)
    ? domain
    : null;
}

function domainFromWebsite(value) {
  if (!value) return null;
  try {
    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function uniqueByEntity(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (row.entityId) byId.set(row.entityId, row);
  }
  return [...byId.values()];
}

async function loadAllFoundations() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('foundations')
      .select('id, name, website, gs_entity_id')
      .not('gs_entity_id', 'is', null)
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

async function loadAllHighConfidenceAliases() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('name_aliases')
      .select('alias_name, canonical_entity_id, match_method, confidence')
      .eq('confidence', 'high')
      .not('canonical_entity_id', 'is', null)
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const entityNames = new Map();
  const entityIds = [...new Set(rows.map((row) => row.canonical_entity_id).filter(Boolean))];
  for (let offset = 0; offset < entityIds.length; offset += 100) {
    const { data, error } = await supabase
      .from('gs_entities')
      .select('id, canonical_name')
      .in('id', entityIds.slice(offset, offset + 100));
    if (error) throw error;
    for (const entity of data ?? []) entityNames.set(entity.id, entity.canonical_name);
  }
  return rows.map((row) => ({ ...row, canonical_name: entityNames.get(row.canonical_entity_id) ?? null }));
}

function buildIdentityIndexes(foundations, aliases) {
  const byName = new Map();
  const byDomain = new Map();
  const byAlias = new Map();
  for (const foundation of foundations) {
    const candidate = {
      entityId: foundation.gs_entity_id,
      entityName: foundation.name,
      method: 'foundation_exact',
    };
    const nameKey = normaliseOrganisation(foundation.name);
    if (nameKey) byName.set(nameKey, [...(byName.get(nameKey) ?? []), candidate]);
    const domain = domainFromWebsite(foundation.website);
    if (domain) byDomain.set(domain, [...(byDomain.get(domain) ?? []), { ...candidate, method: 'foundation_domain' }]);
  }
  for (const alias of aliases) {
    const key = normaliseOrganisation(alias.alias_name);
    if (!key || GENERIC_ORGANISATIONS.has(key)) continue;
    const candidate = {
      entityId: alias.canonical_entity_id,
      entityName: alias.canonical_name || alias.alias_name,
      method: `alias_${alias.match_method}`,
    };
    byAlias.set(key, [...(byAlias.get(key) ?? []), candidate]);
  }
  return { byName, byDomain, byAlias };
}

function distinctiveNeedle(value) {
  return normaliseOrganisation(value)
    .split(' ')
    .filter((token) => token.length >= 4 && !GENERIC_TOKENS.has(token))
    .sort((left, right) => right.length - left.length)[0] ?? null;
}

function looksOrganisational(value) {
  return /\b(foundation|department|council|university|network|group|government|authority|association|college|fund|australia|australian|enterprise|services?)\b/i.test(String(value ?? ''));
}

async function resolveExactIdentity(value, indexes, entityCache) {
  const key = normaliseOrganisation(value);
  if (!key || GENERIC_ORGANISATIONS.has(key)) return { status: 'skipped', reason: 'generic_or_empty' };

  const foundationCandidates = uniqueByEntity(indexes.byName.get(key) ?? []);
  if (foundationCandidates.length === 1) return { status: 'matched', ...foundationCandidates[0] };
  if (foundationCandidates.length > 1) return { status: 'ambiguous', reason: `foundation:${key}` };

  const aliasCandidates = uniqueByEntity(indexes.byAlias.get(key) ?? []);
  if (aliasCandidates.length === 1) return { status: 'matched', ...aliasCandidates[0] };
  if (aliasCandidates.length > 1) return { status: 'ambiguous', reason: `alias:${key}` };

  if (!entityCache.has(key)) entityCache.set(key, await exactEntityCandidates(value));
  const entityCandidates = entityCache.get(key);
  if (entityCandidates.length === 1) return { status: 'matched', ...entityCandidates[0] };
  if (entityCandidates.length > 1) return { status: 'ambiguous', reason: `entity:${key}` };
  return { status: 'unmatched', reason: 'no_unique_exact_identity' };
}

async function exactEntityCandidates(organisation) {
  const key = normaliseOrganisation(organisation);
  const needle = distinctiveNeedle(organisation);
  if (!key || !needle || GENERIC_ORGANISATIONS.has(key)) return [];
  const { data: exactRows, error: exactError } = await supabase
    .from('gs_entities')
    .select('id, canonical_name')
    .ilike('canonical_name', organisation)
    .limit(25);
  if (exactError) throw exactError;
  const exactCandidates = uniqueByEntity((exactRows ?? [])
    .filter((entity) => normaliseOrganisation(entity.canonical_name) === key)
    .map((entity) => ({ entityId: entity.id, entityName: entity.canonical_name, method: 'entity_exact' })));
  if (exactCandidates.length > 0) return exactCandidates;

  const { data, error } = await supabase
    .from('gs_entities')
    .select('id, canonical_name')
    .ilike('canonical_name', `%${needle}%`)
    .limit(100);
  if (error) throw error;
  return uniqueByEntity((data ?? [])
    .filter((entity) => normaliseOrganisation(entity.canonical_name) === key)
    .map((entity) => ({ entityId: entity.id, entityName: entity.canonical_name, method: 'entity_exact' })));
}

async function exactEntityDomainCandidates(domain) {
  const { data, error } = await supabase
    .from('gs_entities')
    .select('id, canonical_name, website')
    .ilike('website', `%${domain}%`)
    .limit(25);
  if (error) throw error;
  return uniqueByEntity((data ?? [])
    .filter((entity) => domainFromWebsite(entity.website) === domain)
    .map((entity) => ({
      entityId: entity.id,
      entityName: entity.canonical_name,
      method: 'entity_domain',
    })));
}

async function resolveContact(contact, indexes, entityCache, domainCache) {
  const organisationKey = normaliseOrganisation(contact.organisation);
  if (!organisationKey || GENERIC_ORGANISATIONS.has(organisationKey)) {
    return { status: 'skipped', reason: 'generic_or_empty' };
  }

  const emailDomain = domainFromEmail(contact.email);
  if (emailDomain) {
    const domainCandidates = uniqueByEntity(indexes.byDomain.get(emailDomain) ?? []);
    if (domainCandidates.length === 1) return { status: 'matched', ...domainCandidates[0] };
    if (domainCandidates.length > 1) return { status: 'ambiguous', reason: `domain:${emailDomain}` };

    if (!domainCache.has(emailDomain)) {
      domainCache.set(emailDomain, await exactEntityDomainCandidates(emailDomain));
    }
    const entityDomainCandidates = domainCache.get(emailDomain);
    if (entityDomainCandidates.length === 1) return { status: 'matched', ...entityDomainCandidates[0] };
    if (entityDomainCandidates.length > 1) return { status: 'ambiguous', reason: `entity_domain:${emailDomain}` };
  }

  const organisationResult = await resolveExactIdentity(contact.organisation, indexes, entityCache);
  if (organisationResult.status !== 'unmatched') return organisationResult;

  const nameDiffers = normaliseOrganisation(contact.name) !== normaliseOrganisation(contact.organisation);
  if (!contact.email && nameDiffers && looksOrganisational(contact.name)) {
    const displayNameResult = await resolveExactIdentity(contact.name, indexes, entityCache);
    if (displayNameResult.status === 'matched') {
      return { ...displayNameResult, method: `display_${displayNameResult.method}` };
    }
    if (displayNameResult.status === 'ambiguous') return displayNameResult;
  }
  return organisationResult;
}

async function updateMatches(table, column, matches) {
  let updated = 0;
  for (const match of matches) {
    const { error } = await supabase
      .from(table)
      .update({ [column]: match.entityId })
      .eq('id', match.id)
      .is(column, null);
    if (error) throw new Error(`${table}:${match.id}: ${error.message}`);
    updated++;
  }
  return updated;
}

async function upsertGhlEntityLinks(matches) {
  if (!matches.length) return 0;
  const rows = matches.map((match) => ({
    contact_id: match.id,
    entity_id: match.entityId,
    confidence_score: match.method.endsWith('_domain') ? 0.98 : 0.95,
    link_method: match.method.endsWith('_domain') ? 'email_domain' : 'fuzzy_name',
    link_evidence: {
      source: 'link-act-crm-entities',
      organisation: match.organisation,
      matched_entity: match.entityName,
      exact_identity: true,
    },
    verified: false,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('contact_entity_links')
    .upsert(rows, { onConflict: 'contact_id,entity_id' });
  if (error) throw error;
  return rows.length;
}

async function main() {
  const { data: actProfile, error: profileError } = await supabase
    .from('org_profiles')
    .select('id')
    .eq('slug', 'act')
    .single();
  if (profileError) throw profileError;

  const [
    { data: orgContacts, error: orgError },
    { data: ghlContacts, error: ghlError },
    { data: existingGhlLinks, error: linkError },
    foundations,
    aliases,
  ] = await Promise.all([
    supabase
      .from('org_contacts')
      .select('id, name, email, organisation')
      .eq('org_profile_id', actProfile.id)
      .is('linked_entity_id', null)
      .neq('organisation', ''),
    supabase
      .from('ghl_contacts')
      .select('id, full_name, email, company_name')
      .is('canonical_entity_id', null)
      .neq('company_name', ''),
    supabase.from('contact_entity_links').select('contact_id'),
    loadAllFoundations(),
    loadAllHighConfidenceAliases(),
  ]);
  if (orgError) throw orgError;
  if (ghlError) throw ghlError;
  if (linkError) throw linkError;

  const indexes = buildIdentityIndexes(foundations, aliases);
  const entityCache = new Map();
  const domainCache = new Map();
  const graphLinkedGhlIds = new Set((existingGhlLinks ?? []).map((link) => link.contact_id));
  const sources = [
    ...(orgContacts ?? []).map((contact) => ({ source: 'org_contacts', id: contact.id, name: contact.name, email: contact.email, organisation: contact.organisation })),
    ...(ghlContacts ?? [])
      .filter((contact) => !graphLinkedGhlIds.has(contact.id))
      .map((contact) => ({ source: 'ghl_contacts', id: contact.id, name: contact.full_name, email: contact.email, organisation: contact.company_name })),
  ];
  const results = [];
  for (const contact of sources) {
    results.push({ ...contact, ...(await resolveContact(contact, indexes, entityCache, domainCache)) });
  }

  const matches = results.filter((result) => result.status === 'matched');
  const counts = Object.groupBy(results, (result) => `${result.source}:${result.status}`);
  console.log(`ACT CRM entity linker${APPLY ? ' [apply]' : ' [dry-run]'}`);
  for (const [key, rows] of Object.entries(counts)) console.log(`  ${key}: ${rows.length}`);
  for (const match of matches) {
    console.log(`  ${match.source}: ${match.name || '(unnamed)'} · ${match.organisation} -> ${match.entityName} [${match.method}]`);
  }

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to persist unique exact matches.');
    return;
  }

  const orgMatches = matches.filter((match) => match.source === 'org_contacts');
  const ghlMatches = matches.filter((match) => match.source === 'ghl_contacts');
  const orgUpdated = await updateMatches('org_contacts', 'linked_entity_id', orgMatches);
  const ghlUpdated = await upsertGhlEntityLinks(ghlMatches);
  console.log(`\nUpdated ${orgUpdated} ACT contacts and ${ghlUpdated} GHL-to-CivicGraph links.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
