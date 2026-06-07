#!/usr/bin/env node
/**
 * scrape-wasec-directory.mjs — WASEC member directory → data/scrapes/wasec-directory.json
 *
 * wasec.org.au's directory page is an empty WP shell; the real app is a Laravel
 * Livewire component (directory.DirectorySearch) embedded from admin.wasec.org.au
 * via Wire Elements extender. https://admin.wasec.org.au/directory is public and
 * server-renders the full member list (80 entries, "Showing 80 Results", no
 * pagination), each linking to a small detail page /directory/<slug>-<id> with
 * description, impact areas, certifications, links, and service areas.
 *
 * Fetches listing + every detail page (polite 300ms delay) and writes one JSON
 * payload for ingest-state-se-networks.mjs's parseWasec.
 */

import { writeFileSync } from 'node:fs';

const BASE = 'https://admin.wasec.org.au';
const OUT = 'data/scrapes/wasec-directory.json';
const UA = 'GrantScope/1.0 (research; contact@act.place)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} on ${path}`);
  return res.text();
}

const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ').trim();

// markup is clean Livewire blade: <h3>Heading</h3><ul><li>item</li>…</ul>,
// description is the <p> block(s) after the "About …" heading
function listAfterHeading(html, heading) {
  const m = html.match(new RegExp(`<h\\d[^>]*>\\s*${heading}[\\s\\S]*?<ul>([\\s\\S]*?)</ul>`, 'i'));
  if (!m) return [];
  return [...m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((li) => strip(li[1])).filter(Boolean);
}

function parseDetail(html, slug) {
  const name = strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '');
  const aboutBlock = html.match(/<h\d[^>]*>\s*About [\s\S]*?((?:<p>[\s\S]*?<\/p>\s*(?:<!--[\s\S]*?-->\s*)?)+)/i);
  const description = aboutBlock ? strip(aboutBlock[1]) : null;

  // links section carries the outbound URLs; label them by the anchor text
  const links = {};
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const label = strip(m[2]).toLowerCase();
    if (/website/.test(label)) links.website = m[1];
    else if (/instagram/.test(label)) links.instagram = m[1];
    else if (/facebook/.test(label)) links.facebook = m[1];
    else if (/linkedin/.test(label)) links.linkedin = m[1];
  }

  return {
    slug,
    name,
    description,
    impact_areas: listAfterHeading(html, 'Impact Area'),
    certifications: listAfterHeading(html, 'Certifications'),
    service_areas: listAfterHeading(html, 'Service Area'),
    ...links,
  };
}

async function main() {
  console.log('Fetching listing...');
  const listing = await get('/directory');
  const total = listing.match(/Showing (\d+) Results/)?.[1];
  const slugs = [...new Set([...listing.matchAll(/href="\/directory\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
  console.log(`Listing reports ${total} results; ${slugs.length} detail slugs found`);
  if (!slugs.length) throw new Error('no slugs — directory markup changed');

  const members = [];
  for (const [i, slug] of slugs.entries()) {
    try {
      members.push(parseDetail(await get(`/directory/${slug}`), slug));
    } catch (err) {
      console.error(`  ${slug}: ${err.message}`);
      members.push({ slug, error: err.message });
    }
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${slugs.length}`);
    await sleep(300);
  }

  const payload = { scraped_at: '2026-06-07', source: `${BASE}/directory`, total: Number(total), members };
  writeFileSync(OUT, JSON.stringify(payload, null, 1));
  const ok = members.filter((m) => !m.error);
  console.log(`Wrote ${OUT}: ${ok.length}/${members.length} parsed (${ok.filter((m) => m.website).length} with website)`);
  ok.slice(0, 3).forEach((m) => console.log(`  ${m.name} | ${m.website || '-'} | [${m.impact_areas.join(', ')}] | certs: ${m.certifications.join(', ') || '-'}`));
}

main().catch((err) => { console.error('scrape-wasec failed:', err.message); process.exit(1); });
