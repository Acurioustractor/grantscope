// Push a Goods buyer entity into GoHighLevel as a contact.
// Mirrors apps/web/src/lib/services/partnership-ghl.ts patterns.
// Creates a contact tagged for Goods + community + buyer-role and attaches a
// Note that summarises the procurement context.

const GHL_API_URL = 'https://services.leadconnectorhq.com';

export type GoodsBuyerPushInput = {
  entityName: string;
  buyerRole: string | null;
  abn: string | null;
  website: string | null;
  communityName: string;
  communityState: string | null;
  isCommunityControlled: boolean;
  relationshipStatus: string | null;
  govtContractValue: number | null;
};

export type GoodsBuyerPushResult =
  | { ok: true; contactId: string; opportunityId?: string; opportunityWarning?: string }
  | { ok: false; reason: 'no_credentials' | 'upsert_failed' | 'no_contact_id' | 'exception'; status?: number; detail?: string };

export async function pushGoodsBuyerToGHL(opts: GoodsBuyerPushInput): Promise<GoodsBuyerPushResult> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    console.error('[goods-buyer-ghl] missing credentials — API_KEY:', !!apiKey, 'LOCATION_ID:', !!locationId);
    return { ok: false, reason: 'no_credentials' };
  }
  console.log('[goods-buyer-ghl] push:', opts.entityName, '→', opts.communityName);

  try {
    const tags = [
      'CivicGraph',
      'Goods',
      `Goods-Community-${opts.communityName.replace(/\s+/g, '-')}`,
      opts.communityState ? `Goods-State-${opts.communityState}` : null,
      opts.buyerRole ? `Goods-Role-${opts.buyerRole}` : null,
      opts.isCommunityControlled ? 'Goods-CommunityControlled' : null,
      opts.relationshipStatus ? `Goods-Stage-${opts.relationshipStatus}` : null,
    ].filter((t): t is string => !!t);

    // GHL /contacts/upsert requires email or phone as the matching key. We
    // don't have personal emails for entities like "Northern Land Council" yet,
    // so synthesize a deterministic identifier from the entity + community.
    // This keeps the upsert idempotent: pushing the same buyer twice updates
    // the same contact rather than creating a duplicate.
    const entitySlug = opts.entityName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    const communitySlug = opts.communityName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const syntheticEmail = `${entitySlug}-${communitySlug}@goods.civicgraph.io`;

    const upsertRes = await fetch(`${GHL_API_URL}/contacts/upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({
        locationId,
        email: syntheticEmail,
        companyName: opts.entityName,
        firstName: opts.entityName.slice(0, 80),
        website: opts.website || undefined,
        tags,
        source: `CivicGraph Goods workbench (${opts.communityName})`,
      }),
    });

    if (!upsertRes.ok) {
      const detail = await upsertRes.text().catch(() => '');
      console.error('[goods-buyer-ghl] contact upsert failed:', upsertRes.status, detail);
      return { ok: false, reason: 'upsert_failed', status: upsertRes.status, detail };
    }

    const data = await upsertRes.json();
    const contactId: string | undefined = data?.contact?.id;
    if (!contactId) {
      console.error('[goods-buyer-ghl] no contactId returned:', JSON.stringify(data).slice(0, 200));
      return { ok: false, reason: 'no_contact_id' };
    }
    console.log('[goods-buyer-ghl] contact upserted:', contactId);

    const lines = [
      `[CivicGraph Goods · ${opts.communityName} (${opts.communityState || '?'})]`,
      '',
      `Buyer: ${opts.entityName}`,
      opts.buyerRole ? `Role: ${opts.buyerRole}` : null,
      opts.abn ? `ABN: ${opts.abn}` : null,
      opts.website ? `Web: ${opts.website}` : null,
      opts.isCommunityControlled ? 'Community-controlled: yes' : null,
      opts.govtContractValue ? `Govt contracts to date: $${opts.govtContractValue.toLocaleString()}` : null,
      opts.relationshipStatus ? `Stage: ${opts.relationshipStatus}` : null,
      '',
      '---',
      `Pushed from Goods community page for ${opts.communityName}.`,
      `Next action: outreach intro + scope a procurement conversation.`,
    ].filter((l): l is string => l !== null);

    await fetch(`${GHL_API_URL}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({ body: lines.join('\n'), userId: '' }),
    }).catch(() => null);

    // Create opportunity on the Goods buyer pipeline at the "Buyer Identified"
    // initial stage. Non-fatal — if config is missing or the call errors, we
    // still return ok with the contact created and surface the warning.
    const pipelineId = process.env.GHL_GOODS_PIPELINE_ID;
    const stageId = process.env.GHL_GOODS_BUYER_STAGE_ID;
    let opportunityId: string | undefined;
    let opportunityWarning: string | undefined;

    if (!pipelineId || !stageId) {
      opportunityWarning = 'GHL_GOODS_PIPELINE_ID or GHL_GOODS_BUYER_STAGE_ID not set; skipped opportunity';
    } else {
      const oppName = `${opts.entityName} — ${opts.communityName}`;
      const monetaryValue = opts.govtContractValue ? Math.round(opts.govtContractValue * 0.01) : 0;
      const assignedTo = process.env.GHL_GOODS_DEFAULT_ASSIGNED_TO || undefined;

      // Anti-duplicate: search for an existing opportunity on this contact in
      // this pipeline before creating. GHL doesn't have an upsert-by-contact
      // for opportunities, so we do it manually.
      let existingOppId: string | null = null;
      try {
        const searchRes = await fetch(
          `${GHL_API_URL}/opportunities/search?location_id=${locationId}&pipeline_id=${pipelineId}&contact_id=${contactId}&limit=5`,
          { headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' } },
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const opps = (searchData.opportunities || []) as Array<{ id: string; name?: string }>;
          // Prefer exact-name match (idempotent re-push of the same buyer at
          // the same community). Fall back to first opp on the contact.
          const exact = opps.find(o => o.name === oppName);
          existingOppId = exact?.id || opps[0]?.id || null;
        }
      } catch (err) {
        console.warn('[goods-buyer-ghl] opp search failed (non-fatal):', err instanceof Error ? err.message : err);
      }

      if (existingOppId) {
        // Update existing opp — keep current stage if the team's moved it forward
        const updRes = await fetch(`${GHL_API_URL}/opportunities/${existingOppId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Version: '2021-07-28',
          },
          body: JSON.stringify({
            name: oppName,
            monetaryValue,
            ...(assignedTo ? { assignedTo } : {}),
          }),
        });
        if (updRes.ok) {
          opportunityId = existingOppId;
          console.log('[goods-buyer-ghl] opportunity updated (re-sync):', opportunityId);
        } else {
          const detail = await updRes.text().catch(() => '');
          console.error('[goods-buyer-ghl] opportunity update failed:', updRes.status, detail);
          opportunityWarning = `Opportunity update failed: ${updRes.status} ${detail.slice(0, 200)}`;
        }
      } else {
        const oppRes = await fetch(`${GHL_API_URL}/opportunities/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Version: '2021-07-28',
          },
          body: JSON.stringify({
            locationId,
            name: oppName,
            pipelineId,
            pipelineStageId: stageId,
            status: 'open',
            contactId,
            monetaryValue,
            ...(assignedTo ? { assignedTo } : {}),
            source: `Goods workbench · ${opts.communityName}`,
          }),
        });

        if (oppRes.ok) {
          const oppData = await oppRes.json();
          opportunityId = oppData?.opportunity?.id || oppData?.id;
          console.log('[goods-buyer-ghl] opportunity created:', opportunityId);
        } else {
          const detail = await oppRes.text().catch(() => '');
          console.error('[goods-buyer-ghl] opportunity create failed:', oppRes.status, detail);
          opportunityWarning = `Opportunity create failed: ${oppRes.status} ${detail.slice(0, 200)}`;
        }
      }
    }

    return { ok: true, contactId, opportunityId, opportunityWarning };
  } catch (err) {
    console.error('[goods-buyer-ghl] exception:', err);
    return { ok: false, reason: 'exception', detail: err instanceof Error ? err.message : String(err) };
  }
}
