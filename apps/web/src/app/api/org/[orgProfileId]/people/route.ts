import { NextRequest, NextResponse } from 'next/server';
import { requireOrgWriteAccess } from '../../_lib/auth';
import { WARMTH_VALUES, ROLE_TYPES } from '@/lib/services/act-people';
import {
  createPersonContact,
  setWarmthTag,
  upsertNextActionTask,
  completeNextActionTask,
} from '@/lib/services/act-people-ghl';

type Params = { params: Promise<{ orgProfileId: string }> };

function text(v: unknown, limit = 400): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, limit) : null;
}

function isoDate(v: unknown): string | null {
  const s = text(v, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// Mint a Person (spec §5, ADR 0002): create/claim the GHL contact, write
// warmth + next-action to GHL FIRST, then mirror. Mandatory at mint: warmth
// (+ via when indirect) AND a next action with a review-by date. No inert
// People. If the GHL write fails, nothing is mirrored — surface the error.
export async function POST(request: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as Record<string, unknown>;
  const name = text(body.name, 200);
  const warmth = WARMTH_VALUES.find((w) => w === body.warmth);
  const nextAction = text(body.next_action, 800);
  const reviewBy = isoDate(body.review_by);
  if (!name || !warmth || !nextAction || !reviewBy) {
    return NextResponse.json(
      { error: 'name, warmth, next_action and review_by are required — no inert People' },
      { status: 400 }
    );
  }
  const warmVia = text(body.warm_via, 200);

  let ghlContactId = text(body.ghl_contact_id, 120); // present = claim
  try {
    if (!ghlContactId) {
      ghlContactId = await createPersonContact({ name, email: text(body.email, 200) });
    }
    await setWarmthTag(ghlContactId, warmth);
    const ghlTaskId = await upsertNextActionTask(ghlContactId, null, { nextAction, reviewBy, warmVia });

    const { data, error } = await auth.serviceDb
      .from('act_people')
      .insert({
        org_profile_id: orgProfileId,
        ghl_contact_id: ghlContactId,
        name,
        warmth,
        warm_via: warmVia,
        next_action: nextAction,
        review_by: reviewBy,
        ghl_task_id: ghlTaskId,
        minted_by: auth.userId,
        last_synced_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) {
      const dupe = error.code === '23505';
      return NextResponse.json(
        { error: dupe ? 'This GHL contact is already a Person' : error.message },
        { status: dupe ? 409 : 500 }
      );
    }

    const roleType = ROLE_TYPES.find((r) => r === (body.role as Record<string, unknown> | undefined)?.role_type);
    const roleOrg = text((body.role as Record<string, unknown> | undefined)?.org_name, 300);
    if (roleType && roleOrg) {
      await auth.serviceDb.from('act_person_roles').insert({
        person_id: data.id,
        role_type: roleType,
        org_name: roleOrg,
        org_ref: text((body.role as Record<string, unknown>).org_ref, 120),
        created_by: auth.userId,
      });
    }
    return NextResponse.json({ id: data.id, ghl_contact_id: ghlContactId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'GHL write failed' }, { status: 502 });
  }
}

// Edits. Relationship state (warmth, next action) goes to GHL then the
// mirror; roles write to Supabase directly (ADR 0002 deviation 2). Owner is
// mirror-only for now — GHL assignedTo needs a GHL user id, and the desk's
// owner is a plain name.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as Record<string, unknown>;
  const id = text(body.id, 60);
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { data: person, error: readError } = await auth.serviceDb
    .from('act_people')
    .select('id, ghl_contact_id, ghl_task_id, warm_via, next_action, review_by')
    .eq('id', id)
    .eq('org_profile_id', orgProfileId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  try {
    // Roles — Supabase-owned, no GHL involvement.
    const addRole = body.add_role as Record<string, unknown> | undefined;
    if (addRole) {
      const roleType = ROLE_TYPES.find((r) => r === addRole.role_type);
      const orgName = text(addRole.org_name, 300);
      if (!roleType || !orgName) {
        return NextResponse.json({ error: 'add_role needs role_type and org_name' }, { status: 400 });
      }
      const { error } = await auth.serviceDb.from('act_person_roles').insert({
        person_id: id,
        role_type: roleType,
        org_name: orgName,
        org_ref: text(addRole.org_ref, 120),
        created_by: auth.userId,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const removeRoleId = text(body.remove_role_id, 60);
    if (removeRoleId) {
      await auth.serviceDb.from('act_person_roles').delete().eq('id', removeRoleId).eq('person_id', id);
    }

    // Warmth — GHL tag replace first.
    const warmth = WARMTH_VALUES.find((w) => w === body.warmth);
    if (warmth) {
      await setWarmthTag(person.ghl_contact_id, warmth);
      patch.warmth = warmth;
    }
    if ('warm_via' in body) patch.warm_via = text(body.warm_via, 200);
    if ('owner' in body) patch.owner = text(body.owner, 120);

    // Next action / watch. Three moves (spec §4.3, #148 — never a bare dismiss):
    //   edit:            next_action (+ review_by) → update the GHL task
    //   done — set next: done=true + a NEW next_action + review_by
    //   release:         release=true → complete the task, drop to dateless tail
    const done = body.done === true;
    const release = body.release === true;
    const nextAction = text(body.next_action, 800);
    const reviewBy = isoDate(body.review_by);
    const warmVia = ('warm_via' in body ? (patch.warm_via as string | null) : person.warm_via) ?? null;

    if (release) {
      if (person.ghl_task_id) await completeNextActionTask(person.ghl_contact_id, person.ghl_task_id);
      patch.next_action = null;
      patch.review_by = null;
      patch.ghl_task_id = null;
    } else if (done) {
      if (!nextAction || !reviewBy) {
        return NextResponse.json(
          { error: 'Done requires the next action and review-by — or release explicitly' },
          { status: 400 }
        );
      }
      if (person.ghl_task_id) await completeNextActionTask(person.ghl_contact_id, person.ghl_task_id);
      patch.ghl_task_id = await upsertNextActionTask(person.ghl_contact_id, null, { nextAction, reviewBy, warmVia });
      patch.next_action = nextAction;
      patch.review_by = reviewBy;
    } else if (nextAction || reviewBy) {
      const action = nextAction ?? (person.next_action as string | null);
      const by = reviewBy ?? (person.review_by as string | null);
      if (!action || !by) {
        return NextResponse.json({ error: 'A next action needs both text and a review-by date' }, { status: 400 });
      }
      patch.ghl_task_id = await upsertNextActionTask(person.ghl_contact_id, person.ghl_task_id as string | null, {
        nextAction: action,
        reviewBy: by,
        warmVia,
      });
      patch.next_action = action;
      patch.review_by = by;
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'GHL write failed' }, { status: 502 });
  }

  patch.last_synced_at = new Date().toISOString();
  const { error } = await auth.serviceDb.from('act_people').update(patch).eq('id', id).eq('org_profile_id', orgProfileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
