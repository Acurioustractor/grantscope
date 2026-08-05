// The Org record: everything ACT knows about one Org on one screen.
// Composes the loaders that already fed the Listen view (relationship ledger,
// funder intelligence, relationship brief) plus the goods_relationships
// registry — no new queries against raw tables beyond a GHL freshness lookup.
// Domain language per CONTEXT.md: an Org holds typed Relationships; its Asks
// move through the five stages.
import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';
import {
  getActRelationshipLedger,
  normaliseRelationshipIdentity,
  relationshipNamesMatch,
  buildActRelationshipTimeline,
  type ActRelationshipLedger,
  type ActRelationshipLedgerItem,
  type ActRelationshipTimelineEvent,
} from '@/lib/services/act-relationship-ledger';
import { getActFunderIntelligence, type ActFunderDossier } from '@/lib/services/act-funder-intelligence';
import { buildActRelationshipBrief, type ActRelationshipBrief } from '@/lib/services/act-relationship-brief';
import { getGoodsRelationshipsSafe } from '@/lib/services/goods-engagement';
import type { GoodsRelationship, GoodsRelType, GoodsStage } from '@/lib/services/goods-engagement-shared';
import { ghlContactUrl } from '@/lib/ghl-links';

/** The six relationship types an Org can hold with ACT (CONTEXT.md). */
export type ActDomainRelType = 'funds' | 'buys' | 'distributes' | 'auspices' | 'collaborates' | 'opens';

export const DOMAIN_REL_LABEL: Record<ActDomainRelType, string> = {
  funds: 'Funds', buys: 'Buys', distributes: 'Distributes',
  auspices: 'Auspices', collaborates: 'Collaborates', opens: 'Opens',
};

/** The five Ask stages (CONTEXT.md), plus Dormant as the parked state. */
export type ActAskStage = 'open_door' | 'in_conversation' | 'asked' | 'won' | 'lost' | 'dormant';

export const ASK_STAGE_LABEL: Record<ActAskStage, string> = {
  open_door: 'Open door', in_conversation: 'In conversation', asked: 'Asked',
  won: 'Won', lost: 'Lost', dormant: 'Dormant',
};

export const ASK_STAGE_ORDER: ActAskStage[] = ['open_door', 'in_conversation', 'asked', 'won', 'lost', 'dormant'];

/** Every GoodsRelType maps onto exactly one domain relationship type. */
const GOODS_TYPE_TO_DOMAIN: Record<GoodsRelType, ActDomainRelType> = {
  funder: 'funds', impact_investor: 'funds', repayable_finance: 'funds',
  buyer: 'buys', production_partner: 'collaborates',
  supporter: 'opens', advocate: 'opens',
};

/** Every legacy GoodsStage maps onto exactly one of the five stages. */
const GOODS_STAGE_TO_ASK: Record<GoodsStage, ActAskStage> = {
  identified: 'open_door', researching: 'open_door',
  contacted: 'in_conversation', in_conversation: 'in_conversation',
  proposal: 'asked', committed: 'won', repeat: 'won',
  declined: 'lost', dormant: 'dormant',
};

/** Butterfly is ACT's DGR route — the one auspices relationship (act-core-facts). */
const AUSPICE_ORGS = ['butterfly movement'];

export interface ActOrgRelationship {
  type: ActDomainRelType;
  /** Human evidence for why the Org holds this relationship. */
  basis: string;
  warmth: number | null;
  source: 'goods_registry' | 'ledger' | 'derived';
}

export interface ActOrgAsk {
  id: string;
  stage: ActAskStage;
  purpose: string | null;
  amountAud: number | null;
  nextAction: string | null;
  nextActionDue: string | null;
  warmth: number;
  ghlContactId: string | null;
  ghlOpportunityId: string | null;
  relType: GoodsRelType;
}

export interface ActOrgGhlDoor {
  contactId: string;
  url: string | null;
  contactName: string | null;
  lastSyncedAt: string | null;
}

export interface ActOrgRecord {
  slug: string;
  name: string;
  relationships: ActOrgRelationship[];
  asks: ActOrgAsk[];
  ledgerItem: ActRelationshipLedgerItem | null;
  brief: ActRelationshipBrief | null;
  dossier: ActFunderDossier | null;
  timeline: ActRelationshipTimelineEvent[];
  ghl: ActOrgGhlDoor | null;
  generatedAt: string;
}

/** URL slug for an Org: its normalised identity, hyphenated. */
export function actOrgSlug(name: string): string {
  return normaliseRelationshipIdentity(name).replace(/ /g, '-');
}

export function actOrgHref(slug: string, orgName: string): string {
  return `/org/${slug}/orgs/${actOrgSlug(orgName)}`;
}

function slugToIdentity(orgParam: string): string {
  return normaliseRelationshipIdentity(orgParam.replace(/-/g, ' '));
}

function titleCase(identity: string): string {
  return identity.split(' ').map((t) => (t.length > 3 ? t[0].toUpperCase() + t.slice(1) : t.toUpperCase())).join(' ');
}

interface GhlSyncRow extends Record<string, unknown> {
  id: string;
  full_name: string | null;
  company_name: string | null;
  last_synced_at: string | null;
  ghl_updated_at: string | null;
  updated_at: string | null;
}

function relationshipsFor(orgName: string, goodsRows: GoodsRelationship[], ledgerItem: ActRelationshipLedgerItem | null): ActOrgRelationship[] {
  const rels: ActOrgRelationship[] = [];
  const add = (rel: ActOrgRelationship) => {
    if (!rels.some((existing) => existing.type === rel.type)) rels.push(rel);
  };
  for (const row of goodsRows) {
    add({
      type: GOODS_TYPE_TO_DOMAIN[row.relationship_type],
      basis: `${row.relationship_type.replace(/_/g, ' ')} in the Goods registry`,
      warmth: row.warmth_display,
      source: 'goods_registry',
    });
  }
  const identity = normaliseRelationshipIdentity(orgName);
  if (AUSPICE_ORGS.some((token) => identity.includes(token))) {
    add({ type: 'auspices', basis: 'DGR route for philanthropic money (Item 1 DGR + PBI)', warmth: null, source: 'derived' });
  }
  if (ledgerItem && rels.length === 0 && (ledgerItem.receivedTotal > 0 || ledgerItem.outstandingTotal > 0)) {
    add({ type: 'buys', basis: 'has paid ACT invoices (Xero)', warmth: null, source: 'ledger' });
  }
  return rels;
}

export const getActOrgRecord = cache(async function getActOrgRecord(
  slug: string,
  orgProfileId: string,
  orgParam: string,
): Promise<ActOrgRecord | null> {
  if (!isActSlug(slug)) return null;
  const identity = slugToIdentity(orgParam);
  if (!identity) return null;

  const [ledger, goods, intelligence] = await Promise.all([
    getActRelationshipLedger(slug, orgProfileId).catch(() => null as ActRelationshipLedger | null),
    getGoodsRelationshipsSafe().catch(() => ({ rows: [] as GoodsRelationship[], fetchError: 'unavailable' })),
    getActFunderIntelligence(orgProfileId).catch(() => null),
  ]);

  const ledgerItem = ledger?.items.find((item) => item.key === identity)
    ?? ledger?.items.find((item) => relationshipNamesMatch(item.organisation, identity))
    ?? null;
  const goodsRows = goods.rows.filter((row) => normaliseRelationshipIdentity(row.display_name) === identity
    || relationshipNamesMatch(row.display_name, identity));
  const dossier = intelligence?.dossiers.find((candidate) => normaliseRelationshipIdentity(candidate.name) === identity
    || relationshipNamesMatch(candidate.name, identity)) ?? null;

  const name = ledgerItem?.organisation ?? goodsRows[0]?.display_name ?? dossier?.name ?? null;
  if (!name && goodsRows.length === 0 && !ledgerItem && !dossier) {
    // Unknown Org: render honestly rather than 404 so links from stale data
    // still open a page that says what is missing.
    return {
      slug, name: titleCase(identity), relationships: [], asks: [],
      ledgerItem: null, brief: null, dossier: null, timeline: [], ghl: null,
      generatedAt: new Date().toISOString(),
    };
  }
  const displayName = name ?? titleCase(identity);

  const brief = dossier ? buildActRelationshipBrief(dossier, ledger) : null;

  const asks: ActOrgAsk[] = goodsRows.map((row) => ({
    id: row.id,
    stage: GOODS_STAGE_TO_ASK[row.stage] ?? 'open_door',
    purpose: row.ask_purpose,
    amountAud: row.ask_amount_aud,
    nextAction: row.next_action,
    nextActionDue: row.next_action_due,
    warmth: row.warmth_display,
    ghlContactId: row.ghl_contact_id,
    ghlOpportunityId: row.ghl_opportunity_id,
    relType: row.relationship_type,
  })).sort((left, right) => ASK_STAGE_ORDER.indexOf(left.stage) - ASK_STAGE_ORDER.indexOf(right.stage));

  // GHL door + freshness: the Ask lives in GHL, so every GHL-derived fact on
  // this screen carries its sync age (CONTEXT.md data-trust rules).
  let ghl: ActOrgGhlDoor | null = null;
  const knownContactId = goodsRows.find((row) => row.ghl_contact_id)?.ghl_contact_id ?? null;
  try {
    const db = getServiceSupabase();
    const { data } = await db
      .from('ghl_contacts')
      .select('id, full_name, company_name, last_synced_at, ghl_updated_at, updated_at')
      .or(knownContactId ? `id.eq.${knownContactId}` : `company_name.ilike.%${identity.split(' ')[0]}%`)
      .range(0, 49);
    const rows = ((data ?? []) as GhlSyncRow[]).filter((row) => (knownContactId && row.id === knownContactId)
      || relationshipNamesMatch(row.company_name, displayName));
    const best = rows[0] ?? null;
    if (best) {
      ghl = {
        contactId: best.id,
        url: ghlContactUrl(best.id),
        contactName: best.full_name,
        lastSyncedAt: best.last_synced_at ?? best.ghl_updated_at ?? best.updated_at ?? null,
      };
    }
  } catch {
    ghl = null;
  }
  if (!ghl && knownContactId) {
    ghl = { contactId: knownContactId, url: ghlContactUrl(knownContactId), contactName: null, lastSyncedAt: null };
  }

  return {
    slug,
    name: displayName,
    relationships: relationshipsFor(displayName, goodsRows, ledgerItem),
    asks,
    ledgerItem,
    brief,
    dossier,
    timeline: ledgerItem ? buildActRelationshipTimeline(ledgerItem) : [],
    ghl,
    generatedAt: new Date().toISOString(),
  };
});

export interface ActOrgListRow {
  slug: string;
  name: string;
  relationships: ActDomainRelType[];
  warmth: number | null;
  stage: ActAskStage | null;
  nextAction: string | null;
  outstandingTotal: number;
  receivedTotal: number;
  lastContactAt: string | null;
  hasGhl: boolean;
}

/** One searchable list of every Org ACT holds a relationship with. */
export async function getActOrgList(slug: string, orgProfileId: string): Promise<ActOrgListRow[]> {
  if (!isActSlug(slug)) return [];
  const [ledger, goods] = await Promise.all([
    getActRelationshipLedger(slug, orgProfileId).catch(() => null as ActRelationshipLedger | null),
    getGoodsRelationshipsSafe().catch(() => ({ rows: [] as GoodsRelationship[], fetchError: 'unavailable' })),
  ]);
  const rows = new Map<string, ActOrgListRow>();
  for (const item of ledger?.items ?? []) {
    rows.set(item.key, {
      slug: actOrgSlug(item.organisation),
      name: item.organisation,
      relationships: relationshipsFor(item.organisation, [], item).map((rel) => rel.type),
      warmth: null,
      stage: null,
      nextAction: item.followUp?.status === 'planned' ? item.followUp.action : item.nextMove,
      outstandingTotal: item.outstandingTotal,
      receivedTotal: item.receivedTotal,
      lastContactAt: item.lastContactAt,
      hasGhl: item.people.some((person) => person.source === 'ghl'),
    });
  }
  for (const row of goods.rows) {
    const key = normaliseRelationshipIdentity(row.display_name);
    if (!key) continue;
    const existing = rows.get(key);
    const domainType = GOODS_TYPE_TO_DOMAIN[row.relationship_type];
    if (existing) {
      if (!existing.relationships.includes(domainType)) existing.relationships.push(domainType);
      existing.warmth = Math.max(existing.warmth ?? 0, row.warmth_display);
      existing.stage = existing.stage ?? GOODS_STAGE_TO_ASK[row.stage] ?? null;
      existing.nextAction = existing.nextAction ?? row.next_action;
      existing.hasGhl = existing.hasGhl || Boolean(row.ghl_contact_id);
    } else {
      rows.set(key, {
        slug: actOrgSlug(row.display_name),
        name: row.display_name,
        relationships: [domainType],
        warmth: row.warmth_display,
        stage: GOODS_STAGE_TO_ASK[row.stage] ?? null,
        nextAction: row.next_action,
        outstandingTotal: 0,
        receivedTotal: row.total_received_aud,
        lastContactAt: row.last_touch_at,
        hasGhl: Boolean(row.ghl_contact_id),
      });
    }
  }
  return [...rows.values()].sort((left, right) => Number(right.outstandingTotal > 0) - Number(left.outstandingTotal > 0)
    || (right.warmth ?? -1) - (left.warmth ?? -1)
    || right.receivedTotal - left.receivedTotal
    || left.name.localeCompare(right.name));
}
