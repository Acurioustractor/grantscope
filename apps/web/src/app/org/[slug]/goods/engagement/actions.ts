'use server';

import { revalidatePath } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';
import { requireWriteAccess, type ActionResult } from '@/lib/services/goods-write-guard';
import { computeWarmth, REL_TRACK, type GoodsStage, type GoodsRelType } from '@/lib/services/goods-engagement-shared';

/** Relationship types a user may create (the engagement union, minus the 'all' filter sentinel). */
const ADDABLE_TYPES: GoodsRelType[] = [
  'funder', 'impact_investor', 'repayable_finance',
  'production_partner', 'buyer', 'supporter', 'advocate',
];

/** Tracks where a dollar ask is meaningful (grants + investment). */
const ASK_TRACKS = new Set(['grant', 'investment']);

/**
 * Hybrid-warmth write-back. Setting warmth_override pins the displayed warmth;
 * passing override = null clears it (display falls back to the computed score).
 * Changing stage recomputes warmth_computed from the row's current signal inputs.
 */
export async function updateRelationship(input: {
  id: string;
  slug: string;
  warmth_override?: number | null;
  stage?: GoodsStage;
  next_action?: string | null;
  target_stage?: string | null;
  notes?: string | null;
  ask_amount_aud?: number | null;
  ask_purpose?: string | null;
}): Promise<ActionResult> {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const supabase = getServiceSupabase();
  const patch: Record<string, unknown> = {};

  if (input.warmth_override !== undefined) {
    patch.warmth_override =
      input.warmth_override == null ? null : Math.max(0, Math.min(100, Math.round(input.warmth_override)));
  }
  if (input.stage !== undefined) patch.stage = input.stage;
  if (input.next_action !== undefined) patch.next_action = input.next_action?.trim() || null;
  if (input.target_stage !== undefined) patch.target_stage = input.target_stage || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  // Ask columns are not yet migrated — only include them in the payload when the
  // caller actually passed a value, so an untouched edit never references the
  // missing column. The DB error (if the migration is unapplied) is surfaced.
  if (input.ask_amount_aud !== undefined) {
    patch.ask_amount_aud =
      input.ask_amount_aud == null ? null : Math.max(0, Math.round(input.ask_amount_aud));
  }
  if (input.ask_purpose !== undefined) patch.ask_purpose = input.ask_purpose?.trim() || null;

  // recompute the computed baseline if stage moved
  if (input.stage !== undefined) {
    const { data: cur } = await supabase
      .from('goods_relationships')
      .select('last_touch_at, total_received_aud, alignment_score, has_prior_support, advocacy_score')
      .eq('id', input.id)
      .single();
    if (cur) {
      patch.warmth_computed = computeWarmth({
        stage: input.stage,
        lastTouch: cur.last_touch_at,
        totalReceived: Number(cur.total_received_aud) || 0,
        alignment: cur.alignment_score,
        hasPrior: cur.has_prior_support,
        advocacy: Number(cur.advocacy_score) || 0,
      });
    }
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from('goods_relationships').update(patch).eq('id', input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/org/${input.slug}/goods/engagement`);
  return { ok: true };
}

/**
 * Manually add a relationship of any type (no source table feeds manual rows).
 * Generalised from the old production-partner-only helper: validates the type
 * against the allowed union and accepts an optional dollar ask (only meaningful,
 * and only shown, for grant / investment tracks).
 */
export async function addRelationship(input: {
  slug: string;
  relationship_type: string;
  display_name: string;
  stage: GoodsStage;
  alignment_score?: number | null;
  last_touch_at?: string | null;
  notes?: string | null;
  ask_amount_aud?: number | null;
  ask_purpose?: string | null;
}): Promise<ActionResult> {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const name = input.display_name?.trim();
  if (!name) return { ok: false, error: 'Name is required' };

  const relType = input.relationship_type as GoodsRelType;
  if (!ADDABLE_TYPES.includes(relType)) {
    return { ok: false, error: `Unknown relationship type "${input.relationship_type}"` };
  }

  const supabase = getServiceSupabase();
  const warmth = computeWarmth({
    stage: input.stage,
    lastTouch: input.last_touch_at ?? null,
    totalReceived: 0,
    alignment: input.alignment_score ?? null,
    hasPrior: false,
    advocacy: 0,
  });

  const payload: Record<string, unknown> = {
    relationship_type: relType,
    display_name: name,
    stage: input.stage,
    alignment_score: input.alignment_score ?? null,
    last_touch_at: input.last_touch_at || null,
    notes: input.notes?.trim() || null,
    has_prior_support: false,
    warmth_computed: warmth,
    source_refs: { source: 'manual' },
  };

  // Only attach the not-yet-migrated ask columns when the user gave a value AND
  // the type's track is one where an ask makes sense (grant / investment).
  const askApplies = ASK_TRACKS.has(REL_TRACK[relType]);
  if (askApplies && input.ask_amount_aud != null && Number.isFinite(input.ask_amount_aud)) {
    payload.ask_amount_aud = Math.max(0, Math.round(input.ask_amount_aud));
  }
  if (askApplies && input.ask_purpose && input.ask_purpose.trim()) {
    payload.ask_purpose = input.ask_purpose.trim();
  }

  const { error } = await supabase.from('goods_relationships').insert(payload);
  if (error) {
    return {
      ok: false,
      error: error.message.includes('uq_goods_rel_dedupe')
        ? `A relationship named "${name}" of this type already exists`
        : error.message,
    };
  }
  revalidatePath(`/org/${input.slug}/goods/engagement`);
  return { ok: true };
}
