/**
 * Goods Match Campaign — SERVER join. Marries the curated capital stack to the
 * live goods_relationships registry so each source can show its current warmth
 * and stage when a match is found. A DB failure must NEVER break the page: the
 * curated stack is the source of truth, the registry is enrichment only.
 */
import { getGoodsRelationshipsSafe } from './goods-engagement';
import type { GoodsRelationship } from './goods-engagement-shared';
import { CAPITAL_STACK, type CapitalSource } from './goods-campaign-data';

/** Match deadline for the QBE match raise. Hard date, not a guess. */
export const CAMPAIGN_DEADLINE = '2026-08-31';

/** Live registry enrichment attached to a source when a match is found. */
export interface CampaignEnrichment {
  warmth: number;
  stage: string;
  lastTouchAt: string | null;
  askAmountAud: number | null;
}

export interface EnrichedCapitalSource extends CapitalSource {
  /** Present only when the source matched a live goods_relationships row. */
  live: CampaignEnrichment | null;
}

export interface GoodsCampaign {
  sources: EnrichedCapitalSource[];
  deadline: string;
  fetchError: string | null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Find the best live registry row for a curated source. Matches
 * case-insensitively on registryName, then falls back to a contains test in
 * either direction so 'Snow Foundation' matches 'The Snow Foundation'.
 */
function matchRow(
  registryName: string | null,
  rows: GoodsRelationship[],
): GoodsRelationship | null {
  if (!registryName) return null;
  const target = norm(registryName);
  // Exact (case-insensitive) first.
  const exact = rows.find((r) => norm(r.display_name) === target);
  if (exact) return exact;
  // Then contains in either direction.
  const contains = rows.find((r) => {
    const name = norm(r.display_name);
    return name.includes(target) || target.includes(name);
  });
  return contains ?? null;
}

/**
 * Build the campaign view: curated capital stack enriched with live warmth/stage
 * where a registry match exists. On DB failure the sources still render, just
 * unenriched, and the fetchError is surfaced for an honest strip.
 */
export async function getGoodsCampaign(): Promise<GoodsCampaign> {
  const { rows, fetchError } = await getGoodsRelationshipsSafe();

  const sources: EnrichedCapitalSource[] = CAPITAL_STACK.map((src) => {
    const row = matchRow(src.registryName, rows);
    const live: CampaignEnrichment | null = row
      ? {
          warmth: row.warmth_display,
          stage: row.stage,
          lastTouchAt: row.last_touch_at,
          askAmountAud: row.ask_amount_aud,
        }
      : null;
    return { ...src, live };
  });

  return { sources, deadline: CAMPAIGN_DEADLINE, fetchError };
}
