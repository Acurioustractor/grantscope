/**
 * "Who funds organisations like mine?" — the first step of the community money finder
 * (thoughts/shared/plans/2026-09-22-community-money-finder.md).
 *
 * Peers = charities with the same Jev main sector (confidence >= 0.9), same state and, when the org
 * has one, the same ACNC size band. Funders = who paid those peers in the last five financial years,
 * from GrantConnect awards and the justice_funding grant lane. Ranked by how many peers a program
 * funded, because breadth says more about whether a program funds orgs like you than one big cheque.
 *
 * PROTOTYPE: Jev labels are read from data/jev-check/charity-classify.jsonl on local disk
 * (scripts/jev-charity-classify.mjs). They need a table before this can deploy.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyGrantFilters, isRealRecipient } from '@/lib/justice-money';

export const MIN_CONFIDENCE = 0.9;
export const SINCE_YEAR = 2021;

export const SECTORS: Record<string, string> = {
  health: 'Health services',
  medical_research: 'Medical research',
  disability: 'Disability',
  aged_care: 'Aged care',
  school: 'Schools',
  higher_education: 'Universities',
  other_education: 'Other education and training',
  justice: 'Justice and legal',
  housing: 'Housing and homelessness',
  children_families_youth: 'Children, families and youth',
  social_welfare: 'Community and welfare',
  religion: 'Religion',
  arts_culture: 'Arts and culture',
  environment_animals: 'Environment and animals',
  sport_recreation: 'Sport and recreation',
  international: 'Overseas aid',
  grantmaking: 'Grantmaking',
  land_economic: 'Land councils and economic development',
  other: 'Other',
};

type Label = { sector: string | null; sector_conf: number | null };
let labels: Map<string, Label> | null = null;
let labelsMtime = 0;

function jevLabels(): Map<string, Label> {
  const candidates = [
    path.resolve(process.cwd(), '../../data/jev-check/charity-classify.jsonl'),
    path.resolve(process.cwd(), 'data/jev-check/charity-classify.jsonl'),
  ];
  const file = candidates.find((p) => existsSync(p));
  // Re-read when the file changes: the Jev run appends while the page is being used.
  const mtime = file ? statSync(file).mtimeMs : 0;
  if (labels && mtime === labelsMtime) return labels;
  labelsMtime = mtime;
  labels = new Map();
  if (!file) return labels;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      const r = JSON.parse(line);
      labels.set(r.abn, { sector: r.sector, sector_conf: r.sector_conf });
    } catch {
      // a half-written last line while the run is still going
    }
  }
  return labels;
}

export function sectorFor(abn: string): { sector: string | null; confidence: number | null } {
  const l = jevLabels().get(abn);
  return { sector: l?.sector ?? null, confidence: l?.sector_conf ?? null };
}

export function labelledCount(): number {
  return jevLabels().size;
}

const band = (s: string | null | undefined) => (s ? s.trim().toLowerCase() : null);

export interface Org {
  abn: string;
  name: string;
  state: string | null;
  size: string | null;
}

export async function findPeers(
  db: SupabaseClient,
  me: { abn: string; sector: string; state: string; size: string | null },
): Promise<Org[]> {
  const L = jevLabels();
  const peers: Org[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('acnc_charities')
      .select('abn, name, state, charity_size')
      .eq('state', me.state)
      .range(from, from + 999);
    if (error) throw new Error(`peers: ${error.message}`);
    for (const c of data ?? []) {
      if (c.abn === me.abn) continue;
      const l = L.get(c.abn);
      if (!l || l.sector !== me.sector || (l.sector_conf ?? 0) < MIN_CONFIDENCE) continue;
      // size 'any' = no filter; 'not_large' (the default when we do not know the org's size, e.g. ORIC
      // corporations that do not file with the ACNC) keeps a small clinic from being compared with a PHN.
      const b = band(c.charity_size);
      if (me.size === 'not_large' ? b === 'large' : me.size && me.size !== 'any' && b !== band(me.size)) continue;
      peers.push({ abn: c.abn, name: c.name, state: c.state, size: c.charity_size });
    }
    if (!data || data.length < 1000) break;
  }
  return peers;
}

export interface Grant {
  source: 'Commonwealth (GrantConnect)' | 'Justice funding';
  funder: string;
  program: string;
  recipient: string;
  recipientAbn: string;
  amount: number | null;
  year: number | null;
  ref: string;
}

const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export async function peerGrants(db: SupabaseClient, peers: Org[]): Promise<Grant[]> {
  const abns = peers.map((p) => p.abn);
  const out: Grant[] = [];
  for (const part of chunks(abns, 200)) {
    const { data: gc, error: e1 } = await db
      .from('grantconnect_awards')
      .select('ga_id, agency, grant_program, go_title, recipient_name, recipient_abn, value_aud, approval_date')
      .in('recipient_abn', part)
      .gte('approval_date', `${SINCE_YEAR}-07-01`)
      .limit(5000);
    if (e1) throw new Error(`grantconnect: ${e1.message}`);
    for (const g of gc ?? []) {
      out.push({
        source: 'Commonwealth (GrantConnect)',
        funder: g.agency ?? 'Unknown agency',
        program: g.grant_program || g.go_title || 'Unnamed program',
        recipient: g.recipient_name ?? '',
        recipientAbn: g.recipient_abn ?? '',
        amount: g.value_aud,
        year: g.approval_date ? Number(g.approval_date.slice(0, 4)) : null,
        ref: `GrantConnect ${g.ga_id}`,
      });
    }
    const { data: jf, error: e2 } = await applyGrantFilters(
      db
        .from('justice_funding')
        .select('id, source, program_name, state, recipient_name, recipient_abn, amount_dollars, financial_year')
        .in('recipient_abn', part),
    ).limit(5000);
    if (e2) throw new Error(`justice: ${e2.message}`);
    for (const j of jf ?? []) {
      const year = j.financial_year ? Number(String(j.financial_year).slice(0, 4)) : null;
      if (!year || year < SINCE_YEAR || !isRealRecipient(j.recipient_name)) continue;
      out.push({
        source: 'Justice funding',
        funder: j.state ? `${j.state} government` : 'Government',
        program: j.program_name ?? 'Unnamed program',
        recipient: j.recipient_name ?? '',
        recipientAbn: j.recipient_abn ?? '',
        amount: j.amount_dollars,
        year,
        ref: `${j.source ?? 'justice_funding'} ${j.id}`,
      });
    }
  }
  return out;
}

export interface Program {
  funder: string;
  program: string;
  source: Grant['source'];
  peersFunded: number;
  grants: number;
  medianGrant: number | null;
  total: number;
  latestYear: number | null;
  examples: Grant[];
}

export function rankPrograms(grants: Grant[]): Program[] {
  const by = new Map<string, Grant[]>();
  for (const g of grants) {
    const k = `${g.funder}|${g.program}`;
    by.set(k, [...(by.get(k) ?? []), g]);
  }
  const progs: Program[] = [];
  for (const gs of by.values()) {
    const amounts = gs.map((g) => g.amount).filter((a): a is number => a != null && a > 0).sort((a, b) => a - b);
    progs.push({
      funder: gs[0].funder,
      program: gs[0].program,
      source: gs[0].source,
      peersFunded: new Set(gs.map((g) => g.recipientAbn)).size,
      grants: gs.length,
      medianGrant: amounts.length
        ? amounts.length % 2
          ? amounts[(amounts.length - 1) / 2]
          : (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2
        : null,
      total: amounts.reduce((s, a) => s + a, 0),
      latestYear: Math.max(...gs.map((g) => g.year ?? 0)) || null,
      examples: [...gs].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).slice(0, 3),
    });
  }
  return progs.sort((a, b) => b.peersFunded - a.peersFunded || b.total - a.total);
}

export interface Holder {
  abn: string;
  name: string;
  total: number;
  grants: number;
  topAgency: string;
  latestYear: number | null;
  isPeer: boolean;
}

/**
 * Who holds the money for your region and your kind of work.
 *
 * Ampilatwatja Health Centre showed why this is needed: six small NT health organisations, not one
 * public grant between them since 2021. The money for remote health goes to intermediaries (the NT
 * Primary Health Network took $50m, $32.5m and $26.1m) which then subcontract. "No grants" reads as
 * an absence; naming who does hold it is the thing a small organisation can act on.
 *
 * Money DELIVERED in the state (delivery_state), by recipients whose own main work Jev puts in the
 * same sector, at any size. It does not prove any of them subcontract: it says where the money for
 * this work in this place lands.
 */
export async function regionHolders(
  db: SupabaseClient,
  opts: { sector: string; state: string; peerAbns: Set<string> },
): Promise<Holder[]> {
  const L = jevLabels();
  const totals = new Map<string, Holder & { agencies: Map<string, number> }>();
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await db
      .from('grantconnect_awards')
      .select('agency, recipient_name, recipient_abn, value_aud, approval_date')
      .eq('delivery_state', opts.state)
      .gte('approval_date', `${SINCE_YEAR}-07-01`)
      .range(from, from + 999);
    if (error) throw new Error(`holders: ${error.message}`);
    for (const g of data ?? []) {
      const abn = g.recipient_abn ?? '';
      const l = L.get(abn);
      if (!l || l.sector !== opts.sector || (l.sector_conf ?? 0) < MIN_CONFIDENCE) continue;
      const h = totals.get(abn) ?? {
        abn,
        name: g.recipient_name ?? abn,
        total: 0,
        grants: 0,
        topAgency: '',
        latestYear: null,
        isPeer: opts.peerAbns.has(abn),
        agencies: new Map<string, number>(),
      };
      h.total += g.value_aud ?? 0;
      h.grants += 1;
      const year = g.approval_date ? Number(g.approval_date.slice(0, 4)) : null;
      if (year && (!h.latestYear || year > h.latestYear)) h.latestYear = year;
      if (g.agency) h.agencies.set(g.agency, (h.agencies.get(g.agency) ?? 0) + (g.value_aud ?? 0));
      totals.set(abn, h);
    }
    if (!data || data.length < 1000) break;
  }
  return [...totals.values()]
    .map((h) => ({ ...h, topAgency: [...h.agencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Unknown' }))
    .sort((a, b) => b.total - a.total);
}
