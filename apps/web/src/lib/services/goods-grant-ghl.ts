// Push a live grant round from the Goods Grants Triage into the GoHighLevel
// "Grants" pipeline as an opportunity at "Grant Opportunity Identified".
// Mirrors scripts/seed-goods-grants-ghl.mjs exactly (same pipeline, stage,
// triage contact, and opportunity custom fields) so UI pushes and engine seeds
// are indistinguishable in GHL. Idempotency: grant_opportunities.ghl_opportunity_id
// is checked by the caller before invoking; the discovery_source stamp
// (`civicgraph-grant:<grant_id>`) marks provenance in GHL.

const GHL_API_URL = 'https://services.leadconnectorhq.com';

const GRANTS_PIPELINE_ID = 'scom3L0kNwA1W0zPIzMe';
const STAGE_IDENTIFIED = '8124c61a-1175-461e-be5d-1fa64ef6dd65'; // Grant Opportunity Identified
// Every GHL opportunity needs a contact; engine-discovered grants attach to the
// purpose-built "GrantScope Triage" contact until a real funder contact exists.
const TRIAGE_CONTACT_ID = 'uAsIUWBHez3DzVex8rtm';

const CF = {
  funder: 'v0uQzbwOQvwsvQ1ORb0X',
  fit_score: 'xEzJNk9FpH75VRcrGFBF',
  geography: 'JAIpW72Zy66hWgG0ckXs',
  submission_link: 'GwPgNgVUr6MiyVOKqavt',
  submission_date: 'dRUwAKU9k70EOqsKVeWN',
  discovery_source: 'eZoHX9Y7dIZBhXM3i6Kx',
  amount_range: 'fdfztkiwIVdTU5jUTd9R',
};

export type GoodsGrantPushInput = {
  grantId: string;
  name: string;
  provider: string | null;
  fitScore: number | null;
  deadline: string | null;
  url: string | null;
  geography: string | null;
  amountMin: number | null;
  amountMax: number | null;
};

export type GoodsGrantPushResult =
  | { ok: true; opportunityId: string }
  | { ok: false; reason: 'no_credentials' | 'create_failed' | 'exception'; status?: number; detail?: string };

export async function pushGoodsGrantToGHL(input: GoodsGrantPushInput): Promise<GoodsGrantPushResult> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    console.error('[goods-grant-ghl] missing credentials — API_KEY:', !!apiKey, 'LOCATION_ID:', !!locationId);
    return { ok: false, reason: 'no_credentials' };
  }

  const money = (n: number | null) => (n ? `$${Number(n).toLocaleString()}` : null);
  const customFields = [
    { id: CF.funder, field_value: input.provider ?? '' },
    { id: CF.fit_score, field_value: input.fitScore == null ? '' : String(input.fitScore) },
    { id: CF.geography, field_value: input.geography ?? '' },
    { id: CF.submission_link, field_value: input.url ?? '' },
    { id: CF.submission_date, field_value: input.deadline ?? '' },
    { id: CF.discovery_source, field_value: `civicgraph-grant:${input.grantId}` },
    { id: CF.amount_range, field_value: [money(input.amountMin), money(input.amountMax)].filter(Boolean).join(' – ') },
  ].filter((f) => f.field_value !== '');

  try {
    const res = await fetch(`${GHL_API_URL}/opportunities/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({
        locationId,
        name: input.name.slice(0, 250),
        pipelineId: GRANTS_PIPELINE_ID,
        pipelineStageId: STAGE_IDENTIFIED,
        status: 'open',
        contactId: TRIAGE_CONTACT_ID,
        monetaryValue: Number(input.amountMax) || 0,
        customFields,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[goods-grant-ghl] create failed', res.status, detail.slice(0, 300));
      return { ok: false, reason: 'create_failed', status: res.status, detail: detail.slice(0, 300) };
    }
    const data = (await res.json()) as { opportunity?: { id?: string } };
    const opportunityId = data.opportunity?.id;
    if (!opportunityId) return { ok: false, reason: 'create_failed', detail: 'no opportunity id in response' };
    return { ok: true, opportunityId };
  } catch (e) {
    return { ok: false, reason: 'exception', detail: e instanceof Error ? e.message : 'unknown' };
  }
}
