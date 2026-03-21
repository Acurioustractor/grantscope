#!/usr/bin/env node
/**
 * scrape-frrr-grants.mjs
 *
 * Scrapes FRRR (Foundation for Rural & Regional Renewal) grant recipients
 * from their WordPress REST API. Each "recipients" blog post contains an
 * HTML table with organisation names, project descriptions, locations, and amounts.
 *
 * Output: /tmp/frrr-grants.json
 */

import { writeFileSync } from 'fs';

const API_BASE = 'https://frrr.org.au/wp-json/wp/v2/posts';
const OUTPUT = '/tmp/frrr-grants.json';

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

/**
 * Fetch all "recipients" posts from WP API (paginated)
 */
async function fetchAllRecipientPosts() {
  const posts = [];
  let page = 1;
  while (true) {
    const url = `${API_BASE}?per_page=100&search=recipients&page=${page}&_fields=id,title,date,link,content`;
    log(`  Fetching page ${page}...`);
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400) break; // past last page
      throw new Error(`API error: ${res.status}`);
    }
    const data = await res.json();
    if (!data.length) break;
    posts.push(...data);
    log(`  Page ${page}: ${data.length} posts (total: ${posts.length})`);
    page++;
  }
  return posts;
}

/**
 * Parse HTML table rows from post content.
 * FRRR tables typically have columns: Organisation, Project, Location, Grant
 * Some have: Organisation, Project, State, Grant
 * Some older posts use different formats.
 */
function parseGrantsFromHtml(html, postDate, postTitle) {
  const grants = [];

  // Extract all table rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  let headerRow = null;
  let rows = [...html.matchAll(rowRegex)];

  for (const rowMatch of rows) {
    const rowHtml = rowMatch[1];
    const cells = [...rowHtml.matchAll(cellRegex)].map(m =>
      m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
        .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
        .replace(/&#8211;/g, '-').replace(/&#8212;/g, '-')
        .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
        .replace(/\s+/g, ' ').trim()
    );

    if (!cells.length) continue;

    // Detect header row
    if (!headerRow && cells.some(c => /organisation|recipient|group|applicant/i.test(c))) {
      headerRow = cells.map(c => c.toLowerCase());
      continue;
    }

    // Skip header-like rows (e.g. state headers like "NEW SOUTH WALES")
    if (cells.length === 1 || (cells.length >= 2 && cells.every(c => !c || /^[A-Z\s]+$/.test(c) && c.length < 30))) continue;

    // Skip empty rows
    if (cells.every(c => !c)) continue;

    // If we have a header, map columns
    if (headerRow) {
      const orgIdx = headerRow.findIndex(h => /organisation|recipient|group|applicant|name/i.test(h));
      const projIdx = headerRow.findIndex(h => /project|purpose|description|activity/i.test(h));
      const locIdx = headerRow.findIndex(h => /location|town|region|area|state|electorate/i.test(h));
      const amtIdx = headerRow.findIndex(h => /grant|amount|\$/i.test(h));

      const org = orgIdx >= 0 && orgIdx < cells.length ? cells[orgIdx] : '';
      const project = projIdx >= 0 && projIdx < cells.length ? cells[projIdx] : '';
      const location = locIdx >= 0 && locIdx < cells.length ? cells[locIdx] : '';
      const amountStr = amtIdx >= 0 && amtIdx < cells.length ? cells[amtIdx] : '';

      if (org && org.length > 2 && !/^(organisation|recipient|total)/i.test(org)) {
        grants.push({
          organisation: org,
          project: project.substring(0, 500),
          location,
          amount: parseAmount(amountStr),
          post_date: postDate,
          post_title: postTitle,
        });
      }
    } else {
      // No header found — try heuristic: first cell = org, last cell with $ = amount
      if (cells.length >= 2) {
        const org = cells[0];
        const amountCell = [...cells].reverse().find(c => /\$/.test(c)) || '';
        const project = cells.length >= 3 ? cells[1] : '';
        const location = cells.length >= 4 ? cells[2] : '';

        if (org && org.length > 2 && !/^(total|round|program|fund|state)/i.test(org)) {
          grants.push({
            organisation: org,
            project: project.substring(0, 500),
            location,
            amount: parseAmount(amountCell),
            post_date: postDate,
            post_title: postTitle,
          });
        }
      }
    }
  }

  return grants;
}

function parseAmount(str) {
  if (!str) return 0;
  // Extract first dollar amount pattern (e.g., "$120,000" or "120000")
  // Avoids grabbing trailing year digits like "2022-2025"
  const match = str.match(/\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return 0;
  const cleaned = match[1].replace(/,/g, '');
  const amount = Math.round(parseFloat(cleaned) || 0);
  // Sanity check: FRRR grants are typically under $1M
  return amount > 1_000_000 ? 0 : amount;
}

/**
 * Also check for list-based formats (<ul><li>) that some posts use
 */
function parseGrantsFromLists(html, postDate, postTitle) {
  const grants = [];

  // Pattern: "Organisation Name – $X,XXX" or "Organisation Name ($X,XXX)"
  const listItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  for (const match of html.matchAll(listItemRegex)) {
    const text = match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

    // Match "Org Name – $50,000" or "Org Name ($50,000)"
    const dashMatch = text.match(/^(.+?)\s*[–—-]\s*\$?([\d,]+)/);
    const parenMatch = text.match(/^(.+?)\s*\(\$?([\d,]+)/);

    const m = dashMatch || parenMatch;
    if (m && m[1].length > 3 && m[1].length < 200) {
      grants.push({
        organisation: m[1].trim(),
        project: '',
        location: '',
        amount: parseInt(m[2].replace(/,/g, '')) || 0,
        post_date: postDate,
        post_title: postTitle,
      });
    }
  }

  return grants;
}

async function main() {
  log('╔══════════════════════════════════════════════════╗');
  log('║  FRRR Grant Recipients Scraper                  ║');
  log('╚══════════════════════════════════════════════════╝');

  // Fetch all recipient posts
  log('Fetching recipient posts from WordPress API...');
  const posts = await fetchAllRecipientPosts();
  log(`Total posts fetched: ${posts.length}`);

  // Filter to posts that likely have recipient data
  const recipientPosts = posts.filter(p => {
    const title = p.title?.rendered || '';
    const slug = p.link || '';
    return /recipient|awarded|grant|fund|boost|share|invest|support/i.test(title) ||
           /recipient/i.test(slug);
  });
  log(`Posts with likely recipient data: ${recipientPosts.length}`);

  // Parse grants from each post
  let allGrants = [];
  let postsWithGrants = 0;

  for (const post of recipientPosts) {
    const content = post.content?.rendered || '';
    const title = post.title?.rendered?.replace(/<[^>]+>/g, '') || '';
    const date = post.date?.substring(0, 10) || '';

    // Try table parsing first
    let grants = parseGrantsFromHtml(content, date, title);

    // If no table grants, try list format
    if (grants.length === 0) {
      grants = parseGrantsFromLists(content, date, title);
    }

    if (grants.length > 0) {
      postsWithGrants++;
      allGrants.push(...grants);
      log(`  ${date} | ${grants.length} grants | ${title.substring(0, 70)}`);
    }
  }

  // Dedupe by org+amount+date
  const seen = new Set();
  const deduped = [];
  for (const g of allGrants) {
    const key = `${g.organisation}|${g.amount}|${g.post_date}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(g);
    }
  }

  log(`═══ Summary ═══`);
  log(`  Posts processed: ${recipientPosts.length}`);
  log(`  Posts with grants: ${postsWithGrants}`);
  log(`  Total grants extracted: ${allGrants.length}`);
  log(`  After dedup: ${deduped.length}`);
  log(`  Total amount: $${(deduped.reduce((s, g) => s + g.amount, 0) / 1e6).toFixed(1)}M`);

  // Extract year range
  const years = deduped.map(g => parseInt(g.post_date?.substring(0, 4))).filter(Boolean);
  if (years.length) {
    log(`  Year range: ${Math.min(...years)}-${Math.max(...years)}`);
  }

  writeFileSync(OUTPUT, JSON.stringify({ grants: deduped, scraped_at: new Date().toISOString() }, null, 2));
  log(`Saved to ${OUTPUT}`);
}

main().catch(console.error);
