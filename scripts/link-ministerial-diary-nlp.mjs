#!/usr/bin/env node
/**
 * link-ministerial-diary-nlp.mjs
 *
 * Entity linking for ministerial diary entries using reverse-lookup strategy:
 * Instead of extracting org names from messy text (unreliable with OCR artifacts),
 * we load known entity names and search for them within the diary text.
 *
 * Strategy:
 * 1. Fix OCR artifacts in diary text (space-insertions, split years)
 * 2. Build a lookup of ~250K entities (orgs, not persons)
 * 3. Search each diary entry for matching entity names (reverse lookup)
 * 4. Parse "Person, Role at Org" patterns for direct extraction
 * 5. Match council/shire names for local government entities
 * 6. Extensive manual aliases for abbreviations and informal names
 *
 * Usage:
 *   node --env-file=.env scripts/link-ministerial-diary-nlp.mjs [--dry-run] [--verbose]
 */

import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

// ── OCR artifact fixer ──────────────────────────────────────────────
function fixOcr(text) {
  if (!text) return '';
  return text
    // Fix split years: "202 5" → "2025", "20 25" → "2025"
    .replace(/\b(20)\s+(2[0-9])\b/g, '$1$2')
    .replace(/\b(202)\s+(\d)\b/g, '$1$2')
    // Fix common OCR splits (specific known cases)
    .replace(/For\s+tescue/gi, 'Fortescue')
    .replace(/Andr\s+ew/gi, 'Andrew')
    .replace(/Fra\s+ser/gi, 'Fraser')
    .replace(/Ca\s+binet/gi, 'Cabinet')
    .replace(/Ministeria\s+l/gi, 'Ministerial')
    .replace(/Minister\s+ial/gi, 'Ministerial')
    .replace(/Fe\s+bruary/gi, 'February')
    .replace(/Augu\s+st/gi, 'August')
    .replace(/Febr\s+uary/gi, 'February')
    .replace(/Septem\s+ber/gi, 'September')
    .replace(/Octo\s+ber/gi, 'October')
    .replace(/Novem\s+ber/gi, 'November')
    .replace(/Decem\s+ber/gi, 'December')
    // Fix OCR spaces in common words
    .replace(/Departmentof/g, 'Department of')
    .replace(/Premierand/g, 'Premier and')
    .replace(/Mayorof/g, 'Mayor of')
    .replace(/CEOof/g, 'CEO of')
    // Fix artifacts: " -" → "-"
    .replace(/\s+-\s*/g, '-')
    .replace(/\s+,/g, ',')
    // Normalize whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Internal meeting filter ─────────────────────────────────────────
function isInternalMeeting(org) {
  if (!org) return true;
  const t = fixOcr(org).toLowerCase();

  // Entries starting with "Hon" are minister-to-minister meetings
  if (/^hon\s/i.test(t)) return true;
  // Entries starting with dates are PDF artifacts
  if (/^\d{1,2}\s+\w+\s+\d{4}\s/i.test(t)) return true;
  // Entries starting with "Deputy" or "Acting" + govt role
  if (/^(deputy|acting)\s+(director|commissioner|police|premier)/i.test(t)) return true;
  // Commissioner meetings are internal govt
  if (/^commissioner,?\s/i.test(t)) return true;
  // Director-General meetings
  if (/^(di\s*rector-general|d-g)/i.test(t)) return true;
  // Cabinet meetings
  if (/^cabinet\s+(ministers?|members?|meeting)/i.test(t)) return true;
  // "Ca binet" OCR variant
  if (/^ca\s*binet\s+(ministers?|members?|meeting)/i.test(t)) return true;
  // Attorney-General combos (internal ministerial meetings)
  if (/^attorney\s*-?\s*general/i.test(t)) return true;
  // "Premier and Minister" combos
  if (/^premier\s+and\s+minister/i.test(t)) return true;
  // Diplomatic meetings unlikely to match entities
  if (/^(his|her)\s+excellency/i.test(t)) return true;
  // Emergency/disaster entries
  if (/^(emergency|disaster|state\s+recovery|state\s+disaster)/i.test(t)) return true;
  // "Ministerial Staff" standalone or with just a name
  if (/^ministerial\s+staff/i.test(t)) return true;
  // "Auditor-General" internal
  if (/^auditor-general/i.test(t)) return true;
  // "Assistant Minister for..." (no org)
  if (/^assistant\s+minister\s+for/i.test(t)) return true;
  // "A/Director-General" acting DG meetings
  if (/^a\/director/i.test(t)) return true;
  // "Afternoon Tea" social events
  if (/^afternoon\s+tea/i.test(t)) return true;
  // "Members of Parliament" group meetings
  if (/^members?\s+of\s+parliament/i.test(t)) return true;
  // "Corrective Services" internal dept
  if (/^corrective\s+services/i.test(t)) return true;
  // Entries that are just a person name (First Last) with no org
  if (/^[A-Z][a-z]+\s+[A-Z][a-z]+\s*(AO|AM|OAM|MP|QC|SC)?$/i.test(t)) return true;
  // "Aunty/Uncle" + name (elder, not org)
  if (/^(aunty|uncle)\s+/i.test(t)) return true;
  // "Sen the Hon" — federal senators
  if (/^sen\s+the\s+hon/i.test(t)) return true;
  // "Victim of crime" meetings
  if (/^victim\s+of\s+crime/i.test(t)) return true;
  // "CBRC Members" — cabinet budget review committee
  if (/^cbrc/i.test(t)) return true;
  // Director-General + Department (without "A/" prefix, already caught above)
  if (/^director\s*-?\s*general,?\s+(department|dpc|dfsdscs)/i.test(t)) return true;
  // "Sharon Schimming, Director-General" — DG meetings
  if (/director-general,?\s+department/i.test(t) && !/external|meeting with/i.test(t)) return true;
  // "Queensland State Disaster Coordinator"
  if (/^queensland\s+state\s+disaster/i.test(t)) return true;
  // "Chris Stream, A/Deputy Commissioner"
  if (/a\/deputy\s+commissioner/i.test(t)) return true;
  // "Departmental Staff Ministerial Staff" standalone
  if (/^departmental\s+staff\s+ministerial/i.test(t)) return true;
  // "Christy Guinea, Individual Deputation meeting" — no org
  if (/individual\s+deputation/i.test(t)) return true;
  // "Nick Seeley, Acting Director-General"
  if (/acting\s+director-general/i.test(t)) return true;
  // "Kathy Parton, Acting Director-General"
  if (/acting\s+director/i.test(t) && /department/i.test(t)) return true;
  // "Cultural Liaison Officer" internal govt
  if (/^cultural\s+liaison/i.test(t)) return true;
  // "Council for the Australian Federation" — intergovernmental
  if (/^council\s+for\s+the\s+australian\s+federation/i.test(t)) return true;
  // "Commonwealth of Australia First Ministers" — intergovernmental
  if (/^commonwealth\s+of\s+australia\s+first\s+ministers/i.test(t)) return true;
  // "Clerk of the Executive Council"
  if (/^clerk\s+of\s+the\s+executive/i.test(t)) return true;
  // Individual MPs (no org)
  if (/^\w+\s+\w+\s+mp,?\s+(assistant\s+minister|member\s+for)/i.test(t)) return true;
  // Just "Victim of Crime"
  if (/^victim\s+of\s+crime$/i.test(t)) return true;
  // Family members
  if (/^family\s+member/i.test(t)) return true;
  // Weather events
  if (/weather\s+event/i.test(t)) return true;

  // If the entire text is just internal meeting types (after stripping)
  const stripped = t
    .replace(/\b(ministerial staff|cabinet ministers?|government ministers?|departmental staff|pre-cabinet|briefing|weather|portfolio matters?|acting director-general|deputy director-general|director-general|a\/director-general|acting police commissioner|acting commissioner|deputy commissioner|acting victims commissioner|state disaster coordinator)\b/gi, '')
    .replace(/\b(department of \w[\w\s,]*)/gi, '')
    .replace(/\b(hon\s+\w+\s+\w+\s+mp)\b/gi, '')
    .replace(/\b\w+\s+mp\b/gi, '')
    .replace(/\b(member for \w+)\b/gi, '')
    .replace(/\b(minister for [\w\s,]+)/gi, '')
    .replace(/\b(assistant minister [\w\s,]+)/gi, '')
    .replace(/[,\s]+/g, ' ').trim();
  return stripped.length < 10;
}

// ── Manual known-org aliases ────────────────────────────────────────
// These handle cases where diary text uses abbreviated/informal names
const MANUAL_ALIASES = {
  // Universities
  'QUT': 'QUEENSLAND UNIVERSITY OF TECHNOLOGY',
  'UQ': 'THE UNIVERSITY OF QUEENSLAND',
  'GRIFFITH UNIVERSITY': 'GRIFFITH UNIVERSITY',
  'JAMES COOK UNIVERSITY': 'JAMES COOK UNIVERSITY',
  'CQU': 'CENTRAL QUEENSLAND UNIVERSITY',
  'USQ': 'UNIVERSITY OF SOUTHERN QUEENSLAND',
  'BOND UNIVERSITY': 'BOND UNIVERSITY LIMITED',

  // Major corporates
  'FORTESCUE': 'FORTESCUE METALS GROUP LTD',
  'FORTESCUE METALS': 'FORTESCUE METALS GROUP LTD',
  'VILLAGE ROADSHOW': 'VILLAGE ROADSHOW LIMITED',
  'SUNCORP': 'SUNCORP GROUP LIMITED',
  'ADANI': 'ADANI MINING PTY LTD',
  'TELSTRA': 'TELSTRA LIMITED',
  'QANTAS': 'QANTAS AIRWAYS LIMITED',
  'RIO TINTO': 'RIO TINTO LIMITED',
  'BHP GROUP': 'BHP GROUP LIMITED',
  'SANTOS': 'SANTOS LIMITED',
  'ORIGIN ENERGY': 'ORIGIN ENERGY LIMITED',
  'CANSTRUCT': 'CANSTRUCT PTY LTD',
  'ERNST & YOUNG': 'ERNST & YOUNG',
  'ERNST YOUNG': 'ERNST & YOUNG',
  'KPMG': 'KPMG',
  'DELOITTE': 'DELOITTE TOUCHE TOHMATSU',
  'PRICEWATERHOUSECOOPERS': 'PRICEWATERHOUSECOOPERS',
  'PRICEWATERHOUSECOOPERS': 'PRICEWATERHOUSECOOPERS',
  'MCKINSEY': 'MCKINSEY & COMPANY INC AUSTRALIA',
  'BOEING': 'BOEING AUSTRALIA HOLDINGS PTY LTD',
  'RHEINMETALL': 'RHEINMETALL DEFENCE AUSTRALIA PTY LTD',
  'RAYTHEON': 'RAYTHEON AUSTRALIA PTY LIMITED',
  'AURECON': 'AURECON AUSTRALASIA PTY LTD',

  // Peak bodies and associations
  'RACQ': 'THE ROYAL AUTOMOBILE CLUB OF QUEENSLAND LTD',
  'LGAQ': 'LOCAL GOVERNMENT ASSOCIATION OF QUEENSLAND',
  'INSURANCE COUNCIL OF AUSTRALIA': 'INSURANCE COUNCIL OF AUSTRALIA',
  'PROPERTY COUNCIL': 'PROPERTY COUNCIL OF AUSTRALIA',
  'BUSINESS COUNCIL OF AUSTRALIA': 'BUSINESS COUNCIL OF AUSTRALIA',
  'MINERALS COUNCIL': 'MINERALS COUNCIL OF AUSTRALIA',
  'NATIONAL FARMERS FEDERATION': 'NATIONAL FARMERS FEDERATION',
  'AGFORCE': 'AGFORCE QUEENSLAND INDUSTRIAL UNION OF EMPLOYERS',
  'QUEENSLAND RESOURCES COUNCIL': 'QUEENSLAND RESOURCES COUNCIL',
  'CHAMBER OF COMMERCE AND INDUSTRY QUEENSLAND': 'CHAMBER OF COMMERCE AND INDUSTRY QUEENSLAND',
  'CCIQ': 'CHAMBER OF COMMERCE AND INDUSTRY QUEENSLAND',

  // Unions
  'CFMEU': 'CONSTRUCTION FORESTRY MARITIME MINING AND ENERGY UNION',
  'UNITED WORKERS UNION': 'UNITED WORKERS UNION',
  'QUEENSLAND TEACHERS UNION': 'QUEENSLAND TEACHERS UNION',
  'QUEENSLAND NURSES': 'QUEENSLAND NURSES AND MIDWIVES UNION',
  'SHOP DISTRIBUTIVE AND ALLIED EMPLOYEES': 'SHOP DISTRIBUTIVE AND ALLIED EMPLOYEES ASSOCIATION',
  'TOGETHER UNION': 'TOGETHER QUEENSLAND',

  // Foundations and NFPs
  'CLONTARF FOUNDATION': 'CLONTARF FOUNDATION',
  'BRISBANE FESTIVAL': 'MAJOR BRISBANE FESTIVALS PTY LTD',
  'TOWNSVILLE ENTERPRISE': 'TOWNSVILLE ENTERPRISE LIMITED',
  'ARTHUR BEETSON FOUNDATION': 'ARTHUR BEETSON FOUNDATION LIMITED',
  'INDIGENOUS MARATHONS FOUNDATION': 'INDIGENOUS MARATHON FOUNDATION LTD',
  'SALVATION ARMY': 'THE SALVATION ARMY (QUEENSLAND)',
  'RED CROSS': 'AUSTRALIAN RED CROSS SOCIETY',
  'SMITH FAMILY': 'THE SMITH FAMILY',
  'BEYONDBLUE': 'BEYONDBLUE LIMITED',
  'HEADSPACE': 'HEADSPACE NATIONAL YOUTH MENTAL HEALTH FOUNDATION LTD',

  // Education
  'ISLAMIC COLLEGE OF BRISBANE': 'ISLAMIC COLLEGE OF BRISBANE',
  'INDEPENDENT SCHOOLS QUEENSLAND': 'INDEPENDENT SCHOOLS QUEENSLAND LTD',
  'ROCKHAMPTON GRAMMAR': 'THE ROCKHAMPTON GRAMMAR SCHOOL',

  // Specific QLD entities
  'QPS': 'QUEENSLAND POLICE SERVICE',
  'QUEENSLAND CORRECTIVE SERVICES': 'QUEENSLAND CORRECTIVE SERVICES',
  'MURRI CHAMBER OF COMMERCE': 'MURRI CHAMBER OF COMMERCE LTD',
  'QUEENSLAND AIR MUSEUM': 'QUEENSLAND AIR MUSEUM INC',
  'QUEENSLAND YOUTH ORCHESTRA': 'QUEENSLAND YOUTH ORCHESTRA INC',
  'SUNSHINE COAST ARTS FOUNDATION': 'SUNSHINE COAST ARTS FOUNDATION',
  'QIBN': 'QUEENSLAND INDIGENOUS BUSINESS NETWORK',
  'OCHRE SUN': 'OCHRE SUN PTY LTD',
  'OASIS TOWNSVILLE': 'OASIS TOWNSVILLE LTD',
  'FRESH START ACADEMY': 'FRESH START ACADEMY',
  'NSW HOMICIDE VICTIM SUPPORT GROUP': 'NSW HOMICIDE VICTIMS SUPPORT GROUP INC',

  // Media
  'COURIER MAIL': 'QUEENSLAND NEWSPAPERS PTY  LTD',
  'COURIER-MAIL': 'QUEENSLAND NEWSPAPERS PTY  LTD',
  'AUSTRALIAN BROADCASTING CORPORATION': 'AUSTRALIAN BROADCASTING CORPORATION',
  'SKY NEWS': 'SKY NEWS AUSTRALIA PTY LIMITED',
  'NINE ENTERTAINMENT': 'NINE ENTERTAINMENT CO. HOLDINGS LIMITED',
  'SEVEN WEST MEDIA': 'SEVEN WEST MEDIA LIMITED',
  'NEWS CORP': 'NEWS CORP AUSTRALIA',

  // Health
  'AUSTRALIAN FESTIVAL OF CHAMBER MUSIC': 'AUSTRALIAN FESTIVAL OF CHAMBER MUSIC LIMITED',

  // QLD specific orgs from diary entries
  'ATSILS': 'ABORIGINAL AND TORRES STRAIT ISLANDER LEGAL SERVICE (QLD) LIMITED',
  'ABORIGINAL AND TORRES STRAIT ISLANDER LEGAL SERVICE': 'ABORIGINAL AND TORRES STRAIT ISLANDER LEGAL SERVICE (QLD) LIMITED',
  'QUEENSLAND HOTELS ASSOCIATION': 'QUEENSLAND HOTELS ASSOCIATION',
  'TAXI COUNCIL OF AUSTRALIA': 'TAXI COUNCIL QUEENSLAND LTD',
  'HOWARD SMITH WHARVES': 'HOWARD SMITH WHARVES HOLDINGS PTY LTD',
  'TOGETHER ASU': 'TOGETHER QUEENSLAND',
  'OUTBACK FUTURES': 'OUTBACK FUTURES LTD',
  'VOICE FOR VICTIMS': 'VOICE FOR VICTIMS INC',
  'VOICE 4 VICTIMS': 'VOICE FOR VICTIMS INC',
  'DOMESTIC AND FAMILY VIOLENCE PREVENTION COUNCIL': 'DOMESTIC AND FAMILY VIOLENCE PREVENTION COUNCIL',
  'BAZMARK': 'BAZMARK PTY LIMITED',
  'FREDON GROUP': 'FREDON GROUP PTY LTD',
  'BARTON DEAKIN': 'BARTON DEAKIN PTY LIMITED',
  'TABCORP': 'TABCORP HOLDINGS LIMITED',
  'QUEENSLAND AFRICAN COMMUNITY COUNCIL': 'QUEENSLAND AFRICAN COMMUNITIES COUNCIL LTD',
  'AUSTRALIAN CHIN COMMUNITY COUNCIL': 'AUSTRALIAN CHIN COMMUNITY INC',
  'STORYFEST': 'STORYFEST INC',
  'CAIRNS REGION TOY LIBRARY': 'CAIRNS COMMUNITY TOY LIBRARY INC',
  'CENTRAL HIGHLANDS PERFORMING ARTS': 'CENTRAL HIGHLANDS PERFORMING ARTS INC',
  '54 REASONS': '54 REASONS LTD',
  'INDEPENDENT SCHOOLS QUEENSLAND': 'INDEPENDENT SCHOOLS QUEENSLAND LTD',
  '2032 OLYMPIC': 'BRISBANE ORGANISING COMMITTEE FOR THE 2032 OLYMPIC AND PARALYMPIC GAMES LIMITED',
  'OLYMPIC AND PARALYMPIC GAMES': 'BRISBANE ORGANISING COMMITTEE FOR THE 2032 OLYMPIC AND PARALYMPIC GAMES LIMITED',
  'LAING O\'ROURKE': 'LAING O\'ROURKE AUSTRALIA PTY LIMITED',
  'UNITED WAY': 'UNITED WAY AUSTRALIA',
  'IPSWICH ART GALLERY': 'THE TRUSTEE FOR IPSWICH ARTS FOUNDATION TRUST',
  'BRAVUS MINING': 'ADANI MINING PTY LTD',
  'TOWNSVILLE SHOW': 'TOWNSVILLE AGRICULTURAL PASTORAL & INDUSTRIAL ASSOCIATION',
  'TABCORP': 'TABCORP HOLDINGS LIMITED',

  // Sports
  'AFL COMMISSION': 'AUSTRALIAN FOOTBALL LEAGUE',
  'AUSTRALIAN FOOTBALL LEAGUE': 'AUSTRALIAN FOOTBALL LEAGUE',
  'NATIONAL RUGBY LEAGUE': 'NATIONAL RUGBY LEAGUE LIMITED',
  'CRICKET AUSTRALIA': 'CRICKET AUSTRALIA',
  'TENNIS AUSTRALIA': 'TENNIS AUSTRALIA LIMITED',
};

// ── Load high-relevance entities for lookup ─────────────────────────
async function loadEntityLookup() {
  log('Loading entity lookup table...');

  const entities = [];
  // Paginate ALL non-person entities in batches of 1000
  let offset = 0;
  while (true) {
    const { data, error } = await db
      .from('gs_entities')
      .select('id, canonical_name, abn, entity_type')
      .neq('entity_type', 'person')
      .range(offset, offset + 999);

    if (error || !data?.length) break;
    entities.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }

  log(`Loaded ${entities.length} entities for lookup`);

  // Build name→entity map, keyed by uppercase name
  const lookup = new Map();
  for (const e of entities) {
    const name = e.canonical_name?.trim();
    if (!name || name.length < 6) continue;
    const key = name.toUpperCase();
    // Prefer entities with ABNs (more reliable)
    if (!lookup.has(key) || (e.abn && !lookup.get(key).abn)) {
      lookup.set(key, e);
    }
  }

  // Also build a "short name" lookup for word-boundary matching
  // Strip common suffixes to enable partial matching
  const shortLookup = new Map();
  for (const [key, entity] of lookup) {
    // Strip legal suffixes
    const short = key
      .replace(/\s+(PTY\.?\s+)?LTD\.?$/i, '')
      .replace(/\s+LIMITED$/i, '')
      .replace(/\s+INCORPORATED$/i, '')
      .replace(/\s+INC\.?$/i, '')
      .replace(/\s+CORPORATION$/i, '')
      .replace(/\s+ABORIGINAL\s+CORPORATION$/i, '')
      .replace(/\s+ASSOCIATION$/i, '')
      .trim();
    if (short.length >= 8 && short !== key) {
      if (!shortLookup.has(short)) {
        shortLookup.set(short, entity);
      }
    }
  }

  log(`${lookup.size} unique entity names, ${shortLookup.size} short names`);
  return { lookup, shortLookup };
}

// ── Extract org names from "Person, Role at/of Org" patterns ────────
function extractOrgFromText(text) {
  const cleaned = fixOcr(text);
  const orgs = [];

  // Patterns that extract org names from structured text
  const patterns = [
    // "Person, CEO/Chair/Director/etc., OrgName" or "Person, CEO of OrgName"
    /(?:CEO|Chair(?:man|woman|person)?|Director|President|Managing Director|General Manager|Executive Director|Chief Executive|Secretary|Treasurer|Partner|Editor|Board (?:Chair|Member)|Patron|Vice President)\s*(?:,|of|at|-|–)\s*([A-Z][A-Za-z\s&'.(),-]+?)(?:\s+Teleconference|\s+Date of|\s*$)/gi,
    // "Mayor, Council Name"
    /Mayor\s*(?:,|of)\s*([A-Z][A-Za-z\s]+(?:Council|Shire\s+Council|City\s+Council|Regional\s+Council))/gi,
    // "CEO, OrgName Teleconference"
    /CEO\s*,\s*([A-Z][A-Za-z\s&'.()-]+?)(?:\s+Teleconference|\s*$)/gi,
    // Explicit org patterns in compound entries
    /(?:Chair|Member|Representative)\s*(?:,|of)\s*([A-Z][A-Za-z\s&'.()-]+?(?:Foundation|Association|Council|Trust|Group|Union|Commission|Authority|Institute|Board|Australia|Queensland|Services|Network|Society|Club|Chamber|Federation|Alliance))/gi,
  ];

  for (const pattern of patterns) {
    let match;
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    while ((match = pattern.exec(cleaned)) !== null) {
      const orgName = match[1].trim()
        .replace(/\s+Ministerial\s*$/i, '')
        .replace(/\s+St\s*aff$/i, '')
        .replace(/\s+and\s*$/i, '')
        .replace(/\s*,\s*$/, '')
        .trim();
      if (orgName.length >= 6) {
        orgs.push(orgName);
      }
    }
  }

  return orgs;
}

// ── Search for entity names in diary text ───────────────────────────
// Context noise: department/govt names that appear as context, not meeting targets
const CONTEXT_NOISE = new Set([
  'DEPARTMENT OF THE PREMIER AND CABINET',
  'DEPARTMENT OF NATURAL RESOURCES',
  'DEPARTMENT OF TRANSPORT',
  'DEPARTMENT OF EDUCATION',
  'DEPARTMENT OF JUSTICE',
  'DEPARTMENT OF HEALTH',
  'QUEENSLAND POLICE SERVICE',
  'QUEENSLAND CORRECTIVE SERVICES',
  'COMMUNITY GRO INC',
  // These appear as incidental context in multi-person meeting entries, not as the meeting target
  'SERVICES AUSTRALIA',
  'TRANSPORT AND MAIN ROADS',
  'INTEGRITY COMMISSION',
  'MICHAEL JONES',
  'STATE DEVELOPMENT CORPORATION PTY LTD',
  // Place names that are also entity names
  'ROCKHAMPTON',
  'TOWNSVILLE',
  'CAIRNS',
  'MACKAY',
  'BUNDABERG',
  'GLADSTONE',
  // Short generic names that false-positive on longer text
  'TRY AUSTRALIA',
  'AUSTRALIAN MUSIC EXAMINATIONS BOARD LIMITED',
  'AUSTRALIAN TEACHERS OF MEDIA INC.',
  'MACKAY TAXI HOLDINGS LIMITED',
  'MENINDEE ENTERPRISE PARK EDUCATION SERVICES INC',
]);

function findEntityInText(text, { lookup, shortLookup }) {
  const cleaned = fixOcr(text).toUpperCase();

  // 1. Check manual aliases first (highest priority)
  for (const [alias, canonical] of Object.entries(MANUAL_ALIASES)) {
    if (cleaned.includes(alias.toUpperCase())) {
      const entity = lookup.get(canonical.toUpperCase());
      if (entity) return { entity, matchedVia: `alias: ${alias}` };
      // Try finding by partial match in lookup
      for (const [key, e] of lookup) {
        if (key.includes(canonical.toUpperCase())) {
          return { entity: e, matchedVia: `alias: ${alias}` };
        }
      }
    }
  }

  // 2. Search for full entity names in the text (longest first for specificity)
  const candidates = [];
  for (const [name, entity] of lookup) {
    if (name.length < 10) continue; // Skip very short names
    if (entity.entity_type === 'person') continue;
    if (CONTEXT_NOISE.has(name)) continue;
    // Skip department names (they appear as context, not meeting target)
    if (name.startsWith('DEPARTMENT OF')) continue;
    if (cleaned.includes(name)) {
      candidates.push({ entity, name, matchedVia: 'exact_in_text' });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.name.length - a.name.length);
    return candidates[0];
  }

  // 3. Try short name lookup (without legal suffixes) with word boundary check
  for (const [name, entity] of shortLookup) {
    if (name.length < 15) continue; // Higher threshold for short names to avoid false positives
    if (entity.entity_type === 'person') continue;
    if (name.startsWith('DEPARTMENT OF')) continue;
    // Skip generic names that match too broadly
    if (/^(THE |AUSTRALIAN |SERVICES |COMMUNITY |MICHAEL |DAVID |JOHN |ROBERT |JAMES |PETER |PAUL |MARK |ANDREW |CHRIS |DANIEL |MATTHEW |STEPHEN |RICHARD |WILLIAM |THOMAS )/.test(name) && name.length < 20) continue;
    // Word boundary: check the char before and after the match
    const idx = cleaned.indexOf(name);
    if (idx >= 0) {
      const charBefore = idx > 0 ? cleaned[idx - 1] : ' ';
      const charAfter = idx + name.length < cleaned.length ? cleaned[idx + name.length] : ' ';
      const boundaryBefore = /[\s,;:(]/.test(charBefore) || idx === 0;
      const boundaryAfter = /[\s,;:)]/.test(charAfter) || idx + name.length === cleaned.length;
      if (boundaryBefore && boundaryAfter) {
        candidates.push({ entity, name, matchedVia: 'short_name' });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.name.length - a.name.length);
    return candidates[0];
  }

  // 4. Try extracting org names from "Person, Role at Org" patterns
  const extractedOrgs = extractOrgFromText(text);
  for (const orgName of extractedOrgs) {
    const orgUpper = orgName.toUpperCase();

    // Direct lookup
    if (lookup.has(orgUpper)) {
      return { entity: lookup.get(orgUpper), matchedVia: `extracted: "${orgName}"` };
    }

    // Short name lookup
    if (shortLookup.has(orgUpper)) {
      return { entity: shortLookup.get(orgUpper), matchedVia: `extracted_short: "${orgName}"` };
    }

    // Partial match in lookup (for slight name differences)
    // Only if the extracted name is specific enough (≥15 chars)
    if (orgUpper.length >= 15) {
      for (const [key, entity] of lookup) {
        if (key.length >= 15 && entity.entity_type !== 'person' && key.includes(orgUpper)) {
          return { entity, matchedVia: `extracted_partial: "${orgName}"` };
        }
      }
    }
  }

  return null;
}

// ── Fallback: extract council names ──────────────────────────────────
function findCouncilInText(text, { lookup, shortLookup }) {
  const cleaned = fixOcr(text);

  // Extract council names from text
  const councilPatterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Shire|City|Regional|Aboriginal\s+Shire)\s+Council)/g,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Council)\b/g,
  ];

  for (const pattern of councilPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(cleaned)) !== null) {
      const councilName = match[1].trim().toUpperCase();
      if (lookup.has(councilName)) {
        return { entity: lookup.get(councilName), matchedVia: `council: "${match[1]}"` };
      }
      // Try with "THE" prefix
      if (lookup.has('THE ' + councilName)) {
        return { entity: lookup.get('THE ' + councilName), matchedVia: `council: "${match[1]}"` };
      }
      // Short name match — only for specific council types (not generic "Council")
      if (councilName.includes('SHIRE COUNCIL') || councilName.includes('CITY COUNCIL') || councilName.includes('REGIONAL COUNCIL')) {
        for (const [key, entity] of shortLookup) {
          if (entity.entity_type === 'local_government' && (key.includes(councilName) || councilName.includes(key))) {
            return { entity, matchedVia: `council_partial: "${match[1]}"` };
          }
        }
      }
    }
  }

  return null;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  log(`Ministerial Diary NLP Entity Linker v2 (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`);

  const lookups = await loadEntityLookup();

  // Fetch ALL unlinked entries (paginate past PostgREST 1000-row limit)
  const entries = [];
  let offset = 0;
  while (true) {
    const { data, error } = await db
      .from('civic_ministerial_diaries')
      .select('id, organisation, who_met, minister_name, meeting_date, purpose')
      .is('linked_entity_id', null)
      .not('organisation', 'is', null)
      .order('organisation')
      .range(offset, offset + 999);

    if (error) { log(`Error: ${error.message}`); process.exit(1); }
    if (!data?.length) break;
    entries.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  log(`${entries.length} unlinked entries`);

  let linked = 0;
  let skippedInternal = 0;
  let noMatch = 0;
  const matches = [];
  const unmatched = [];

  for (const entry of entries) {
    if (isInternalMeeting(entry.organisation)) {
      skippedInternal++;
      continue;
    }

    // Step 1: Try in-memory lookup (fast)
    let result = findEntityInText(entry.organisation, lookups);

    // Step 2: Try council name extraction
    if (!result) {
      result = findCouncilInText(entry.organisation, lookups);
    }

    // Step 3: Also try searching the "who_met" field for org context
    if (!result && entry.who_met) {
      result = findEntityInText(entry.who_met, lookups);
      if (result) {
        result.matchedVia = `who_met:${result.matchedVia}`;
      }
    }

    if (result?.entity) {
      matches.push({
        diary_id: entry.id,
        raw: entry.organisation.substring(0, 80),
        entity: result.entity.canonical_name,
        entity_id: result.entity.id,
        minister: entry.minister_name,
        via: result.matchedVia,
      });

      if (!DRY_RUN) {
        const { error: updateErr } = await db
          .from('civic_ministerial_diaries')
          .update({ linked_entity_id: result.entity.id })
          .eq('id', entry.id);

        if (updateErr) log(`  UPDATE ERROR: ${updateErr.message}`);
      }
      linked++;
    } else {
      noMatch++;
      const cleaned = fixOcr(entry.organisation).substring(0, 80);
      unmatched.push(cleaned);
      if (VERBOSE) log(`  ✗ "${cleaned}"`);
    }
  }

  // Results
  const external = entries.length - skippedInternal;
  const totalLinked = linked + 167; // 167 previously linked
  const totalExternal = external + 167;
  log('\n── Results ──────────────────────────────────');
  log(`Total entries:       ${entries.length}`);
  log(`Skipped (internal):  ${skippedInternal}`);
  log(`New links:           ${linked}`);
  log(`No match:            ${noMatch}`);
  log(`New link rate:       ${((linked / Math.max(external, 1)) * 100).toFixed(1)}%`);
  log(`Overall link rate:   ${((totalLinked / Math.max(totalExternal, 1)) * 100).toFixed(1)}% (${totalLinked}/${totalExternal} external entries)`);

  if (matches.length) {
    log('\n── New Matches ──────────────────────────────');
    for (const m of matches) {
      log(`  ✓ ${m.entity} ← "${m.raw.substring(0, 60)}" [${m.via}]`);
    }
  }

  if (unmatched.length && (VERBOSE || unmatched.length <= 30)) {
    log('\n── Unmatched ────────────────────────────────');
    for (const u of unmatched.slice(0, 50)) {
      log(`  ✗ "${u}"`);
    }
    if (unmatched.length > 50) log(`  ... and ${unmatched.length - 50} more`);
  }

  // Summary of match sources
  if (matches.length) {
    const bySrc = {};
    for (const m of matches) {
      const src = m.via.split(':')[0];
      bySrc[src] = (bySrc[src] || 0) + 1;
    }
    log('\n── Match Sources ────────────────────────────');
    for (const [src, cnt] of Object.entries(bySrc).sort((a, b) => b[1] - a[1])) {
      log(`  ${src}: ${cnt}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
