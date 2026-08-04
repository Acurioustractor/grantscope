'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireWriteAccess } from '@/lib/services/goods-write-guard';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NEXT_MOVES = new Set(['act', 'listen', 'verify', 'revisit', 'close']);

export interface GoodsMatterReviewInput {
  slug: string;
  orgProfileId: string;
  matterSlug: string;
  evidenceGaps: string[];
  supersedesId?: string | null;
  whatChanged: string;
  nextMove: string;
  nextLearningQuestion?: string | null;
  revisitAt?: string | null;
  commitment?: {
    kind: 'commitment' | 'return';
    owner: string;
    beneficiary?: string | null;
    action: string;
    dueAt?: string | null;
  } | null;
}

export interface GoodsMatterReviewResult {
  ok: boolean;
  error?: string;
  nextStep?: string;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validDate(value: string | null | undefined): boolean {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

export async function recordGoodsMatterReview(
  input: GoodsMatterReviewInput,
): Promise<GoodsMatterReviewResult> {
  const denied = await requireWriteAccess();
  if (denied) return denied;
  if (!UUID.test(input.orgProfileId)) return { ok: false, error: 'A persisted organisation profile is required.' };
  if (!input.matterSlug.trim()) return { ok: false, error: 'A funding matter is required.' };
  if (!input.whatChanged.trim()) return { ok: false, error: 'Record what changed in your understanding.' };
  if (!NEXT_MOVES.has(input.nextMove)) return { ok: false, error: 'Choose a valid next move.' };
  if (input.nextMove === 'revisit' && !validDate(input.revisitAt)) {
    return { ok: false, error: 'Choose a valid revisit date.' };
  }
  if (input.supersedesId && !UUID.test(input.supersedesId)) {
    return { ok: false, error: 'The earlier review reference is invalid.' };
  }

  const commitment = input.commitment;
  if (commitment) {
    if (!['commitment', 'return'].includes(commitment.kind)) {
      return { ok: false, error: 'Choose commitment or return.' };
    }
    if (!commitment.owner.trim() || !commitment.action.trim()) {
      return { ok: false, error: 'A real promise or return needs an owner and a concrete action.' };
    }
    if (commitment.dueAt && !validDate(commitment.dueAt)) {
      return { ok: false, error: 'Choose a valid promise or return due date.' };
    }
  }

  const auth = await createSupabaseServer();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in to record a review.' };

  const judgment = {
    schemaVersion: 1,
    whatChanged: input.whatChanged.trim(),
    nextMove: input.nextMove,
    nextLearningQuestion: clean(input.nextLearningQuestion),
    revisitAt: input.nextMove === 'revisit' ? clean(input.revisitAt) : null,
    commitment: commitment
      ? {
          kind: commitment.kind,
          owner: commitment.owner.trim(),
          beneficiary: clean(commitment.beneficiary),
          action: commitment.action.trim(),
          dueAt: clean(commitment.dueAt),
        }
      : null,
  };

  const db = getServiceSupabase();
  const { data, error } = await db.rpc('record_opportunity_review', {
    p_user_id: user.id,
    p_org_profile_id: input.orgProfileId,
    p_source_type: 'goods',
    p_source_ref: input.matterSlug,
    p_project_code: 'ACT-GD',
    p_pathway: 'capital',
    p_reason: null,
    p_notes: null,
    p_evidence_gaps: Array.from(new Set(input.evidenceGaps.map((gap) => gap.trim()).filter(Boolean))),
    p_outcome: null,
    p_judgment: judgment,
    p_supersedes_id: input.supersedesId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result !== 'object' || !('decision_id' in result)) {
    return { ok: false, error: 'The review ledger did not return a decision reference.' };
  }

  revalidatePath(`/org/${input.slug}/goods/today`);
  revalidatePath(`/org/${input.slug}/goods/matters`);
  revalidatePath(`/org/${input.slug}/goods/matters/${input.matterSlug}`);
  revalidatePath(`/org/${input.slug}/goods/network`);
  revalidatePath(`/org/${input.slug}/goods/learning`);
  return {
    ok: true,
    nextStep: 'Review appended. No relationship stage or external system was changed.',
  };
}
