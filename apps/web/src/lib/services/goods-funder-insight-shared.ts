/**
 * Goods Funder Insight — PURE decoder + types. No server-only imports, so this
 * module is safe to import from client components, the server fetch
 * (goods-funder-insight.ts) AND the unit tests.
 *
 * GHL holds no funder message threads — only STRUCTURED signal on each contact
 * (temperature tags, engagement ring, campaign stage, the newsletter streams
 * they subscribe to, comms drips, roles, place). This module decodes that raw
 * tag set + opportunity meta into a deterministic "what are they saying & why":
 * a temperature, the topics they care about, attention flags and a next move.
 *
 * Taxonomy below is grounded in the ACTUAL tags present on Goods contacts
 * (aggregated 2026-06-09), not guessed. Keep in lockstep with what
 * scripts/sync-goods-ghl.mjs captures into goods_relationships.ghl_signal.
 */

import type { GoodsRelType, GoodsStage, WarmthBand } from './goods-engagement-shared';
import { warmthBand } from './goods-engagement-shared';

// ---- Raw signal captured off GHL into goods_relationships.ghl_signal ----
export type GhlSignal = {
  tags?: string[];
  opportunity_status?: string | null; // open | won | lost | abandoned
  opportunity_stage_name?: string | null; // human stage, e.g. "Stewarding / Reporting"
  last_stage_change_at?: string | null;
  synced_at?: string | null;
};

// ---- Decoded dimensions ----
export type Temperature = 'hot' | 'warm' | 'steady' | 'inquiry' | 'cooling' | 'cold' | 'unknown';
export type EngagementTier = 'vip' | 'inner' | 'standard';
export type Attention = 'act-now' | 'watch' | 'steady' | 'none';

export type InsightFlag = {
  key: string;
  label: string;
  tone: 'urgent' | 'opportunity' | 'positive' | 'neutral';
};

export type FunderInsightInput = {
  id: string;
  name: string;
  relationshipType: GoodsRelType;
  stage: GoodsStage;
  warmthDisplay: number;
  lastTouchAt: string | null;
  totalReceived: number;
  hasPrior: boolean;
  signal: GhlSignal;
  /** injectable clock for deterministic tests; defaults to Date.now() */
  now?: number;
};

export type FunderInsight = {
  id: string;
  name: string;
  relationshipType: GoodsRelType;
  stage: GoodsStage;
  warmth: number;
  band: WarmthBand;
  lastTouchAt: string | null;
  daysSinceTouch: number | null;
  totalReceived: number;
  hasPrior: boolean;
  // decoded signal
  temperature: Temperature;
  temperatureRank: number;
  engagementTier: EngagementTier;
  campaignStage: string | null;
  interests: string[]; // what they care about (human labels)
  commsStreams: string[];
  roles: string[];
  places: string[];
  opportunityStage: string | null;
  opportunityStatus: string | null;
  tagCount: number;
  // actionable
  attention: Attention;
  flags: InsightFlag[];
  nextMove: string;
};

// ---- Temperature: explicit bare goods-* tags maintained in GHL ----
const TEMP_TAGS: Record<string, Temperature> = {
  'goods-hot': 'hot',
  'goods-warm': 'warm',
  'goods-steady': 'steady',
  'goods-inquiry': 'inquiry',
  'goods-cooling': 'cooling',
  'goods-cold': 'cold',
};
// When more than one is present, surface the one that most demands attention.
const TEMP_PRIORITY: Temperature[] = ['hot', 'cooling', 'cold', 'inquiry', 'warm', 'steady'];
const TEMP_RANK: Record<Temperature, number> = {
  hot: 5, warm: 4, steady: 3, inquiry: 2, cooling: 1, cold: 0, unknown: -1,
};

export const TEMP_LABEL: Record<Temperature, string> = {
  hot: 'Hot', warm: 'Warm', steady: 'Steady', inquiry: 'New inquiry',
  cooling: 'Cooling', cold: 'Cold', unknown: 'No read',
};

/** Bauhaus tone class for a temperature pill. */
export function temperatureTone(t: Temperature): string {
  switch (t) {
    case 'hot': return 'bg-bauhaus-red text-white';
    case 'warm': return 'bg-bauhaus-yellow text-bauhaus-black';
    case 'steady': return 'bg-bauhaus-blue text-white';
    case 'inquiry': return 'bg-bauhaus-blue/20 text-bauhaus-black border-2 border-bauhaus-blue';
    case 'cooling': return 'bg-white text-bauhaus-black border-2 border-bauhaus-red';
    case 'cold': return 'bg-bauhaus-black/10 text-bauhaus-muted border-2 border-bauhaus-black/30';
    default: return 'bg-white text-bauhaus-muted border-2 border-bauhaus-black/20';
  }
}

// ---- Interests: newsletter streams + interest tags = what they care about ----
const INTEREST_LABELS: Record<string, string> = {
  'newsletter-stream:funder-brief': 'Funder brief',
  'newsletter-stream:youth-justice-brief': 'Youth justice',
  'newsletter-stream:media-pack': 'Media & brand',
  'newsletter-stream:daily-adelaide-recap': 'Contained · Adelaide',
};

function titleize(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

// A concrete deliverable we owe the funder — strongest "next move" signal.
// e.g. goods-impact-report-needed, goods-report-centrecorp-june26, goods-report-board-pack.
function hasReportDue(tags: string[]): boolean {
  return tags.some((t) => t === 'goods-impact-report-needed' || /^goods-report/.test(t));
}

function decodeTemperature(tags: string[]): Temperature {
  const present = new Set<Temperature>();
  for (const t of tags) {
    const mapped = TEMP_TAGS[t];
    if (mapped) present.add(mapped);
  }
  for (const t of TEMP_PRIORITY) if (present.has(t)) return t;
  return 'unknown';
}

function decodeEngagement(tags: string[]): EngagementTier {
  if (tags.some((t) => t === 'ring:vip' || /engagement:.*vip/.test(t))) return 'vip';
  if (tags.some((t) => t.startsWith('ring:'))) return 'inner';
  return 'standard';
}

function decodeInterests(tags: string[]): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    if (INTEREST_LABELS[t]) out.add(INTEREST_LABELS[t]);
    else if (t.startsWith('interest:')) out.add(titleize(t.slice('interest:'.length)));
    else if (t.startsWith('newsletter-stream:')) out.add(titleize(t.slice('newsletter-stream:'.length)));
  }
  return [...out];
}

function decodePrefixed(tags: string[], prefix: string, transform: (s: string) => string): string[] {
  const out = new Set<string>();
  for (const t of tags) if (t.startsWith(prefix)) out.add(transform(t.slice(prefix.length)));
  return [...out];
}

function daysBetween(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor((now - ms) / 86_400_000));
}

const FUNDED_STAGES: GoodsStage[] = ['committed', 'repeat'];

/**
 * Decode one relationship's raw GHL signal into actionable funder insight.
 * Deterministic: same inputs (+ now) → same output. No LLM, no I/O.
 */
export function decodeFunderInsight(input: FunderInsightInput): FunderInsight {
  const now = input.now ?? Date.now();
  const tags = (input.signal?.tags ?? []).filter(Boolean);
  const temperature = decodeTemperature(tags);
  const engagementTier = decodeEngagement(tags);
  const interests = decodeInterests(tags);
  const commsStreams = decodePrefixed(tags, 'comms:', titleize);
  const roles = decodePrefixed(tags, 'role:', titleize);
  const places = decodePrefixed(tags, 'place:', (s) => s.toUpperCase());
  const campaignStage = decodePrefixed(tags, 'campaign-stage:', titleize)[0] ?? null;
  const days = daysBetween(input.lastTouchAt, now);
  const funded = input.hasPrior || FUNDED_STAGES.includes(input.stage);
  const reportDue = hasReportDue(tags);
  const opportunityStage = input.signal?.opportunity_stage_name ?? null;
  const opportunityStatus = input.signal?.opportunity_status ?? null;

  // ---- Attention flags (the actionable "why now") ----
  const flags: InsightFlag[] = [];
  const cooling = temperature === 'cooling' || temperature === 'cold';
  if (reportDue) flags.push({ key: 'report-due', label: 'Report due', tone: 'urgent' });
  if (temperature === 'hot') flags.push({ key: 'hot', label: 'Hot — strike now', tone: 'opportunity' });
  if (cooling && funded) flags.push({ key: 'at-risk', label: 'Funded & cooling', tone: 'urgent' });
  else if (cooling) flags.push({ key: 'cooling', label: 'Cooling', tone: 'urgent' });
  if (temperature === 'inquiry') flags.push({ key: 'inquiry', label: 'New inquiry', tone: 'opportunity' });
  if (funded && days !== null && days > 60) flags.push({ key: 'overdue', label: `Overdue ${days}d`, tone: 'urgent' });
  if (!reportDue && funded && (/(steward|report)/i.test(opportunityStage ?? '') || input.stage === 'repeat')) {
    flags.push({ key: 'steward', label: 'Stewarding', tone: 'neutral' });
  }
  if (engagementTier === 'vip') flags.push({ key: 'vip', label: 'VIP', tone: 'positive' });

  // ---- Attention level (precedence: report-due > funded-cooling > hot > inquiry > overdue > ...) ----
  let attention: Attention = 'none';
  if (reportDue) attention = 'act-now';
  else if (cooling && funded) attention = 'act-now';
  else if (temperature === 'hot') attention = 'act-now';
  else if (temperature === 'inquiry') attention = 'act-now';
  else if (funded && days !== null && days > 60) attention = 'act-now';
  else if (cooling) attention = 'watch';
  else if (engagementTier === 'vip' && days !== null && days > 30) attention = 'watch';
  else if (temperature === 'warm' || temperature === 'steady') attention = 'steady';

  const nextMove = buildNextMove({
    name: input.name, temperature, funded, stage: input.stage, days,
    interests, opportunityStage, warmth: input.warmthDisplay, reportDue,
  });

  return {
    id: input.id,
    name: input.name,
    relationshipType: input.relationshipType,
    stage: input.stage,
    warmth: input.warmthDisplay,
    band: warmthBand(input.warmthDisplay),
    lastTouchAt: input.lastTouchAt,
    daysSinceTouch: days,
    totalReceived: input.totalReceived,
    hasPrior: input.hasPrior,
    temperature,
    temperatureRank: TEMP_RANK[temperature],
    engagementTier,
    campaignStage,
    interests,
    commsStreams,
    roles,
    places,
    opportunityStage,
    opportunityStatus,
    tagCount: tags.length,
    attention,
    flags,
    nextMove,
  };
}

function buildNextMove(p: {
  name: string;
  temperature: Temperature;
  funded: boolean;
  stage: GoodsStage;
  days: number | null;
  interests: string[];
  opportunityStage: string | null;
  warmth: number;
  reportDue: boolean;
}): string {
  const topic = p.interests[0];
  const topicClause = topic ? `the ${topic} update` : 'the latest Goods impact update';
  if (p.reportDue) {
    return `Report due — send ${p.name} their impact report; they're expecting it.`;
  }
  if ((p.temperature === 'cooling' || p.temperature === 'cold') && p.funded) {
    return `Re-warm — ${p.name} has cooled. Send ${topicClause} and book a call before the relationship goes cold.`;
  }
  if (p.temperature === 'hot') {
    const ahead = ['identified', 'researching', 'contacted', 'in_conversation'].includes(p.stage);
    return ahead ? `Strike while hot — move ${p.name} to a scoped ask now.` : `Hot — close the next tranche with ${p.name} while momentum is high.`;
  }
  if (p.temperature === 'inquiry') {
    return `New inquiry — respond within 48h with a tailored Goods one-pager.`;
  }
  if (p.funded && p.days !== null && p.days > 60) {
    return `Overdue stewardship — no touch in ${p.days}d. Send ${topicClause} to ${p.name}.`;
  }
  if (p.funded && (/(steward|report)/i.test(p.opportunityStage ?? '') || p.stage === 'repeat')) {
    return `Active grantee — send the next ${topic ?? 'impact'} touchpoint to keep the report rhythm.`;
  }
  if (p.temperature === 'cooling' || p.temperature === 'cold') {
    return `Cooling — re-open with ${topicClause}; don't let ${p.name} lapse.`;
  }
  if (p.warmth >= 50) return `Steady — keep ${p.name} warm with a quarterly ${topic ?? 'impact'} note.`;
  return `Qualify fit and confirm the program window for ${p.name}.`;
}

// ---- Sorting + summary helpers ----
const ATTENTION_ORDER: Record<Attention, number> = { 'act-now': 0, watch: 1, steady: 2, none: 3 };

/** act-now first, then hottest, then warmest. Stable, deterministic. */
export function rankInsights(a: FunderInsight, b: FunderInsight): number {
  if (a.attention !== b.attention) return ATTENTION_ORDER[a.attention] - ATTENTION_ORDER[b.attention];
  if (a.temperatureRank !== b.temperatureRank) return b.temperatureRank - a.temperatureRank;
  return b.warmth - a.warmth;
}

export type FunderInsightSummary = {
  total: number;
  actNow: number;
  hot: number;
  cooling: number;
  vip: number;
  withSignal: number;
};

export function summariseInsights(items: FunderInsight[]): FunderInsightSummary {
  return {
    total: items.length,
    actNow: items.filter((i) => i.attention === 'act-now').length,
    hot: items.filter((i) => i.temperature === 'hot').length,
    cooling: items.filter((i) => i.temperature === 'cooling' || i.temperature === 'cold').length,
    vip: items.filter((i) => i.engagementTier === 'vip').length,
    withSignal: items.filter((i) => i.tagCount > 0).length,
  };
}
