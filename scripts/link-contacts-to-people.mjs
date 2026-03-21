#!/usr/bin/env node

/**
 * Link org_contacts → person_identity_map
 *
 * For each org_contact, fuzzy-matches by organisation name to find real people
 * in person_identity_map. Links the best match and enriches with LinkedIn URL.
 *
 * Runs across ALL org profiles (agentic, scheduled).
 *
 * Usage:
 *   node --env-file=.env scripts/link-contacts-to-people.mjs
 *   node --env-file=.env scripts/link-contacts-to-people.mjs --org=justicehub
 *   node --env-file=.env scripts/link-contacts-to-people.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const orgArg = process.argv.find(a => a.startsWith('--org='));
const ORG_FILTER = orgArg ? orgArg.split('=')[1] : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stats = { total: 0, linked: 0, already_linked: 0, no_match: 0, errors: 0 };

function log(msg) {
  console.log(`[link-contacts] ${msg}`);
}

/**
 * Normalize company name for matching.
 * Strips common suffixes, lowercases, trims.
 */
function normCompany(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(pty|ltd|limited|inc|incorporated|trust|trustee|the|for|of)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the best person match for an org_contact by company name.
 * Returns array of person matches ranked by role seniority.
 */
async function findPeopleAtOrg(orgName) {
  // Try exact-ish match first
  const { data: exactMatches } = await supabase
    .from('person_identity_map')
    .select('person_id, full_name, current_company, current_position, email')
    .ilike('current_company', `%${orgName.replace(/[%_]/g, '')}%`)
    .limit(20);

  if (exactMatches && exactMatches.length > 0) return exactMatches;

  // Try normalized fragments (e.g. "Human Rights Law Centre" → "%human rights law%")
  const words = normCompany(orgName).split(' ').filter(w => w.length > 3);
  if (words.length >= 2) {
    const searchTerm = words.slice(0, 3).join('%');
    const { data: fuzzyMatches } = await supabase
      .from('person_identity_map')
      .select('person_id, full_name, current_company, current_position, email')
      .ilike('current_company', `%${searchTerm}%`)
      .limit(20);
    if (fuzzyMatches && fuzzyMatches.length > 0) return fuzzyMatches;
  }

  return [];
}

/**
 * Rank people by role seniority — CEO/ED > Director > Manager > Other
 */
function rolePriority(position) {
  if (!position) return 0;
  const p = position.toLowerCase();
  if (/\b(ceo|chief executive|secretary.general|managing director)\b/.test(p)) return 100;
  if (/\b(chief|c[a-z]o)\b/.test(p)) return 90;
  if (/\b(executive director|general manager)\b/.test(p)) return 80;
  if (/\b(director|head of|principal)\b/.test(p)) return 70;
  if (/\b(senior|lead|manager)\b/.test(p)) return 50;
  if (/\b(partner|associate|coordinator)\b/.test(p)) return 30;
  return 10;
}

async function linkContactsToPeople() {
  // Get all org_contacts that need linking
  let query = supabase
    .from('org_contacts')
    .select('id, name, role, organisation, contact_type, person_id, org_profile_id')
    .is('person_id', null);

  if (ORG_FILTER) {
    // Get org_profile_id from slug
    const { data: org } = await supabase
      .from('org_profiles')
      .select('id')
      .eq('slug', ORG_FILTER)
      .single();
    if (!org) {
      log(`Org "${ORG_FILTER}" not found`);
      return;
    }
    query = query.eq('org_profile_id', org.id);
  }

  const { data: contacts, error } = await query;
  if (error) {
    log(`Error fetching contacts: ${error.message}`);
    return;
  }

  log(`Found ${contacts.length} unlinked org_contacts${ORG_FILTER ? ` for ${ORG_FILTER}` : ''}`);

  for (const contact of contacts) {
    stats.total++;
    const orgName = contact.organisation || contact.name;

    // Find people at this org
    const people = await findPeopleAtOrg(orgName);

    if (people.length === 0) {
      stats.no_match++;
      log(`  ✗ ${orgName} — no people found`);
      continue;
    }

    // Rank by seniority, pick best match
    const ranked = people
      .map(p => ({ ...p, priority: rolePriority(p.current_position) }))
      .sort((a, b) => b.priority - a.priority);

    const best = ranked[0];

    // Get LinkedIn URL if available
    const { data: linkedin } = await supabase
      .from('linkedin_contacts')
      .select('linkedin_url')
      .eq('person_id', best.person_id)
      .limit(1)
      .maybeSingle();

    const linkedinUrl = linkedin?.linkedin_url || null;

    if (DRY_RUN) {
      log(`  ✓ ${orgName} → ${best.full_name} (${best.current_position})${linkedinUrl ? ' [LinkedIn]' : ''} [${people.length} people found]`);
      stats.linked++;
      continue;
    }

    // Update the org_contact with person link
    const { error: updateError } = await supabase
      .from('org_contacts')
      .update({
        name: best.full_name,
        role: best.current_position || contact.role,
        person_id: best.person_id,
        linkedin_url: linkedinUrl,
        email: best.email || null,
      })
      .eq('id', contact.id);

    if (updateError) {
      log(`  ERROR ${orgName}: ${updateError.message}`);
      stats.errors++;
    } else {
      stats.linked++;
      log(`  ✓ ${orgName} → ${best.full_name} (${best.current_position})${linkedinUrl ? ' [LinkedIn]' : ''}`);
    }

    // Also link remaining senior people as additional contacts (up to 2 more)
    for (const extra of ranked.slice(1, 3)) {
      if (extra.priority < 50) break; // Only add senior people

      const { data: existing } = await supabase
        .from('org_contacts')
        .select('id')
        .eq('org_profile_id', contact.org_profile_id)
        .ilike('name', `%${extra.full_name}%`)
        .limit(1)
        .maybeSingle();

      if (existing) continue; // Already exists

      // Get LinkedIn for this person
      const { data: extraLinkedin } = await supabase
        .from('linkedin_contacts')
        .select('linkedin_url')
        .eq('person_id', extra.person_id)
        .limit(1)
        .maybeSingle();

      if (DRY_RUN) {
        log(`    + ${extra.full_name} (${extra.current_position})${extraLinkedin?.linkedin_url ? ' [LinkedIn]' : ''}`);
        continue;
      }

      await supabase.from('org_contacts').insert({
        org_profile_id: contact.org_profile_id,
        name: extra.full_name,
        role: extra.current_position,
        organisation: extra.current_company || contact.organisation,
        contact_type: contact.contact_type,
        person_id: extra.person_id,
        linkedin_url: extraLinkedin?.linkedin_url || null,
        email: extra.email || null,
        linked_entity_id: contact.linked_entity_id || null,
        notes: `Auto-discovered via ${orgName} linking`,
      });

      log(`    + ${extra.full_name} (${extra.current_position})`);
    }
  }
}

async function main() {
  log('=== Contact → Person Linking Agent ===');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (ORG_FILTER) log(`Org filter: ${ORG_FILTER}`);
  log('');

  const run = await logStart(supabase, 'link-contacts-to-people', 'Link Contacts to People');

  try {
    await linkContactsToPeople();

    log('');
    log('=== Summary ===');
    log(`Total contacts:   ${stats.total}`);
    log(`Linked:           ${stats.linked}`);
    log(`No match:         ${stats.no_match}`);
    log(`Errors:           ${stats.errors}`);

    await logComplete(supabase, run.id, {
      items_found: stats.total,
      items_new: stats.linked,
      status: stats.errors > 0 ? 'partial' : 'success',
    });
  } catch (e) {
    log(`Fatal: ${e.message}`);
    await logFailed(supabase, run.id, e);
    process.exit(1);
  }
}

main();
