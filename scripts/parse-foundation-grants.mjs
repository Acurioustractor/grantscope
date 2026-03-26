#!/usr/bin/env node
/**
 * Parse foundation notable_grants text[] into structured justice_funding rows.
 * Extracts: recipient, amount, description from free-text grant strings.
 *
 * Usage: node --env-file=.env scripts/parse-foundation-grants.mjs [--live]
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const dryRun = !process.argv.includes('--live');

const SOURCE = 'foundation-notable-grants';

/**
 * Parse a single grant text string into structured data.
 * Handles patterns like:
 *   "$50,000 to Elise Reitze-Swensen for capturing sounds"
 *   "A$250 million over 10 years to the WA Government"
 *   "$1,000,000 to VividWhite for the VividFlo surgical implant"
 *   "Support for Royal Flying Doctor Service WA"
 *   "Funding for research into brain conditions"
 */
function parseGrantText(text) {
  const result = {
    recipient_name: null,
    amount_dollars: null,
    description: text.trim(),
  };

  // Extract amount: $X, A$X, $X million/billion, $Xm, $Xb
  const amountMatch = text.match(/A?\$\s*([\d,.]+)\s*(billion|million|m|b|k)?\b/i);
  if (amountMatch) {
    let amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    const unit = (amountMatch[2] || '').toLowerCase();
    if (unit === 'billion' || unit === 'b') amount *= 1_000_000_000;
    else if (unit === 'million' || unit === 'm') amount *= 1_000_000;
    else if (unit === 'k') amount *= 1_000;
    // Cap at $500M — larger numbers are corporate investments, not grants
    result.amount_dollars = amount <= 500_000_000 ? Math.round(amount) : null;
  }

  // Extract recipient: "to <Recipient>" or "for <Recipient>"
  // Pattern 1: "$X to <Recipient> for <purpose>"
  const toMatch = text.match(/\bto\s+(?:the\s+)?([A-Z][^,;.]{3,80}?)(?:\s+(?:for|through|via|in|over|toward|under)\b|$)/);
  if (toMatch) {
    result.recipient_name = toMatch[1].trim()
      .replace(/\s*\(.*$/, '')  // remove trailing parenthetical
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Pattern 2: "Support for <Recipient>" or "Funding for <Recipient>"
  if (!result.recipient_name) {
    const supportMatch = text.match(/(?:Support|Funding|Partnership)\s+(?:for|with)\s+(?:the\s+)?([A-Z][^,;.]{3,80}?)(?:\s+(?:for|through|in|and)\b|,|$)/i);
    if (supportMatch) {
      result.recipient_name = supportMatch[1].trim()
        .replace(/\s*\(.*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  // Skip if recipient looks like a description rather than an org name
  if (result.recipient_name) {
    const looksLikeDescription = /^(research|programs?|projects?|funding|support|healthcare|education|building|establishment|medical|community)/i.test(result.recipient_name);
    if (looksLikeDescription) {
      result.recipient_name = null;
    }
  }

  return result;
}

/**
 * Determine topics from foundation thematic_focus + grant text
 */
function inferTopics(grantText, thematicFocus) {
  const topics = [];
  const combined = `${grantText} ${(thematicFocus || []).join(' ')}`.toLowerCase();

  if (/justice|crime|prison|incarcerat|diversion|offend/i.test(combined)) topics.push('youth-justice');
  if (/indigenous|first.?nations|aboriginal|atsi/i.test(combined)) topics.push('indigenous');
  if (/child|youth|young/i.test(combined)) topics.push('youth-justice');
  if (/prevention|early.?intervention/i.test(combined)) topics.push('prevention');
  if (/community/i.test(combined)) topics.push('community-led');
  if (/legal|law/i.test(combined)) topics.push('legal-services');
  if (/family|families/i.test(combined)) topics.push('family-services');
  if (/disab|ndis/i.test(combined)) topics.push('ndis');
  if (/mental.?health/i.test(combined)) topics.push('child-protection');

  return [...new Set(topics)];
}

async function main() {
  console.log(`Foundation Grants Parser — ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  // Check for existing records
  const { data: existing } = await supabase
    .from('justice_funding')
    .select('id')
    .eq('source', SOURCE);

  if (existing && existing.length > 0) {
    console.log(`⚠ ${existing.length} records already exist with source='${SOURCE}'`);
    if (!process.argv.includes('--force')) {
      console.log('Use --force to delete and re-insert');
      return;
    }
    if (!dryRun) {
      await supabase.from('justice_funding').delete().eq('source', SOURCE);
      console.log(`Deleted ${existing.length} existing records`);
    }
  }

  // Fetch all foundations with notable_grants
  const { data: foundations } = await supabase
    .from('foundations')
    .select('id, name, acnc_abn, notable_grants, thematic_focus, geographic_focus')
    .not('notable_grants', 'is', null)
    .order('total_giving_annual', { ascending: false });

  if (!foundations) {
    console.log('No foundations with notable_grants found');
    return;
  }

  let totalParsed = 0;
  let withAmount = 0;
  let withRecipient = 0;
  let inserted = 0;
  let entityLinked = 0;
  const rows = [];

  for (const fdn of foundations) {
    const grants = fdn.notable_grants || [];
    if (grants.length === 0) continue;

    for (const grantText of grants) {
      if (!grantText || grantText.trim().length < 10) continue;

      const parsed = parseGrantText(grantText);
      totalParsed++;
      if (parsed.amount_dollars) withAmount++;
      if (parsed.recipient_name) withRecipient++;

      // Try to find entity for recipient
      let entity = null;
      if (parsed.recipient_name && parsed.recipient_name.length > 5) {
        const searchTerm = parsed.recipient_name.slice(0, 40);
        const { data: entities } = await supabase
          .from('gs_entities')
          .select('id, gs_id, canonical_name, abn')
          .ilike('canonical_name', `%${searchTerm.replace(/'/g, "''")}%`)
          .neq('entity_type', 'person')
          .limit(3);

        // Pick best match (shortest name = most specific)
        if (entities && entities.length > 0) {
          entity = entities.sort((a, b) => a.canonical_name.length - b.canonical_name.length)[0];
          entityLinked++;
        }
      }

      // Determine state from geographic_focus
      const geoFocus = fdn.geographic_focus || [];
      let state = null;
      for (const geo of geoFocus) {
        const stateMatch = String(geo).match(/\b(NSW|VIC|QLD|WA|SA|NT|ACT|TAS)\b/);
        if (stateMatch) { state = stateMatch[1]; break; }
      }

      const topics = inferTopics(grantText, fdn.thematic_focus);

      rows.push({
        source: SOURCE,
        source_url: null,
        recipient_name: parsed.recipient_name || `${fdn.name} (unspecified recipient)`,
        recipient_abn: entity?.abn || null,
        program_name: `${fdn.name} — ${parsed.description.slice(0, 80)}`,
        amount_dollars: parsed.amount_dollars,
        state,
        location: geoFocus.join(', ') || null,
        funding_type: 'grant',
        sector: 'philanthropic',
        project_description: parsed.description.slice(0, 500),
        financial_year: null,
        gs_entity_id: entity?.id || null,
        topics: topics.length > 0 ? topics : null,
      });
    }
  }

  console.log(`\nParsed: ${totalParsed} grant texts from ${foundations.length} foundations`);
  console.log(`With amount: ${withAmount} (${Math.round(withAmount / totalParsed * 100)}%)`);
  console.log(`With recipient: ${withRecipient} (${Math.round(withRecipient / totalParsed * 100)}%)`);
  console.log(`Entity-linked: ${entityLinked} (${Math.round(entityLinked / totalParsed * 100)}%)`);

  if (!dryRun && rows.length > 0) {
    // Batch insert in chunks of 50
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const { error } = await supabase.from('justice_funding').insert(chunk);
      if (error) {
        console.error(`Insert error at chunk ${i}: ${error.message}`);
      } else {
        inserted += chunk.length;
      }
    }
    console.log(`\nInserted: ${inserted} rows`);
  } else {
    console.log(`\nWould insert: ${rows.length} rows`);
  }

  // Show sample parsed grants
  console.log('\n--- Sample parsed grants ---');
  const samples = rows.filter(r => r.recipient_name && r.amount_dollars).slice(0, 10);
  for (const s of samples) {
    console.log(`  ${s.program_name.split(' — ')[0].slice(0, 30)} → ${s.recipient_name} | $${(s.amount_dollars / 1e6).toFixed(1)}M`);
  }
}

main().catch(console.error);
