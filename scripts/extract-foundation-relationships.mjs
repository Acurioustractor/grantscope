#!/usr/bin/env node

/**
 * Extract Foundation Relationship Intelligence
 *
 * Builds normalized foundation relationship data from foundation frontier pages,
 * PDFs, and existing foundation metadata.
 *
 * Writes:
 *   - foundation_people
 *   - foundation_grantees
 *   - foundation_relationship_signals
 *
 * Also upserts matched funder → grantee graph edges into gs_relationships.
 *
 * Usage:
 *   node --env-file=.env scripts/extract-foundation-relationships.mjs
 *   node --env-file=.env scripts/extract-foundation-relationships.mjs --dry-run --limit=3
 *   node --env-file=.env scripts/extract-foundation-relationships.mjs --foundation-id=<uuid>
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import * as cheerio from 'cheerio';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getArgValue(prefix) {
  const arg = process.argv.find(entry => entry.startsWith(`${prefix}=`));
  return arg ? arg.slice(prefix.length + 1) : null;
}

const DRY_RUN = process.argv.includes('--dry-run');
const FOUNDATION_ID = getArgValue('--foundation-id');
const FOUNDATION_NAME = getArgValue('--foundation-name');
const limitArg = getArgValue('--limit');
const LIMIT = limitArg ? parseInt(limitArg, 10) : 10;
const concurrencyArg = getArgValue('--concurrency');
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg, 10) : 2;
const maxPagesArg = getArgValue('--max-pages');
const MAX_PAGES = maxPagesArg ? parseInt(maxPagesArg, 10) : 6;
const frontierWindowArg = getArgValue('--frontier-window-hours');
const FRONTIER_WINDOW_HOURS = frontierWindowArg ? parseInt(frontierWindowArg, 10) : 168;
const refreshDaysArg = getArgValue('--refresh-days');
const REFRESH_DAYS = refreshDaysArg ? parseInt(refreshDaysArg, 10) : 30;
const AGENT_ID = getArgValue('--agent-id') || 'extract-foundation-relationships';
const AGENT_NAME = getArgValue('--agent-name') || 'Extract Foundation Relationships';

const USER_AGENT = 'GrantScope/1.0 (foundation relationship extraction; civicgraph.app)';
const FOUNDATION_FRONTIER_KINDS = [
  'foundation_homepage',
  'foundation_known_page',
  'foundation_candidate_page',
  'foundation_program_page',
];
const EMPTY_UUID = '00000000-0000-0000-0000-000000000000';

const entityCache = new Map();

function log(message) {
  console.log(`[foundation-relationships] ${message}`);
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\bcentre\b/g, 'center')
    .replace(/&/g, ' and ')
    .replace(/\b(limited|ltd|incorporated|inc|pty|pty ltd|foundation ltd|association|assoc)\b/g, ' ')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildNameVariants(name) {
  const raw = String(name || '').trim();
  if (!raw) return [];
  const variants = new Set([
    raw,
    raw.replace(/&/g, 'and'),
    raw.replace(/\bCentre\b/gi, 'Center'),
    raw.replace(/\bCenter\b/gi, 'Centre'),
    raw.replace(/\b(Limited|Ltd|Incorporated|Inc\.?)\b/gi, '').replace(/\s+/g, ' ').trim(),
  ]);
  return [...variants].filter(Boolean);
}

function compactComparableName(value) {
  return normalizeName(value).replace(/\s+/g, '');
}

function normalizeUrl(url) {
  return String(url || '').trim();
}

function truncate(text, maxChars) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function toSignalStrength(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 1;
  if (amount <= 9999.99) return Math.round(amount * 100) / 100;
  return Math.min(9999.99, Math.round(Math.log10(amount + 1) * 1000) / 100);
}

function cleanExtractedOrganisationName(name) {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+(Founded in \d{4}\b.*|is dedicated to\b.*|is committed to\b.*|is a\b.*|provides\b.*|provide\b.*|aims to\b.*|supports\b.*|supports the\b.*|empowers\b.*|addresses\b.*|working to\b.*|helping\b.*|delivering\b.*|together,?\b.*|our mission\b.*)$/i, '')
    .replace(/[,:;.-]\s*(Founded in \d{4}\b.*|is dedicated to\b.*|is committed to\b.*|is a\b.*|provides\b.*|aims to\b.*|supports\b.*|empowers\b.*|addresses\b.*)$/i, '')
    .trim();
}

function truncateStructuredText(text, maxChars) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, maxChars);
}

function parseJSON(text) {
  if (!text) return null;
  const matches = [
    text.match(/```json\s*([\s\S]*?)```/i),
    text.match(/```[\s\S]*?```/i),
    text.match(/\{[\s\S]*\}/),
  ];

  for (const match of matches) {
    if (!match) continue;
    const candidate = match[1] || match[0].replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  return null;
}

function toTextArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function compareFrontierTargets(a, b) {
  return Number(Boolean(b.last_changed_at)) - Number(Boolean(a.last_changed_at))
    || (a.last_changed_at && b.last_changed_at ? new Date(b.last_changed_at).getTime() - new Date(a.last_changed_at).getTime() : 0)
    || (b.priority || 0) - (a.priority || 0)
    || new Date(a.next_check_at || 0).getTime() - new Date(b.next_check_at || 0).getTime();
}

function dedupeByKey(items, keyFn) {
  const seen = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.set(key, item);
  }
  return [...seen.values()];
}

function relationshipPageScore(target) {
  const url = String(target?.target_url || target?.url || '').toLowerCase();
  const sourceKind = String(target?.source_kind || '').toLowerCase();
  const metadata = target?.metadata || {};
  const isRecipientUrl = /(what-we-fund|who-we-fund|grant-recipient|grant-recipients|grantee|grantees|recipients|funded-projects|funded-organisations|our-impact|impact|projects|stories|acquittals?)/.test(url);
  let score = 0;

  if (sourceKind === 'foundation_known_page') score += 50;
  else if (sourceKind === 'foundation_candidate_page') score += 40;
  else if (sourceKind === 'foundation_homepage') score += 30;
  else if (sourceKind === 'foundation_program_page') score += 15;

  if (/(annual-report|annual-reports|impact-report|report-to-community|publications)/.test(url)) score += 120;
  if (isRecipientUrl) score += 100;
  if (/(news-resources|news|media|case-studies|case-study)/.test(url)) score += 70;
  if (/(board|trustees|governance|leadership|team|about-us|about)/.test(url)) score += 60;
  if (/(grants|funding|programs)/.test(url)) score += 45;
  if (/\.pdf(?:$|[?#])/.test(url)) score += 35;

  if (/(fellow|fellows|fellowship|scholarship|scholar|cohort|peer-engagement|guidelines)/.test(url)) score -= 120;
  if (!isRecipientUrl && /(?:\/apply(?:\/|$)|\/applications?(?:\/|$)|\/grant-applications?(?:\/|$)|[?&](?:apply|application)=)/.test(url)) score -= 120;
  if (/experimental-evaluation-open-grant-round/.test(url)) score -= 60;

  const selectedRuns = Number(metadata.relationship_page_selected_runs || 0);
  const zeroYieldRuns = Number(metadata.relationship_page_zero_yield_runs || 0);
  const failedRuns = Number(metadata.relationship_page_failed_runs || 0);
  const peopleTotal = Number(metadata.relationship_page_people_total || 0);
  const granteesTotal = Number(metadata.relationship_page_grantees_total || 0);
  const signalsTotal = Number(metadata.relationship_page_signals_total || 0);
  const lastGranteesFound = Number(metadata.relationship_page_last_grantees_found || 0);
  const lastSignalsFound = Number(metadata.relationship_page_last_signals_found || 0);

  score += Math.min(220, (granteesTotal * 30) + (signalsTotal * 18) + (peopleTotal * 6));
  score += Math.min(60, (lastGranteesFound * 12) + (lastSignalsFound * 10));

  if (selectedRuns > 0) {
    score -= Math.min(120, zeroYieldRuns * 12);
    score -= Math.min(90, failedRuns * 15);
  }

  return score + (target?.priority || 0);
}

function looksLikeGovernancePerson(person) {
  const roleTitle = String(person?.role_title || '').toLowerCase();
  const sourceUrl = String(person?.source_url || '').toLowerCase();
  const evidence = String(person?.evidence_text || '').toLowerCase();
  const combined = `${roleTitle} ${sourceUrl} ${evidence}`;

  if (!person?.name) return false;
  if (/(fellow|fellowship|scholar|scholarship|cohort|participant|alumni|speaker|mentor|facilitator|grantee)/.test(combined)) return false;
  if (sourceUrl.includes('/fellows') || sourceUrl.includes('/fellowship')) return false;
  return true;
}

function looksLikeTrueGrantee(grantee) {
  const sourceUrl = String(grantee?.source_url || '').toLowerCase();
  const evidence = String(grantee?.evidence_text || '').toLowerCase();
  const programName = String(grantee?.program_name || '').toLowerCase();
  const combined = `${sourceUrl} ${evidence} ${programName}`;

  const negative = /(receiving support from|support from the australian centre for evaluation|support from|evaluator|evaluation support|learning partner|research partner|consultant|facilitator|service provider|fellow|fellowship|cohort|participant|peer engagement|speaker|advisor|judge)/;
  if (negative.test(combined)) return false;

  const positive = /(grantee|recipient|funded|grant recipient|received a grant|receives funding|awarded|awarded to|grant to|funding recipient|partner organisation)/;
  if (positive.test(combined)) return true;

  if (/(annual-report|annual-reports|what-we-fund|who-we-fund|grantee|grant-recipient|recipients|funded-projects|impact|acquittals?)/.test(sourceUrl)) return true;
  return false;
}

function extractHeuristicGranteesFromSources(sourceTexts, foundationName) {
  const grantees = [];

  for (const source of sourceTexts) {
    const sourceUrl = String(source?.url || '').toLowerCase();
    const recipientLikeUrl = /(recipient|recipients|grantee|grantees|who-we-fund|funded-projects|grants)/.test(sourceUrl);
    if (!recipientLikeUrl && !/grant:\s*\$/i.test(source.text || '')) continue;

    const lines = String(source.text || '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    let recentHeading = null;

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,6}\s+\[?([^\]]+?)\]?(?:\(|$)/);
      if (headingMatch) {
        recentHeading = headingMatch[1].trim();
      }

      const grantMatch = line.match(/Grant:\s*\$([0-9,]+(?:\.[0-9]+)?)\s+to\s+(.+?)(?:\s{2,}|$)/i);
      if (grantMatch) {
        const amount = Number(grantMatch[1].replace(/,/g, ''));
        const name = cleanExtractedOrganisationName(grantMatch[2].trim().replace(/[.]+$/, ''));
        if (name && normalizeName(name) !== normalizeName(foundationName)) {
          grantees.push({
            name,
            amount: Number.isFinite(amount) ? amount : null,
            year: null,
            program_name: null,
            source_url: source.url,
            evidence_text: truncate(line, 320),
            extraction_method: 'heuristic_recipient_page',
            confidence: 'reported',
          });
        }
        continue;
      }

      if (recentHeading && recipientLikeUrl) {
        const cleaned = cleanExtractedOrganisationName(recentHeading.replace(/^[0-9.\- ]+/, '').trim());
        if (cleaned && cleaned.length >= 4 && cleaned.length <= 120 && normalizeName(cleaned) !== normalizeName(foundationName)) {
          grantees.push({
            name: cleaned,
            amount: null,
            year: null,
            program_name: null,
            source_url: source.url,
            evidence_text: truncate(line, 240),
            extraction_method: 'heuristic_recipient_page',
            confidence: 'reported',
          });
        }
        recentHeading = null;
      }
    }
  }

  return dedupeByKey(grantees, grantee => [
    normalizeName(grantee.name),
    grantee.amount ?? '',
    grantee.source_url || '',
  ].join('::'));
}

async function fetchAllRows(queryBuilder) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryBuilder(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  return rows;
}

async function execSql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(error.message);
  if (typeof data === 'string') return JSON.parse(data);
  return data || [];
}

function parseBoardMembers(boardMembers) {
  const entries = toTextArray(boardMembers);
  return entries
    .map((entry) => {
      const parts = entry.split(/\s+-\s+/);
      const name = parts[0]?.trim();
      const roleTitle = parts.slice(1).join(' - ').trim() || null;
      if (!name) return null;
      return {
        name,
        role_title: roleTitle,
        role_type: mapRoleType(roleTitle),
        source_url: '',
        evidence_text: entry,
        extraction_method: 'foundation_profile',
        confidence: 'reported',
        metadata: { source: 'foundations.board_members' },
      };
    })
    .filter(Boolean);
}

function mapRoleType(roleTitle) {
  const role = String(roleTitle || '').toLowerCase().trim();
  if (!role) return 'other';
  if (role.includes('chair')) return 'chair';
  if (role.includes('trustee')) return 'trustee';
  if (role.includes('director')) return 'director';
  if (role.includes('advisor')) return 'advisor';
  if (role.includes('chief executive') || role === 'ceo') return 'ceo';
  if (role.includes('board')) return 'board_member';
  return 'other';
}

function createEmptyStats() {
  return {
    foundationsScanned: 0,
    sourcesFetched: 0,
    peopleFound: 0,
    peopleInserted: 0,
    peopleUpdated: 0,
    peopleDeleted: 0,
    granteesFound: 0,
    granteesInserted: 0,
    granteesUpdated: 0,
    granteesDeleted: 0,
    signalsInserted: 0,
    signalsUpdated: 0,
    graphEdgesInserted: 0,
    graphEdgesDeleted: 0,
    errors: [],
  };
}

function buildPageYieldMetrics(sourceTexts, peopleRows, granteeRows) {
  const byUrl = new Map();

  for (const source of sourceTexts || []) {
    const normalizedUrl = normalizeUrl(source.url);
    if (!normalizedUrl) continue;
    byUrl.set(normalizedUrl, {
      sourceUrl: normalizedUrl,
      frontierTargetId: source.frontier_target_id || null,
      selectionRank: source.selection_rank || null,
      selectionScore: source.selection_score || null,
      textLength: String(source.text || '').length,
      peopleFound: 0,
      granteesFound: 0,
      signalsFound: 0,
    });
  }

  for (const person of peopleRows || []) {
    const normalizedUrl = normalizeUrl(person.source_url);
    const entry = byUrl.get(normalizedUrl);
    if (entry) entry.peopleFound += 1;
  }

  for (const grantee of granteeRows || []) {
    const normalizedUrl = normalizeUrl(grantee.source_url);
    const entry = byUrl.get(normalizedUrl);
    if (!entry) continue;
    entry.granteesFound += 1;
    if (grantee.entity) entry.signalsFound += 1;
  }

  return byUrl;
}

async function callAnthropic(prompt) {
  if (!ANTHROPIC_API_KEY) return null;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    throw new Error(`Anthropic error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

function htmlToText(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, nav, footer, header, form').remove();
  const blocks = [];
  $('h1, h2, h3, h4, h5, h6, li, p').each((_, el) => {
    const text = $(el).text().trim();
    if (text) blocks.push(text);
  });
  const text = blocks.length > 0 ? blocks.join('\n') : ($('body').text() || $.root().text());
  return truncateStructuredText(text, 18000);
}

async function fetchJinaText(url) {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      Accept: 'text/markdown',
      'X-No-Cache': 'true',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) return null;
  const text = await response.text();
  const match = text.match(/Markdown Content:\n([\s\S]*)/);
  return truncateStructuredText(match ? match[1] : text, 18000);
}

function pdfTextFromBuffer(buffer) {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'foundation-rel-'));
  const pdfPath = path.join(tempDir, 'source.pdf');

  try {
    writeFileSync(pdfPath, buffer);
    const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      timeout: 60000,
    });
    return truncateStructuredText(text, 18000);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function fetchSourceText(url) {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return null;

  try {
    const response = await fetch(normalizedUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      if (!/\.pdf(?:$|[?#])/i.test(normalizedUrl)) {
        const fallback = await fetchJinaText(normalizedUrl).catch(() => null);
        if (fallback) {
          return {
            url: normalizedUrl,
            source_document_url: '',
            text: fallback,
            content_type: 'text/markdown',
          };
        }
      }
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (/pdf/i.test(contentType) || /\.pdf(?:$|[?#])/i.test(normalizedUrl)) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const text = pdfTextFromBuffer(buffer);
      if (!text) return null;
      return {
        url: normalizedUrl,
        source_document_url: normalizedUrl,
        text,
        content_type: 'application/pdf',
      };
    }

    const body = await response.text();
    const text = /html/i.test(contentType)
      ? htmlToText(body)
      : truncateStructuredText(body, 18000);

    if (text.length < 400) {
      const fallback = await fetchJinaText(normalizedUrl).catch(() => null);
      if (fallback) {
        return {
          url: normalizedUrl,
          source_document_url: '',
          text: fallback,
          content_type: 'text/markdown',
        };
      }
    }

    if (!text) return null;

    return {
      url: normalizedUrl,
      source_document_url: '',
      text,
      content_type: contentType || 'text/plain',
    };
  } catch {
    const fallback = await fetchJinaText(normalizedUrl).catch(() => null);
    if (!fallback) return null;
    return {
      url: normalizedUrl,
      source_document_url: '',
      text: fallback,
      content_type: 'text/markdown',
    };
  }
}

function buildExtractionPrompt(foundation, sourceTexts) {
  const focus = toTextArray(foundation.thematic_focus).join(', ') || 'unknown';
  const geography = toTextArray(foundation.geographic_focus).join(', ') || 'unknown';
  const boardMembers = toTextArray(foundation.board_members).slice(0, 20).join('\n- ');
  const notableGrants = toTextArray(foundation.notable_grants).slice(0, 20).join('\n- ');
  const sourceBlocks = sourceTexts
    .slice(0, MAX_PAGES)
    .map((source, index) => `SOURCE ${index + 1}\nURL: ${source.url}\nTEXT:\n${source.text.slice(0, 3500)}`)
    .join('\n\n');

  return `You are extracting structured philanthropy intelligence for an Australian foundation.

Foundation:
- Name: ${foundation.name}
- ABN: ${foundation.acnc_abn || 'unknown'}
- Website: ${foundation.website || 'unknown'}
- Parent company: ${foundation.parent_company || 'unknown'}
- Thematic focus: ${focus}
- Geographic focus: ${geography}

Known board members from existing profile:
${boardMembers ? `- ${boardMembers}` : '- none provided'}

Known notable grants / funded examples from existing profile:
${notableGrants ? `- ${notableGrants}` : '- none provided'}

Task:
1. Extract foundation governance people explicitly named in the text. Include trustees, directors, chairs, board members, CEOs, and senior grantmaking leaders who work for or govern the foundation.
2. Extract organisations explicitly described as grant recipients, funded partners, or named grantees that receive money or grant support from the foundation.

Rules:
- Only include names explicitly present in the supplied text.
- Exclude the foundation itself.
- Exclude fellows, fellowship participants, cohort members, speakers, consultants, evaluators, learning partners, researchers, or service providers unless they clearly govern the foundation.
- Exclude generic beneficiaries or project descriptions that do not name an organisation.
- Exclude support providers helping the foundation run a process unless they are clearly funded recipients.
- Prefer Australian organisations.
- If amount or year is not explicit, return null.
- Use the exact source URL where the evidence appears.
- Keep evidence_text short, quoted or tightly paraphrased from the supplied source text.
- Return JSON only.

JSON schema:
{
  "people": [
    {
      "name": "string",
      "role_title": "string|null",
      "role_type": "chair|trustee|director|advisor|ceo|board_member|other",
      "source_url": "string",
      "evidence_text": "string"
    }
  ],
  "grantees": [
    {
      "name": "string",
      "amount": number|null,
      "year": number|null,
      "program_name": "string|null",
      "source_url": "string",
      "evidence_text": "string"
    }
  ]
}

Sources:
${sourceBlocks}`;
}

async function resolveEntityByName(name) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  if (entityCache.has(`name:${normalized}`)) return entityCache.get(`name:${normalized}`);

  const entityCandidates = [];

  for (const variant of buildNameVariants(name).slice(0, 5)) {
    const { data: directMatches } = await supabase
      .from('gs_entities')
      .select('id, gs_id, canonical_name, abn, state, lga_name, sector')
      .ilike('canonical_name', `%${variant}%`)
      .limit(10);

    entityCandidates.push(...(directMatches || []));

    if (entityCandidates.length < 8) {
      const { data: charityMatches } = await supabase
        .from('acnc_charities')
        .select('abn, name')
        .ilike('name', `%${variant}%`)
        .limit(10);

      const charityAbns = [...new Set((charityMatches || []).map(row => row.abn).filter(Boolean))];
      if (charityAbns.length > 0) {
        const { data: entityByAbn } = await supabase
          .from('gs_entities')
          .select('id, gs_id, canonical_name, abn, state, lga_name, sector')
          .in('abn', charityAbns.slice(0, 10));
        entityCandidates.push(...(entityByAbn || []));
      }
    }
  }

  const uniqueCandidates = dedupeByKey(entityCandidates, candidate => candidate.id);
  const best = uniqueCandidates
    .map((candidate) => {
      const candidateNorm = normalizeName(candidate.canonical_name);
      const exact = candidateNorm === normalized;
      const starts = candidateNorm.startsWith(normalized) || normalized.startsWith(candidateNorm);
      const includes = candidateNorm.includes(normalized) || normalized.includes(candidateNorm);
      const score = exact ? 100 : starts ? 90 : includes ? 75 : 0;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score || a.candidate.canonical_name.length - b.candidate.canonical_name.length)[0];

  const resolved = best && best.score >= 75 ? best.candidate : null;
  entityCache.set(`name:${normalized}`, resolved);
  return resolved;
}

async function resolveEntityByAbn(abn) {
  const key = String(abn || '').trim();
  if (!key) return null;
  if (entityCache.has(`abn:${key}`)) return entityCache.get(`abn:${key}`);

  const { data } = await supabase
    .from('gs_entities')
    .select('id, gs_id, canonical_name, abn, state, lga_name, sector')
    .eq('abn', key)
    .limit(1)
    .maybeSingle();

  entityCache.set(`abn:${key}`, data || null);
  return data || null;
}

async function getFoundationsToProcess() {
  if (FOUNDATION_ID || FOUNDATION_NAME) {
    let query = supabase
      .from('foundations')
      .select('id, name, acnc_abn, website, parent_company, thematic_focus, geographic_focus, board_members, notable_grants')
      .not('website', 'is', null);

    query = FOUNDATION_ID ? query.eq('id', FOUNDATION_ID) : query.ilike('name', `%${FOUNDATION_NAME}%`);

    const { data, error } = await query
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(1);

    if (error) throw new Error(error.message);

    const targeted = data || [];
    if (targeted.length === 0) return targeted;

    const { data: frontierTargets, error: frontierError } = await supabase
      .from('source_frontier')
      .select('id, foundation_id, source_kind, target_url, priority, next_check_at, last_changed_at, metadata, enabled')
      .eq('enabled', true)
      .in('source_kind', FOUNDATION_FRONTIER_KINDS)
      .eq('foundation_id', targeted[0].id)
      .order('priority', { ascending: false })
      .limit(Math.max(MAX_PAGES * 5, 20));

    if (frontierError) throw new Error(frontierError.message);

    return targeted.map((foundation) => ({
      ...foundation,
      frontier_targets: (frontierTargets || []).sort(compareFrontierTargets),
    }));
  }

  const nowIso = new Date().toISOString();
  const changedCutoffIso = new Date(Date.now() - FRONTIER_WINDOW_HOURS * 3600_000).toISOString();
  const refreshCutoffMs = Date.now() - REFRESH_DAYS * 86_400_000;

  const baseFrontierQuery = () => supabase
    .from('source_frontier')
    .select('id, foundation_id, source_kind, target_url, priority, next_check_at, last_changed_at, metadata, enabled')
    .eq('enabled', true)
    .in('source_kind', FOUNDATION_FRONTIER_KINDS)
    .not('foundation_id', 'is', null);

  const [recentlyChanged, dueRows] = await Promise.all([
    fetchAllRows((from, to) => baseFrontierQuery()
      .gte('last_changed_at', changedCutoffIso)
      .order('last_changed_at', { ascending: false })
      .range(from, to)),
    fetchAllRows((from, to) => baseFrontierQuery()
      .lte('next_check_at', nowIso)
      .order('priority', { ascending: false })
      .range(from, to)),
  ]);

  const grouped = new Map();
  for (const row of [...recentlyChanged, ...dueRows]) {
    if (!row.foundation_id) continue;
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const extractedAt = metadata.last_relationship_extract_at ? new Date(metadata.last_relationship_extract_at).getTime() : 0;
    const changedAt = row.last_changed_at ? new Date(row.last_changed_at).getTime() : 0;
    const needsExtract = !extractedAt || changedAt > extractedAt || extractedAt < refreshCutoffMs;
    if (!needsExtract) continue;

    const entry = grouped.get(row.foundation_id) || {
      foundation_id: row.foundation_id,
      frontier_targets: [],
      recentChangedCount: 0,
      dueCount: 0,
      highestPriority: 0,
      lastChangedAt: null,
    };

    entry.frontier_targets.push(row);
    if (row.last_changed_at && new Date(row.last_changed_at).getTime() >= new Date(changedCutoffIso).getTime()) {
      entry.recentChangedCount += 1;
      if (!entry.lastChangedAt || new Date(row.last_changed_at).getTime() > new Date(entry.lastChangedAt).getTime()) {
        entry.lastChangedAt = row.last_changed_at;
      }
    }
    if (row.next_check_at && new Date(row.next_check_at).getTime() <= Date.now()) {
      entry.dueCount += 1;
    }
    entry.highestPriority = Math.max(entry.highestPriority, row.priority || 0);
    grouped.set(row.foundation_id, entry);
  }

  const foundationIds = [...grouped.keys()].slice(0, Math.max(LIMIT * 10, 100));
  if (foundationIds.length === 0) {
    const { data, error } = await supabase
      .from('foundations')
      .select('id, name, acnc_abn, website, parent_company, thematic_focus, geographic_focus, board_members, notable_grants')
      .not('website', 'is', null)
      .order('total_giving_annual', { ascending: false, nullsFirst: false })
      .limit(LIMIT);
    if (error) throw new Error(error.message);
    return data || [];
  }

  const { data: foundations, error } = await supabase
    .from('foundations')
    .select('id, name, acnc_abn, website, parent_company, thematic_focus, geographic_focus, board_members, notable_grants, total_giving_annual')
    .in('id', foundationIds)
    .not('website', 'is', null);

  if (error) throw new Error(error.message);

  return (foundations || [])
    .map((foundation) => {
      const stats = grouped.get(foundation.id);
      return {
        ...foundation,
        frontier_targets: (stats?.frontier_targets || []).sort(compareFrontierTargets),
        _score: (stats?.recentChangedCount || 0) * 100
          + (stats?.dueCount || 0) * 10
          + (stats?.highestPriority || 0)
          + Math.min(Number(foundation.total_giving_annual || 0) / 1_000_000, 50),
      };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, LIMIT);
}

async function gatherSourceTexts(foundation) {
  const rankedTargets = [...(foundation.frontier_targets || [])]
    .filter(target => target?.target_url)
    .map(target => ({
      ...target,
      _relationshipScore: relationshipPageScore(target),
    }))
    .sort((a, b) => b._relationshipScore - a._relationshipScore);

  const candidates = [];
  for (const target of rankedTargets) {
    candidates.push(target);
    if (candidates.length >= MAX_PAGES * 2) break;
  }

  if (foundation.website && candidates.length < MAX_PAGES * 2) {
    const website = foundation.website.startsWith('http') ? foundation.website : `https://${foundation.website}`;
    candidates.push({
      id: null,
      source_kind: 'foundation_homepage',
      target_url: normalizeUrl(website),
      priority: 0,
      metadata: {},
      _relationshipScore: relationshipPageScore({
        target_url: website,
        source_kind: 'foundation_homepage',
        priority: 0,
        metadata: {},
      }),
    });
  }

  const candidateIndexByUrl = new Map();
  for (let i = 0; i < candidates.length; i += 1) {
    const url = normalizeUrl(candidates[i].target_url);
    if (url && !candidateIndexByUrl.has(url)) candidateIndexByUrl.set(url, i);
  }

  const seenUrls = new Set();
  const fetched = [];

  for (const target of candidates) {
    const url = normalizeUrl(target.target_url);
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);

    const source = await fetchSourceText(url);
    if (source?.text) {
      fetched.push({
        ...source,
        frontier_target_id: target.id || null,
        source_kind: target.source_kind || null,
        selection_rank: (candidateIndexByUrl.get(url) ?? 0) + 1,
        selection_score: target._relationshipScore || relationshipPageScore(target),
      });
    }
    if (fetched.length >= MAX_PAGES) break;
  }

  return fetched;
}

async function extractStructuredRelationships(foundation, sourceTexts) {
  const seededPeople = parseBoardMembers(foundation.board_members);

  if (!ANTHROPIC_API_KEY || sourceTexts.length === 0) {
    return { people: seededPeople, grantees: [] };
  }

  const prompt = buildExtractionPrompt(foundation, sourceTexts);
  const response = await callAnthropic(prompt);
  const parsed = parseJSON(response);

  if (!parsed || typeof parsed !== 'object') {
    return { people: seededPeople, grantees: [] };
  }

  const llmPeople = Array.isArray(parsed.people) ? parsed.people : [];
  const llmGrantees = Array.isArray(parsed.grantees) ? parsed.grantees : [];

  const heuristicGrantees = extractHeuristicGranteesFromSources(sourceTexts, foundation.name);

  const normalizedPeople = llmPeople
    .map((person) => {
      const name = String(person?.name || '').trim();
      if (!name) return null;
      const roleTitle = String(person?.role_title || '').trim() || null;
      return {
        name,
        role_title: roleTitle,
        role_type: mapRoleType(person?.role_type || roleTitle),
        source_url: normalizeUrl(person?.source_url || ''),
        evidence_text: truncate(person?.evidence_text || '', 300),
        extraction_method: 'llm_frontier_extract',
        confidence: 'scraped',
        metadata: { source: 'frontier_page_extract' },
      };
    })
    .filter(Boolean)
    .filter(looksLikeGovernancePerson);

  const normalizedLlmGrantees = llmGrantees
    .map((grantee) => {
      const name = String(grantee?.name || '').trim();
      if (!name) return null;
      const amount = typeof grantee?.amount === 'number' ? grantee.amount : null;
      const year = Number.isInteger(grantee?.year) ? grantee.year : null;
      return {
        name,
        amount,
        year,
        program_name: String(grantee?.program_name || '').trim() || null,
        source_url: normalizeUrl(grantee?.source_url || ''),
        evidence_text: truncate(grantee?.evidence_text || '', 320),
        extraction_method: 'llm_frontier_extract',
        confidence: 'scraped',
      };
    })
    .filter(Boolean)
    .filter(looksLikeTrueGrantee);

  const llmComparableNames = normalizedLlmGrantees
    .map(grantee => compactComparableName(grantee.name))
    .filter(Boolean);

  const filteredHeuristicGrantees = heuristicGrantees.filter((grantee) => {
    const comparable = compactComparableName(grantee.name);
    if (!comparable) return false;
    return !llmComparableNames.some(llmName => comparable.includes(llmName) || llmName.includes(comparable));
  });

  const normalizedGrantees = [...filteredHeuristicGrantees, ...normalizedLlmGrantees];

  return {
    people: dedupeByKey([...seededPeople, ...normalizedPeople].filter(looksLikeGovernancePerson), person => [
      normalizeName(person.name),
      person.role_type,
      person.source_url || '',
      person.extraction_method,
    ].join('::')),
    grantees: dedupeByKey(normalizedGrantees.filter(looksLikeTrueGrantee), grantee => [
      normalizeName(grantee.name),
      grantee.year ?? '',
      grantee.program_name || '',
      grantee.source_url || '',
    ].join('::')),
  };
}

async function upsertFoundationPerson(foundation, person) {
  const dedupeQuery = supabase
    .from('foundation_people')
    .select('id')
    .eq('foundation_id', foundation.id)
    .eq('person_name_normalised', normalizeName(person.name))
    .eq('role_type', person.role_type || 'other')
    .eq('source_url', person.source_url || '')
    .eq('extraction_method', person.extraction_method);

  const { data: existing, error: lookupError } = await dedupeQuery.limit(1).maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  const payload = {
    foundation_id: foundation.id,
    foundation_abn: foundation.acnc_abn || null,
    foundation_name: foundation.name,
    person_name: person.name,
    person_name_normalised: normalizeName(person.name),
    role_title: person.role_title || null,
    role_type: person.role_type || 'other',
    source_url: person.source_url || '',
    source_document_url: person.source_document_url || '',
    evidence_text: person.evidence_text || null,
    extraction_method: person.extraction_method,
    confidence: person.confidence || null,
    metadata: person.metadata || {},
    extracted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    if (DRY_RUN) return { id: existing.id, inserted: false, updated: true };
    const { error } = await supabase
      .from('foundation_people')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id, inserted: false, updated: true };
  }

  if (DRY_RUN) return { id: null, inserted: true, updated: false };
  const { data, error } = await supabase
    .from('foundation_people')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, inserted: true, updated: false };
}

async function cleanupStaleFoundationPeople(foundationId, people) {
  const existing = await execSql(`
    SELECT id, person_name_normalised, role_type, source_url, extraction_method
    FROM foundation_people
    WHERE foundation_id = '${foundationId}'
      AND extraction_method = 'llm_frontier_extract'
  `);

  const keep = new Set(
    people
      .filter(person => person.extraction_method === 'llm_frontier_extract')
      .map(person => [
        normalizeName(person.name),
        person.role_type || 'other',
        person.source_url || '',
        person.extraction_method,
      ].join('::'))
  );

  const staleIds = existing
    .filter(row => !keep.has([
      row.person_name_normalised,
      row.role_type,
      row.source_url || '',
      row.extraction_method,
    ].join('::')))
    .map(row => row.id);

  if (staleIds.length === 0) return 0;
  if (DRY_RUN) return staleIds.length;

  const { error } = await supabase
    .from('foundation_people')
    .delete()
    .in('id', staleIds);

  if (error) throw new Error(error.message);
  return staleIds.length;
}

async function upsertFoundationGrantee(foundation, grantee, entity) {
  let dedupeQuery = supabase
    .from('foundation_grantees')
    .select('id')
    .eq('foundation_id', foundation.id)
    .eq('grantee_name_normalised', normalizeName(grantee.name))
    .eq('program_name', grantee.program_name || '')
    .eq('source_url', grantee.source_url || '')
    .eq('extraction_method', grantee.extraction_method);

  dedupeQuery = grantee.year == null
    ? dedupeQuery.is('grant_year', null)
    : dedupeQuery.eq('grant_year', grantee.year);

  const { data: existing, error: lookupError } = await dedupeQuery.limit(1).maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  const payload = {
    foundation_id: foundation.id,
    foundation_abn: foundation.acnc_abn || null,
    foundation_name: foundation.name,
    grantee_name: grantee.name,
    grantee_name_normalised: normalizeName(grantee.name),
    grantee_entity_id: entity?.id || null,
    grantee_abn: entity?.abn || null,
    grant_amount: typeof grantee.amount === 'number' ? grantee.amount : null,
    grant_year: grantee.year ?? null,
    program_name: grantee.program_name || '',
    source_url: grantee.source_url || '',
    source_document_url: grantee.source_document_url || '',
    evidence_text: grantee.evidence_text || null,
    link_method: entity ? 'gs_entities_name_match' : null,
    extraction_method: grantee.extraction_method,
    confidence: grantee.confidence || null,
    metadata: grantee.metadata || {},
    extracted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    if (DRY_RUN) return { id: existing.id, inserted: false, updated: true };
    const { error } = await supabase
      .from('foundation_grantees')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id, inserted: false, updated: true };
  }

  if (DRY_RUN) return { id: null, inserted: true, updated: false };
  const { data, error } = await supabase
    .from('foundation_grantees')
    .insert(payload)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, inserted: true, updated: false };
}

async function cleanupStaleFoundationGrantees(foundationId, grantees) {
  const existing = await execSql(`
    SELECT id, grantee_name_normalised, COALESCE(grant_year, -1) AS grant_year, COALESCE(program_name, '') AS program_name, source_url, extraction_method
    FROM foundation_grantees
    WHERE foundation_id = '${foundationId}'
      AND extraction_method IN ('llm_frontier_extract', 'heuristic_recipient_page')
  `);

  const keep = new Set(
    grantees
      .filter(grantee => grantee.extraction_method === 'llm_frontier_extract')
      .map(grantee => [
        normalizeName(grantee.name),
        grantee.year ?? -1,
        grantee.program_name || '',
        grantee.source_url || '',
        grantee.extraction_method,
      ].join('::'))
  );

  const staleIds = existing
    .filter(row => !keep.has([
      row.grantee_name_normalised,
      row.grant_year ?? -1,
      row.program_name || '',
      row.source_url || '',
      row.extraction_method,
    ].join('::')))
    .map(row => row.id);

  if (staleIds.length === 0) return 0;
  if (DRY_RUN) return staleIds.length;

  const { error } = await supabase
    .from('foundation_grantees')
    .delete()
    .in('id', staleIds);

  if (error) throw new Error(error.message);
  return staleIds.length;
}

async function upsertSignal(signal) {
  const relatedEntityId = signal.related_entity_id || null;
  const foundationPersonId = signal.foundation_person_id || null;
  const foundationGranteeId = signal.foundation_grantee_id || null;
  const personName = signal.person_name || '';
  const sourceUrl = signal.source_url || '';

  const existingRows = await execSql(`
    SELECT id
    FROM foundation_relationship_signals
    WHERE foundation_id = '${signal.foundation_id}'
      AND signal_type = '${String(signal.signal_type).replace(/'/g, "''")}'
      AND COALESCE(related_entity_id::text, '') = '${relatedEntityId || ''}'
      AND COALESCE(person_name, '') = '${String(personName).replace(/'/g, "''")}'
      AND COALESCE(source_url, '') = '${String(sourceUrl).replace(/'/g, "''")}'
      AND COALESCE(foundation_person_id::text, '') = '${foundationPersonId || ''}'
      AND COALESCE(foundation_grantee_id::text, '') = '${foundationGranteeId || ''}'
    LIMIT 1
  `);

  const payload = {
    foundation_id: signal.foundation_id,
    foundation_abn: signal.foundation_abn || null,
    foundation_name: signal.foundation_name,
    signal_type: signal.signal_type,
    related_entity_id: signal.related_entity_id || null,
    related_abn: signal.related_abn || null,
    related_name: signal.related_name || null,
    person_name: signal.person_name || null,
    foundation_person_id: signal.foundation_person_id || null,
    foundation_grantee_id: signal.foundation_grantee_id || null,
    source_url: sourceUrl,
    evidence_text: signal.evidence_text || null,
    strength: signal.strength ?? null,
    confidence: signal.confidence || null,
    metadata: signal.metadata || {},
    updated_at: new Date().toISOString(),
  };

  if (existingRows[0]?.id) {
    if (DRY_RUN) return { inserted: false, updated: true };
    const { error } = await supabase
      .from('foundation_relationship_signals')
      .update(payload)
      .eq('id', existingRows[0].id);
    if (error) throw new Error(error.message);
    return { inserted: false, updated: true };
  }

  if (DRY_RUN) return { inserted: true, updated: false };
  const { error } = await supabase
    .from('foundation_relationship_signals')
    .insert({
      ...payload,
      created_at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
  return { inserted: true, updated: false };
}

async function ensureGraphEdge(foundationEntity, granteeEntity, foundation, granteeRecord) {
  if (!foundationEntity?.id || !granteeEntity?.id) return false;

  const { data: existing, error: lookupError } = await supabase
    .from('gs_relationships')
    .select('id')
    .eq('source_entity_id', foundationEntity.id)
    .eq('target_entity_id', granteeEntity.id)
    .eq('dataset', 'foundation_grantees')
    .limit(1)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  const payload = {
    relationship_type: 'grant',
    dataset: 'foundation_grantees',
    amount: granteeRecord.amount ?? null,
    year: granteeRecord.year ?? null,
    source_url: granteeRecord.source_url || null,
    confidence: 'reported',
    last_seen: new Date().toISOString(),
    properties: {
      program_name: granteeRecord.program_name || null,
      evidence_text: granteeRecord.evidence_text || null,
      extraction_method: granteeRecord.extraction_method,
      foundation_name: foundation.name,
    },
  };

  if (existing?.id) {
    if (DRY_RUN) return false;
    const { error } = await supabase
      .from('gs_relationships')
      .update(payload)
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return false;
  }

  if (DRY_RUN) return true;
  const { error } = await supabase
    .from('gs_relationships')
    .insert({
      source_entity_id: foundationEntity.id,
      target_entity_id: granteeEntity.id,
      ...payload,
      first_seen: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
  return true;
}

async function cleanupStaleFoundationGraphEdges(foundationEntityId, granteeRows) {
  if (!foundationEntityId) return 0;

  const existing = await execSql(`
    SELECT id, target_entity_id
    FROM gs_relationships
    WHERE source_entity_id = '${foundationEntityId}'
      AND dataset = 'foundation_grantees'
  `);

  const keep = new Set(
    granteeRows
      .map(grantee => grantee.entity?.id)
      .filter(Boolean)
  );

  const staleIds = existing
    .filter(row => !keep.has(row.target_entity_id))
    .map(row => row.id);

  if (staleIds.length === 0) return 0;
  if (DRY_RUN) return staleIds.length;

  const { error } = await supabase
    .from('gs_relationships')
    .delete()
    .in('id', staleIds);

  if (error) throw new Error(error.message);
  return staleIds.length;
}

async function deriveSignals(foundation, foundationEntity, peopleRows, granteeRows) {
  const stats = {
    inserted: 0,
    updated: 0,
    graphEdgesInserted: 0,
    graphEdgesDeleted: 0,
  };

  for (const grantee of granteeRows) {
    const signal = await upsertSignal({
      foundation_id: foundation.id,
      foundation_abn: foundation.acnc_abn,
      foundation_name: foundation.name,
      signal_type: 'funder_grantee',
      related_entity_id: grantee.entity?.id || null,
      related_abn: grantee.entity?.abn || null,
      related_name: grantee.entity?.canonical_name || grantee.name,
      foundation_grantee_id: grantee.rowId || null,
      source_url: grantee.source_url || '',
      evidence_text: grantee.evidence_text || null,
      strength: toSignalStrength(grantee.amount),
      confidence: grantee.entity ? (grantee.confidence || 'scraped') : 'unresolved',
      metadata: {
        program_name: grantee.program_name || null,
        grant_year: grantee.year ?? null,
        grant_amount: grantee.amount ?? null,
        entity_matched: Boolean(grantee.entity),
      },
    });
    if (signal.inserted) stats.inserted += 1;
    if (signal.updated) stats.updated += 1;

    if (grantee.entity) {
      const edgeInserted = await ensureGraphEdge(foundationEntity, grantee.entity, foundation, grantee);
      if (edgeInserted) stats.graphEdgesInserted += 1;

      const geoFocus = toTextArray(foundation.geographic_focus).map(item => item.toLowerCase());
      const matchesState = grantee.entity.state && geoFocus.includes(String(grantee.entity.state).toLowerCase());
      const matchesLga = grantee.entity.lga_name && geoFocus.some(item => item.includes(String(grantee.entity.lga_name).toLowerCase()));

      if (matchesState || matchesLga) {
        const geoSignal = await upsertSignal({
          foundation_id: foundation.id,
          foundation_abn: foundation.acnc_abn,
          foundation_name: foundation.name,
          signal_type: 'geographic_focus_match',
          related_entity_id: grantee.entity.id,
          related_abn: grantee.entity.abn,
          related_name: grantee.entity.canonical_name,
          foundation_grantee_id: grantee.rowId || null,
          source_url: grantee.source_url || '',
          evidence_text: grantee.evidence_text || null,
          strength: 1,
          confidence: 'derived',
          metadata: {
            matched_state: matchesState ? grantee.entity.state : null,
            matched_lga: matchesLga ? grantee.entity.lga_name : null,
          },
        });
        if (geoSignal.inserted) stats.inserted += 1;
        if (geoSignal.updated) stats.updated += 1;
      }
    }
  }

  for (const person of peopleRows) {
    const normalized = normalizeName(person.person_name || person.name);
    if (!normalized) continue;

    const relatedRows = await supabase
      .from('person_roles')
      .select('entity_id, company_abn, company_name, role_type')
      .eq('person_name_normalised', normalized)
      .limit(100);

    if (relatedRows.error) throw new Error(relatedRows.error.message);

    for (const role of relatedRows.data || []) {
      const matchingGrantee = granteeRows.find((grantee) => (
        (grantee.entity?.id && role.entity_id && grantee.entity.id === role.entity_id)
        || (grantee.entity?.abn && role.company_abn && grantee.entity.abn === role.company_abn)
      ));

      if (!matchingGrantee) continue;

      const signal = await upsertSignal({
        foundation_id: foundation.id,
        foundation_abn: foundation.acnc_abn,
        foundation_name: foundation.name,
        signal_type: 'shared_person',
        related_entity_id: matchingGrantee.entity?.id || null,
        related_abn: matchingGrantee.entity?.abn || null,
        related_name: matchingGrantee.entity?.canonical_name || matchingGrantee.name,
        person_name: person.person_name || person.name,
        foundation_person_id: person.rowId || null,
        foundation_grantee_id: matchingGrantee.rowId || null,
        source_url: matchingGrantee.source_url || person.source_url || '',
        evidence_text: `Foundation person also appears in person_roles for ${matchingGrantee.entity?.canonical_name || matchingGrantee.name}`,
        strength: 1,
        confidence: 'derived',
        metadata: {
          grantee_role_type: role.role_type || null,
          grantee_company_name: role.company_name || null,
        },
      });
      if (signal.inserted) stats.inserted += 1;
      if (signal.updated) stats.updated += 1;
    }
  }

  if (foundation.parent_company) {
    const parentEntity = await resolveEntityByName(foundation.parent_company);
    if (parentEntity) {
      const signal = await upsertSignal({
        foundation_id: foundation.id,
        foundation_abn: foundation.acnc_abn,
        foundation_name: foundation.name,
        signal_type: 'parent_company_link',
        related_entity_id: parentEntity.id,
        related_abn: parentEntity.abn,
        related_name: parentEntity.canonical_name,
        source_url: foundation.website || '',
        evidence_text: foundation.parent_company,
        strength: 1,
        confidence: 'reported',
        metadata: {
          source: 'foundations.parent_company',
        },
      });
      if (signal.inserted) stats.inserted += 1;
      if (signal.updated) stats.updated += 1;
    }
  }

  stats.graphEdgesDeleted = await cleanupStaleFoundationGraphEdges(foundationEntity?.id, granteeRows);

  return stats;
}

async function markFrontierTargets(foundation, status, metrics, errorMessage = null, pageYieldMetrics = new Map()) {
  const checkedAt = new Date().toISOString();

  for (const target of foundation.frontier_targets || []) {
    const pageMetrics = target.id ? pageYieldMetrics.get(target.id) : null;
    const selectedRuns = Number(target.metadata?.relationship_page_selected_runs || 0);
    const successRuns = Number(target.metadata?.relationship_page_success_runs || 0);
    const failedRuns = Number(target.metadata?.relationship_page_failed_runs || 0);
    const zeroYieldRuns = Number(target.metadata?.relationship_page_zero_yield_runs || 0);
    const peopleTotal = Number(target.metadata?.relationship_page_people_total || 0);
    const granteesTotal = Number(target.metadata?.relationship_page_grantees_total || 0);
    const signalsTotal = Number(target.metadata?.relationship_page_signals_total || 0);
    const selected = Boolean(pageMetrics);

    const metadata = {
      ...(target.metadata || {}),
      last_relationship_extract_at: checkedAt,
      last_relationship_extract_status: status,
      last_relationship_people_found: metrics.peopleFound,
      last_relationship_grantees_found: metrics.granteesFound,
      last_relationship_people_deleted: metrics.peopleDeleted || 0,
      last_relationship_grantees_deleted: metrics.granteesDeleted || 0,
      last_relationship_signals_written: metrics.signalsInserted + metrics.signalsUpdated,
      last_relationship_error: errorMessage ? String(errorMessage).slice(0, 1000) : null,
    };

    if (selected) {
      const pageYield = (pageMetrics.peopleFound || 0) + (pageMetrics.granteesFound || 0);
      metadata.relationship_page_last_selected_at = checkedAt;
      metadata.relationship_page_last_status = status;
      metadata.relationship_page_last_selected_rank = pageMetrics.selectionRank || null;
      metadata.relationship_page_last_selection_score = pageMetrics.selectionScore || null;
      metadata.relationship_page_last_text_length = pageMetrics.textLength || 0;
      metadata.relationship_page_last_people_found = pageMetrics.peopleFound || 0;
      metadata.relationship_page_last_grantees_found = pageMetrics.granteesFound || 0;
      metadata.relationship_page_last_signals_found = pageMetrics.signalsFound || 0;
      metadata.relationship_page_selected_runs = selectedRuns + 1;
      metadata.relationship_page_success_runs = successRuns + (status === 'success' ? 1 : 0);
      metadata.relationship_page_failed_runs = failedRuns + (status === 'failed' ? 1 : 0);
      metadata.relationship_page_zero_yield_runs = zeroYieldRuns + (pageYield === 0 ? 1 : 0);
      metadata.relationship_page_people_total = peopleTotal + (pageMetrics.peopleFound || 0);
      metadata.relationship_page_grantees_total = granteesTotal + (pageMetrics.granteesFound || 0);
      metadata.relationship_page_signals_total = signalsTotal + (pageMetrics.signalsFound || 0);
      metadata.relationship_page_high_yield = (pageMetrics.granteesFound || 0) > 0 || (pageMetrics.signalsFound || 0) > 0;
    }

    if (DRY_RUN) continue;

    const { error } = await supabase
      .from('source_frontier')
      .update({
        metadata,
        updated_at: checkedAt,
      })
      .eq('id', target.id);

    if (error) {
      log(`Frontier metadata update failed for ${target.target_url}: ${error.message}`);
    }
  }
}

async function processFoundation(foundation) {
  const stats = createEmptyStats();
  stats.foundationsScanned = 1;

  const sourceTexts = await gatherSourceTexts(foundation);
  stats.sourcesFetched = sourceTexts.length;

  const extracted = await extractStructuredRelationships(foundation, sourceTexts);
  stats.peopleFound = extracted.people.length;
  stats.granteesFound = extracted.grantees.length;
  stats.peopleDeleted = await cleanupStaleFoundationPeople(foundation.id, extracted.people);
  stats.granteesDeleted = await cleanupStaleFoundationGrantees(foundation.id, extracted.grantees);

  const foundationEntity = foundation.acnc_abn ? await resolveEntityByAbn(foundation.acnc_abn) : null;
  const persistedPeople = [];
  const persistedGrantees = [];

  for (const person of extracted.people) {
    const result = await upsertFoundationPerson(foundation, person);
    if (result.inserted) stats.peopleInserted += 1;
    if (result.updated) stats.peopleUpdated += 1;
    persistedPeople.push({
      ...person,
      person_name: person.name,
      rowId: result.id,
    });
  }

  for (const grantee of extracted.grantees) {
    const entity = await resolveEntityByName(grantee.name);
    const result = await upsertFoundationGrantee(foundation, grantee, entity);
    if (result.inserted) stats.granteesInserted += 1;
    if (result.updated) stats.granteesUpdated += 1;
    persistedGrantees.push({
      ...grantee,
      entity,
      rowId: result.id,
    });
  }

  const signalStats = await deriveSignals(foundation, foundationEntity, persistedPeople, persistedGrantees);
  stats.signalsInserted = signalStats.inserted;
  stats.signalsUpdated = signalStats.updated;
  stats.graphEdgesInserted = signalStats.graphEdgesInserted;
  stats.graphEdgesDeleted = signalStats.graphEdgesDeleted || 0;

  const pageYieldMetrics = buildPageYieldMetrics(sourceTexts, persistedPeople, persistedGrantees);
  const metricsByTargetId = new Map(
    [...pageYieldMetrics.values()]
      .filter(entry => entry.frontierTargetId)
      .map(entry => [entry.frontierTargetId, entry])
  );

  return {
    ...stats,
    pageYieldMetrics: metricsByTargetId,
  };
}

async function processFoundations(foundations) {
  const totals = createEmptyStats();
  let index = 0;

  async function worker() {
    while (index < foundations.length) {
      const currentIndex = index++;
      const foundation = foundations[currentIndex];
      log(`Scanning ${foundation.name} (${currentIndex + 1}/${foundations.length})`);

      try {
        const result = await processFoundation(foundation);
        await markFrontierTargets(foundation, 'success', result, null, result.pageYieldMetrics);

        totals.foundationsScanned += result.foundationsScanned;
        totals.sourcesFetched += result.sourcesFetched;
        totals.peopleFound += result.peopleFound;
        totals.peopleInserted += result.peopleInserted;
        totals.peopleUpdated += result.peopleUpdated;
        totals.peopleDeleted += result.peopleDeleted;
        totals.granteesFound += result.granteesFound;
        totals.granteesInserted += result.granteesInserted;
        totals.granteesUpdated += result.granteesUpdated;
        totals.granteesDeleted += result.granteesDeleted;
        totals.signalsInserted += result.signalsInserted;
        totals.signalsUpdated += result.signalsUpdated;
        totals.graphEdgesInserted += result.graphEdgesInserted;
        totals.graphEdgesDeleted += result.graphEdgesDeleted || 0;

        log(`  -> people ${result.peopleFound} (${result.peopleInserted} inserted, ${result.peopleDeleted} deleted), grantees ${result.granteesFound} (${result.granteesInserted} inserted, ${result.granteesDeleted} deleted), signals ${result.signalsInserted + result.signalsUpdated}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        totals.errors.push({ foundation_id: foundation.id, foundation_name: foundation.name, message });
        await markFrontierTargets(foundation, 'failed', createEmptyStats(), message, new Map());
        log(`  -> failed: ${message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, foundations.length || 1) }, () => worker()));
  return totals;
}

async function main() {
  const run = await logStart(supabase, AGENT_ID, AGENT_NAME);

  try {
    log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    const foundations = await getFoundationsToProcess();
    if (foundations.length === 0) {
      log('No foundations selected for relationship extraction');
      await logComplete(supabase, run.id, { items_found: 0, items_new: 0, items_updated: 0 });
      return;
    }

    log(`Selected ${foundations.length} foundation${foundations.length === 1 ? '' : 's'}`);
    const totals = await processFoundations(foundations);
    const itemsFound = totals.peopleFound + totals.granteesFound;
    const itemsNew = totals.peopleInserted + totals.granteesInserted + totals.signalsInserted + totals.graphEdgesInserted;
    const itemsUpdated = totals.peopleUpdated + totals.granteesUpdated + totals.signalsUpdated + totals.peopleDeleted + totals.granteesDeleted + totals.graphEdgesDeleted;

    await logComplete(supabase, run.id, {
      items_found: itemsFound,
      items_new: itemsNew,
      items_updated: itemsUpdated,
      status: totals.errors.length > 0 ? 'partial' : 'success',
      errors: totals.errors,
    });

    log(`Done: people ${totals.peopleFound} (${totals.peopleInserted} inserted, ${totals.peopleDeleted} deleted), grantees ${totals.granteesFound} (${totals.granteesInserted} inserted, ${totals.granteesDeleted} deleted), signals ${totals.signalsInserted + totals.signalsUpdated}, graph edges ${totals.graphEdgesInserted} inserted/${totals.graphEdgesDeleted} deleted`);
    if (totals.errors.length > 0) {
      log(`Completed with ${totals.errors.length} error(s)`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logFailed(supabase, run.id, message);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
