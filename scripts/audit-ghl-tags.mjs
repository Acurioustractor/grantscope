#!/usr/bin/env node

/**
 * GHL tag audit — read-only. Sizes the tag sprawl against the registry
 * (scripts/lib/ghl-tag-registry.mjs) so cleanup is planned from numbers,
 * not vibes.
 *
 * Reports:
 *   - contacts scanned, distinct tags, tags-per-contact distribution
 *   - tag counts by registry class (allowed / deprecated / unregistered)
 *   - contacts with zero or multiple warmth tags
 *   - dead tags (used on < 5 contacts)
 *   - the worst-tagged contacts
 *
 * Usage: node --env-file=.env scripts/audit-ghl-tags.mjs
 */

import { classifyTag, WARMTH_TAGS } from './lib/ghl-tag-registry.mjs';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

if (!GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error('FATAL: GHL_API_KEY / GHL_LOCATION_ID not set (run with `node --env-file=.env`)');
  process.exit(1);
}

async function* allContacts() {
  let startAfterId = null;
  let startAfter = null;
  for (;;) {
    const url = new URL(`${GHL_BASE}/contacts/`);
    url.searchParams.set('locationId', GHL_LOCATION_ID);
    url.searchParams.set('limit', '100');
    if (startAfterId) {
      url.searchParams.set('startAfterId', startAfterId);
      url.searchParams.set('startAfter', String(startAfter));
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${GHL_API_KEY}`, Version: '2021-07-28' },
    });
    if (!res.ok) throw new Error(`GHL contacts ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const contacts = json.contacts || [];
    if (contacts.length === 0) return;
    yield* contacts;
    const meta = json.meta || {};
    if (!meta.startAfterId || meta.startAfterId === startAfterId) return;
    startAfterId = meta.startAfterId;
    startAfter = meta.startAfter;
    await new Promise((r) => setTimeout(r, 150));
  }
}

function label(c) {
  return c.email || c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.id;
}

async function main() {
  const tagCounts = new Map();
  const tagsPerContact = [];
  const noWarmth = [];
  const multiWarmth = [];
  const worst = [];
  let scanned = 0;

  for await (const c of allContacts()) {
    scanned += 1;
    const tags = (c.tags || []).map((t) => String(t).toLowerCase().trim());
    tagsPerContact.push(tags.length);
    for (const t of tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);

    const warmth = tags.filter((t) => WARMTH_TAGS.includes(t));
    if (warmth.length === 0) noWarmth.push(label(c));
    if (warmth.length > 1) multiWarmth.push(`${label(c)} [${warmth.join(', ')}]`);

    worst.push({ who: label(c), n: tags.length });
    if (scanned % 500 === 0) console.error(`  …${scanned} contacts scanned`);
  }

  const byClass = { allowed: 0, deprecated: 0, unregistered: 0 };
  const deprecatedByPrefix = new Map();
  const unregistered = [];
  for (const [tag, count] of tagCounts) {
    const cls = classifyTag(tag);
    byClass[cls] += 1;
    if (cls === 'deprecated') {
      const prefix = tag.includes(':') ? `${tag.split(':')[0]}:` : tag;
      const e = deprecatedByPrefix.get(prefix) || { tags: 0, contacts: 0 };
      e.tags += 1;
      e.contacts += count;
      deprecatedByPrefix.set(prefix, e);
    }
    if (cls === 'unregistered') unregistered.push([tag, count]);
  }

  tagsPerContact.sort((a, b) => a - b);
  const pct = (p) => tagsPerContact[Math.floor((tagsPerContact.length - 1) * p)] ?? 0;
  const dead = [...tagCounts].filter(([, n]) => n < 5).length;
  worst.sort((a, b) => b.n - a.n);

  console.log(`\n═══ GHL TAG AUDIT ═══`);
  console.log(`Contacts scanned: ${scanned}`);
  console.log(`Distinct tags: ${tagCounts.size} (allowed ${byClass.allowed} · deprecated ${byClass.deprecated} · unregistered ${byClass.unregistered})`);
  console.log(`Tags per contact: median ${pct(0.5)} · p90 ${pct(0.9)} · max ${tagsPerContact.at(-1) ?? 0}`);
  console.log(`Dead tags (<5 contacts): ${dead}`);

  console.log(`\n── Warmth hygiene`);
  console.log(`No warmth tag: ${noWarmth.length} contacts`);
  console.log(`Multiple warmth tags: ${multiWarmth.length} contacts`);
  for (const w of multiWarmth.slice(0, 10)) console.log(`  • ${w}`);

  console.log(`\n── Deprecated families (cleanup order = most contact-touches first)`);
  for (const [prefix, e] of [...deprecatedByPrefix].sort((a, b) => b[1].contacts - a[1].contacts)) {
    console.log(`  ${prefix.padEnd(22)} ${String(e.tags).padStart(4)} tags · ${e.contacts} contact-touches`);
  }

  console.log(`\n── Top unregistered tags (need a registry decision: adopt or remove)`);
  for (const [tag, count] of unregistered.sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${tag.padEnd(45)} ${count}`);
  }

  console.log(`\n── Worst-tagged contacts`);
  for (const w of worst.slice(0, 10)) console.log(`  ${String(w.n).padStart(3)} tags · ${w.who}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
