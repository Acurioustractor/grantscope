'use server';

import { revalidatePath } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';
import { requireWriteAccess, type ActionResult } from '@/lib/services/goods-write-guard';
import { computeWarmth } from '@/lib/services/goods-engagement-shared';

/**
 * One-click "Track": drop a foundation target into the warmth registry as a
 * net-new funder relationship at stage `identified`. Setting `entity_id` to the
 * foundation's gs_entity_id is what removes it from v_goods_foundation_targets
 * (the view excludes any foundation already engaged by entity_id) — closing the
 * target → pipeline loop. Reuses the shared write guard + warmth model.
 */
export async function trackFoundationTarget(input: {
  slug: string;
  gsEntityId: string;
  name: string;
  themeHits?: number;
  connector?: string | null;
  bridgedOrg?: string | null;
}): Promise<ActionResult> {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'Name is required' };
  if (!input.gsEntityId) return { ok: false, error: 'Missing entity id — cannot track' };

  // Theme fit (0..~9 matched themes) seeds an alignment score so warmth reflects fit.
  const alignment = input.themeHits ? Math.min(100, input.themeHits * 20) : null;
  const warmth = computeWarmth({
    stage: 'identified', lastTouch: null, totalReceived: 0, alignment, hasPrior: false, advocacy: 0,
  });
  const warmIntroPath = input.connector
    ? `via ${input.connector}${input.bridgedOrg ? ` — also boards ${input.bridgedOrg}` : ''}`
    : null;

  const supabase = getServiceSupabase();
  const { error } = await supabase.from('goods_relationships').insert({
    relationship_type: 'funder',
    display_name: name,
    entity_id: input.gsEntityId,
    stage: 'identified',
    alignment_score: alignment,
    has_prior_support: false,
    warmth_computed: warmth,
    warm_intro_path: warmIntroPath,
    next_action: 'Qualify fit and confirm the program / grant window',
    source_refs: { source: 'foundation-target' },
  });

  if (error) {
    return {
      ok: false,
      error: error.message.includes('uq_goods_rel_dedupe') || error.message.includes('duplicate')
        ? `"${name}" is already in the warmth registry`
        : error.message,
    };
  }

  // Refresh the targets list (now excludes it) and the warmth map (now includes it).
  revalidatePath(`/org/${input.slug}/goods/foundations`);
  revalidatePath(`/org/${input.slug}/goods/engagement`);
  return { ok: true };
}
