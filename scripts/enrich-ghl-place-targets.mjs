#!/usr/bin/env node
/**
 * Enrich CivicGraph-generated GHL place signals with real organisations.
 *
 * GrantScope remains the source of truth for modelled demand. GHL receives:
 * - a DND research-only place signal;
 * - the strongest locally relevant organisation from goods_procurement_entities;
 * - a public organisational contact only when CivicGraph has an email or phone;
 * - an existing Demand Register opportunity reassigned to that real contact.
 *
 * Dry run (default):
 *   node --env-file=.env --env-file=apps/web/.env.local scripts/enrich-ghl-place-targets.mjs
 *
 * Apply:
 *   node --env-file=.env --env-file=apps/web/.env.local scripts/enrich-ghl-place-targets.mjs --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_ARG >= 0 ? Number.parseInt(process.argv[LIMIT_ARG + 1] || '100', 10) : 100;

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

if (!GHL_API_KEY || !GHL_LOCATION_ID) throw new Error('Missing GHL credentials');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing GrantScope Supabase credentials');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const clean = (value) => String(value || '').trim() || null;

async function ghl(endpoint, options = {}, version = 'v3') {
  const response = await fetch(`${GHL_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: version,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${endpoint}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function allGhlContacts() {
  const rows = [];
  let startAfter;
  let startAfterId;
  for (let page = 0; page < 60; page += 1) {
    const url = new URL(`${GHL_BASE}/contacts/`);
    url.searchParams.set('locationId', GHL_LOCATION_ID);
    url.searchParams.set('limit', '100');
    if (startAfter && startAfterId) {
      url.searchParams.set('startAfter', String(startAfter));
      url.searchParams.set('startAfterId', startAfterId);
    }
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
        Accept: 'application/json',
        Version: '2021-07-28',
      },
    });
    if (!response.ok) throw new Error(`GHL contacts ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const data = await response.json();
    rows.push(...(data.contacts || []));
    if (!data.meta?.nextPage || !data.meta?.startAfterId) break;
    startAfter = data.meta.startAfter;
    startAfterId = data.meta.startAfterId;
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function allGhlOpportunities() {
  const rows = [];
  for (let page = 1; page < 20; page += 1) {
    const data = await ghl(
      `/opportunities/search?location_id=${GHL_LOCATION_ID}&limit=100&page=${page}`,
      {},
      '2021-07-28',
    );
    const batch = data.opportunities || [];
    rows.push(...batch);
    if (batch.length < 100 || rows.length >= (data.meta?.total ?? Infinity)) break;
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function contactCommunityName(contact) {
  const company = String(contact.companyName || '').replace(/,\s*(NT|WA|QLD|SA|NSW|VIC|TAS|ACT)$/i, '');
  return normalize(company || contact.firstName || contact.contactName);
}

function candidateScore(candidate) {
  const entity = candidate.entity;
  const role = normalize(candidate.buyer_role);
  let score = Number(candidate.fit_score || 0);
  if (candidate.is_community_controlled) score += 100;
  if (entity?.email) score += 45;
  if (entity?.phone) score += 25;
  if (candidate.website || entity?.website) score += 15;
  if (role.includes('council')) score += 35;
  else if (role.includes('housing')) score += 30;
  else if (role.includes('store')) score += 25;
  else if (role.includes('health')) score += 20;
  return score;
}

async function loadGrantScopeMatches(placeContacts) {
  const names = [...new Set(placeContacts.map(contactCommunityName).filter(Boolean))];
  const { data: communities, error: communityError } = await supabase
    .from('goods_communities')
    .select('id, community_name, state, postcode, local_government, land_council, known_buyer_name, data_quality_score')
    .in('community_name', names.map((name) => name.toUpperCase()));
  if (communityError) throw communityError;

  const communityIds = (communities || []).map((row) => row.id);
  const { data: procurement, error: procurementError } = communityIds.length
    ? await supabase
      .from('goods_procurement_entities')
      .select('id, community_id, entity_id, entity_name, abn, gs_id, entity_type, buyer_role, fit_score, is_community_controlled, website, contact_surface')
      .in('community_id', communityIds)
    : { data: [], error: null };
  if (procurementError) throw procurementError;

  const entityIds = [...new Set((procurement || []).map((row) => row.entity_id).filter(Boolean))];
  const entities = [];
  for (let offset = 0; offset < entityIds.length; offset += 100) {
    const { data, error } = await supabase
      .from('gs_entities')
      .select('id, canonical_name, abn, gs_id, website, email, phone, contact_source, confidence, is_community_controlled')
      .in('id', entityIds.slice(offset, offset + 100));
    if (error) throw error;
    entities.push(...(data || []));
  }

  const entityById = new Map(entities.map((row) => [row.id, row]));
  const candidatesByCommunity = new Map();
  for (const row of procurement || []) {
    const candidate = { ...row, entity: entityById.get(row.entity_id) || null };
    if (!candidatesByCommunity.has(row.community_id)) candidatesByCommunity.set(row.community_id, []);
    candidatesByCommunity.get(row.community_id).push(candidate);
  }
  for (const candidates of candidatesByCommunity.values()) {
    candidates.sort((left, right) => candidateScore(right) - candidateScore(left));
  }

  const communityByName = new Map((communities || []).map((row) => [normalize(row.community_name), row]));
  return placeContacts.map((contact) => {
    const community = communityByName.get(contactCommunityName(contact)) || null;
    const candidates = community ? candidatesByCommunity.get(community.id) || [] : [];
    return { contact, community, candidate: candidates[0] || null, alternatives: candidates.slice(1, 4) };
  });
}

async function ensureBusiness(candidate, community, businesses) {
  const entity = candidate.entity;
  const name = clean(candidate.entity_name || entity?.canonical_name);
  if (!name) return null;
  const existing = businesses.find((business) => normalize(business.name) === normalize(name));
  const email = clean(entity?.email);
  const phone = clean(entity?.phone);
  const website = clean(candidate.website || entity?.website);
  const description = [
    candidate.buyer_role ? `Community role: ${candidate.buyer_role}.` : null,
    community?.community_name ? `Matched to ${community.community_name}, ${community.state || ''}.` : null,
    candidate.is_community_controlled ? 'Community-controlled organisation.' : null,
    candidate.abn || entity?.abn ? `ABN ${candidate.abn || entity.abn}.` : null,
    candidate.gs_id || entity?.gs_id ? `CivicGraph ${candidate.gs_id || entity.gs_id}.` : null,
    entity?.contact_source ? `Contact source: ${entity.contact_source}.` : null,
  ].filter(Boolean).join(' ');
  const payload = {
    name,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(website ? { website } : {}),
    ...(community?.state ? { state: community.state } : {}),
    ...(community?.community_name ? { city: community.community_name } : {}),
    country: 'au',
    description,
  };
  if (!APPLY) return { ...(existing || {}), ...payload, id: existing?.id || `dry-business:${name}`, created: !existing };
  if (existing) {
    const data = await ghl(`/businesses/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    return { ...(data.business || data), created: false };
  }
  const data = await ghl('/businesses/', {
    method: 'POST',
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, ...payload }),
  });
  const business = { ...(data.business || data), created: true };
  businesses.push(business);
  return business;
}

async function ensureOrganisationContact(candidate, business) {
  const entity = candidate.entity;
  const email = clean(entity?.email);
  const phone = clean(entity?.phone);
  if (!email && !phone) return null;
  if (!APPLY) return { id: `dry-contact:${email || phone}`, email, phone, created: true };

  let contact = null;
  if (email) {
    const duplicate = await ghl(
      `/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(email)}`,
      {},
      '2021-07-28',
    );
    contact = duplicate.contact || null;
  }
  if (!contact && phone) {
    const duplicate = await ghl(
      `/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&number=${encodeURIComponent(phone)}`,
      {},
      '2021-07-28',
    ).catch(() => ({}));
    contact = duplicate.contact || null;
  }
  if (!contact) {
    const data = await ghl('/contacts/', {
      method: 'POST',
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        firstName: business.name.slice(0, 80),
        lastName: 'Public Contact',
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        companyName: business.name,
        dnd: true,
        tags: [
          'project:act-gd',
          'role:organisation-contact',
          'source:civicgraph-enrichment',
          'status:research-enriched',
          'comms:manual-review',
        ],
        source: 'Goods CivicGraph enrichment',
      }),
    }, '2021-07-28');
    contact = data.contact || data;
  }
  const updated = await ghl(`/contacts/${contact.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      businessId: business.id,
      companyName: business.name,
      dnd: true,
    }),
  });
  return { ...(updated.contact || updated), created: !contact.dateAdded };
}

async function markPlaceResearchOnly(contact) {
  const tags = [...new Set([
    ...(contact.tags || []).filter((tag) => !['role:partner', 'role:buyer', 'role:supplier', 'comms:buyer-drip'].includes(tag)),
    'record:place-signal',
    'status:research-only',
    'comms:do-not-contact',
  ])];
  if (!APPLY) return { dnd: true, tags };
  const updated = await ghl(`/contacts/${contact.id}`, {
    method: 'PUT',
    body: JSON.stringify({ dnd: true, tags }),
  });
  return updated.contact || updated;
}

async function main() {
  console.log(`=== Enrich GHL place targets ${APPLY ? '(APPLY)' : '(DRY RUN)'} ===`);
  const [contacts, opportunities, businessData] = await Promise.all([
    allGhlContacts(),
    allGhlOpportunities(),
    ghl(`/businesses/?locationId=${GHL_LOCATION_ID}&limit=100`),
  ]);
  const businesses = businessData.businesses || [];
  const placeContacts = contacts
    .filter((contact) => contact.source === 'CivicGraph Goods Intelligence')
    .slice(0, LIMIT);
  const opportunityByContact = new Map(opportunities.map((row) => [row.contactId, row]));
  const matches = await loadGrantScopeMatches(placeContacts);

  const summary = {
    places: matches.length,
    matchedCommunities: 0,
    matchedOrganisations: 0,
    organisationsWithPublicContact: 0,
    opportunitiesReassigned: 0,
    companiesCreated: 0,
    companiesUpdated: 0,
    researchOnly: 0,
    errors: 0,
  };
  const results = [];

  for (const match of matches) {
    try {
      await markPlaceResearchOnly(match.contact);
      summary.researchOnly += 1;
      if (!match.community) {
        results.push({ place: match.contact.companyName, status: 'no-community-match' });
        continue;
      }
      summary.matchedCommunities += 1;
      if (!match.candidate) {
        results.push({ place: match.community.community_name, status: 'no-organisation-candidate' });
        continue;
      }
      summary.matchedOrganisations += 1;
      const business = await ensureBusiness(match.candidate, match.community, businesses);
      if (!business) {
        results.push({ place: match.community.community_name, status: 'no-business-name' });
        continue;
      }
      if (business.created) summary.companiesCreated += 1;
      else summary.companiesUpdated += 1;

      const organisationContact = await ensureOrganisationContact(match.candidate, business);
      if (organisationContact) {
        summary.organisationsWithPublicContact += 1;
        const opportunity = opportunityByContact.get(match.contact.id);
        if (opportunity && APPLY) {
          await ghl(`/opportunities/${opportunity.id}`, {
            method: 'PUT',
            body: JSON.stringify({ contactId: organisationContact.id }),
          }, '2021-07-28');
          summary.opportunitiesReassigned += 1;
        } else if (opportunity) {
          summary.opportunitiesReassigned += 1;
        }
      }

      results.push({
        place: match.community.community_name,
        organisation: business.name,
        role: match.candidate.buyer_role,
        score: candidateScore(match.candidate),
        publicContact: Boolean(organisationContact),
        opportunity: opportunityByContact.get(match.contact.id)?.name || null,
        status: organisationContact ? 'enriched-contact' : 'enriched-company',
      });
      if (APPLY) await sleep(120);
    } catch (error) {
      summary.errors += 1;
      results.push({
        place: match.community?.community_name || match.contact.companyName,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(JSON.stringify({ summary, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
