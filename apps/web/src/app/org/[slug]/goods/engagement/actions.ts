'use server';

import { revalidatePath } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';
import { shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { computeWarmth, type GoodsStage } from '@/lib/services/goods-engagement-shared';

export interface ActionResult { ok: boolean; error?: string }

/**
 * Gate write access to the Goods engagement registry. These actions mutate
 * shared data with the service-role client, so they must verify the caller
 * before touching the DB. In production an authenticated super-admin
 * (`ADMIN_EMAILS`) is required; in local/dev fast-local-org mode writes are
 * allowed without auth to keep the dev loop frictionless — mirrors the org
 * layout's own fast-local bypass. Returns a failure `ActionResult` when the
 * caller is not permitted, or `null` when the write may proceed.
 */
async function requireWriteAccess(): Promise<ActionResult | null> {
  if (shouldUseFastLocalOrg()) return null; // dev/local bypass (NODE_ENV !== 'production')
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in to make changes.' };
  if (!isAdminEmail(user.email)) return { ok: false, error: 'You do not have permission to make changes.' };
  return null;
}

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

/** Manually add a production partner (no source table feeds these). */
export async function addProductionPartner(input: {
  slug: string;
  display_name: string;
  stage: GoodsStage;
  alignment_score?: number | null;
  last_touch_at?: string | null;
  notes?: string | null;
}): Promise<ActionResult> {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const name = input.display_name?.trim();
  if (!name) return { ok: false, error: 'Name is required' };

  const supabase = getServiceSupabase();
  const warmth = computeWarmth({
    stage: input.stage,
    lastTouch: input.last_touch_at ?? null,
    totalReceived: 0,
    alignment: input.alignment_score ?? null,
    hasPrior: false,
    advocacy: 0,
  });

  const { error } = await supabase.from('goods_relationships').insert({
    relationship_type: 'production_partner',
    display_name: name,
    stage: input.stage,
    alignment_score: input.alignment_score ?? null,
    last_touch_at: input.last_touch_at || null,
    notes: input.notes?.trim() || null,
    has_prior_support: false,
    warmth_computed: warmth,
    source_refs: { source: 'manual' },
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes('uq_goods_rel_dedupe')
        ? `A production partner named "${name}" already exists`
        : error.message,
    };
  }
  revalidatePath(`/org/${input.slug}/goods/engagement`);
  return { ok: true };
}
