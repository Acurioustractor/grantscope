import { describe, expect, it } from 'vitest';
import {
  GOODS_CANONICAL_IMPACT_FALLBACK,
  GOODS_CANONICAL_IMPACT_URL,
  GOODS_PLACE_CROSSWALK,
  buildGoodsLivingDataSnapshot,
  getGoodsCanonicalImpactSummary,
  goodsCanonicalImpactFallback,
  parseGoodsCanonicalImpactSummary,
  type GoodsLivingAssetRow,
  type GoodsLivingRowsBundle,
} from '@/lib/services/goods-living-data-adapter';

const TENNANT_COMMUNITY_ID = '61184d6b-bfc7-4e30-8567-77809f8d0361';
const PALM_COMMUNITY_ID = '61475b5b-3617-47c4-9fb7-3e8f8b4171df';

function assetRows(
  count: number,
  input: {
    prefix: string;
    communityId: string | null;
    communityName: string;
    replacementCount: number;
    pre2010Count?: number;
  },
): GoodsLivingAssetRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${input.prefix}-${index + 1}`,
    goods_asset_id: `${input.prefix.toUpperCase()}-${index + 1}`,
    community_id: input.communityId,
    product_slug: 'stretch-bed',
    product_type: 'Stretch Bed',
    community_name: input.communityName,
    current_status: 'deployed',
    deployed_at: index < (input.pre2010Count ?? 0)
      ? '2000-01-01T00:00:00.000Z'
      : '2025-08-01T00:00:00.000Z',
    last_checkin_at: null,
    is_overdue: true,
    needs_replacement: index < input.replacementCount,
    funded_by_label: null,
    funded_via_invoice: null,
    last_synced_at: '2026-07-27T10:00:05.748Z',
    updated_at: '2026-07-27T10:00:05.748Z',
  }));
}

function replacementSignals(
  count: number,
  communityId: string,
  prefix: string,
) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    community_id: communityId,
    buyer_entity_id: null,
    signal_type: 'asset_end_of_life',
    priority: 'medium',
    title: 'Generated asset end-of-life signal',
    description: null,
    estimated_value: null,
    estimated_units: 1,
    products_needed: ['bed'],
    funding_confidence: 'unknown',
    status: 'new',
    action_notes: null,
    actioned_at: null,
    created_at: '2026-05-14T20:00:04.770Z',
    updated_at: '2026-05-15T20:00:38.350Z',
  }));
}

function invoice(
  invoiceNumber: string,
  status: 'PAID' | 'VOIDED',
  amount: number,
  paidAmount: number,
  date: string,
) {
  return {
    xero_id:
      invoiceNumber === 'INV-0317'
        ? '44f9de6e-50f7-4663-955b-75b81566cd3b'
        : `xero-${invoiceNumber}`,
    invoice_number: invoiceNumber,
    type: 'ACCREC',
    status,
    contact_name: 'Historical counterparty',
    date,
    total: amount,
    amount_paid: paidAmount,
    amount_due: 0,
    reference: null,
    project_code: 'ACT-GD',
    updated_at: '2026-07-21T04:34:55.073Z',
    synced_at: '2026-07-21T04:34:54.870Z',
  };
}

function bundle(
  overrides: Partial<GoodsLivingRowsBundle> = {},
): GoodsLivingRowsBundle {
  const oonchiumpaLinks = ['oon-contact-1', 'oon-contact-2'].map(
    (contactId) => ({
      contact_id: contactId,
      entity_id: '16cadc21-083d-4d5e-8b9f-7dc6dca33b38',
      confidence_score: 0.95,
      verified: true,
      updated_at: '2026-07-20T00:00:00.000Z',
    }),
  );
  const utopiaLinks = ['utopia-contact-1', 'utopia-contact-2'].map(
    (contactId) => ({
      contact_id: contactId,
      entity_id: '6e1c9849-b5d5-4c1b-b129-e75b0d518bd8',
      confidence_score: 0.9,
      verified: false,
      updated_at: '2026-07-20T00:00:00.000Z',
    }),
  );
  const palmLinks = Array.from({ length: 9 }, (_, index) => ({
    contact_id: `palm-contact-${index + 1}`,
    entity_id: '18fc2705-463c-4b27-8dbd-0ca79c640582',
    confidence_score: 0.95,
    verified: true,
    updated_at: '2026-07-20T00:00:00.000Z',
  }));
  const contacts = [
    ...oonchiumpaLinks.map((link, index) => ({
      id: link.contact_id,
      ghl_id: `ghl-${link.contact_id}`,
      full_name: `Oonchiumpa contact ${index + 1}`,
      company_name: 'Oonchiumpa Consultancy & Services',
      last_contact_date: index === 0
        ? '2026-06-05T00:00:00.000Z'
        : '2026-05-20T00:00:00.000Z',
      last_synced_at: '2026-07-28T10:00:00.000Z',
      updated_at: '2026-07-28T10:00:00.000Z',
    })),
    ...utopiaLinks.map((link, index) => ({
      id: link.contact_id,
      ghl_id: `ghl-${link.contact_id}`,
      full_name: `Urapuntja contact ${index + 1}`,
      company_name: 'Urapuntja Aboriginal Corporation',
      last_contact_date: index === 0
        ? '2025-09-29T00:00:00.000Z'
        : null,
      last_synced_at: '2026-07-28T10:00:00.000Z',
      updated_at: '2026-07-28T10:00:00.000Z',
    })),
    ...palmLinks.map((link, index) => ({
      id: link.contact_id,
      ghl_id: `ghl-${link.contact_id}`,
      full_name: `PICC contact ${index + 1}`,
      company_name: 'Palm Island Community Company Limited',
      last_contact_date: index === 0
        ? '2026-06-08T00:00:00.000Z'
        : '2026-05-01T00:00:00.000Z',
      last_synced_at: '2026-07-28T10:00:00.000Z',
      updated_at: '2026-07-28T10:00:00.000Z',
    })),
  ];
  const palmTouchpoints = [5, 4, 4, 4, 4, 4, 3, 3, 3];

  return {
    communities: {
      rows: [
        {
          id: TENNANT_COMMUNITY_ID,
          community_name: 'TENNANT CREEK',
          aliases: [],
          state: 'NT',
          postcode: '0860',
          priority: 'lead',
          signal_type: null,
          signal_source: null,
          demand_beds: 0,
          demand_washers: 0,
          assets_deployed: 146,
          assets_active: 0,
          assets_overdue: 146,
          latest_checkin_date: null,
          known_buyer_name: null,
          proof_line: null,
          story: null,
          data_quality_score: null,
          last_profiled_at: null,
          data_sources: ['goods_asset_data'],
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-05-13T21:14:22.451Z',
        },
        {
          id: PALM_COMMUNITY_ID,
          community_name: 'PALM ISLAND',
          aliases: [],
          state: 'QLD',
          postcode: '4895',
          priority: 'warm',
          signal_type: null,
          signal_source: null,
          demand_beds: 52,
          demand_washers: 6,
          assets_deployed: 141,
          assets_active: 0,
          assets_overdue: 141,
          latest_checkin_date: null,
          known_buyer_name: null,
          proof_line: null,
          story: null,
          data_quality_score: null,
          last_profiled_at: null,
          data_sources: ['goods_asset_data'],
          created_at: '2026-03-13T00:00:00.000Z',
          updated_at: '2026-03-28T21:15:16.866Z',
        },
        {
          id: 'wrong-id-but-fuzzy-name',
          community_name: 'Oonchiumpa Community',
          aliases: ['Oonchiumpa'],
          state: 'NT',
          postcode: '0870',
          priority: 'active',
          signal_type: 'exact',
          signal_source: 'manual',
          demand_beds: 999,
          demand_washers: 999,
          assets_deployed: 999,
          assets_active: 999,
          assets_overdue: 0,
          latest_checkin_date: '2026-07-28T00:00:00.000Z',
          known_buyer_name: null,
          proof_line: 'This fuzzy row must not match.',
          story: null,
          data_quality_score: 100,
          last_profiled_at: '2026-07-28T00:00:00.000Z',
          data_sources: ['test'],
          created_at: '2026-07-28T00:00:00.000Z',
          updated_at: '2026-07-28T00:00:00.000Z',
        },
      ],
      error: null,
    },
    assets: {
      rows: [
        ...assetRows(146, {
          prefix: 'tennant',
          communityId: TENNANT_COMMUNITY_ID,
          communityName: 'Tennant Creek',
          replacementCount: 139,
          pre2010Count: 135,
        }),
        ...assetRows(141, {
          prefix: 'palm',
          communityId: PALM_COMMUNITY_ID,
          communityName: 'Palm Island',
          replacementCount: 141,
          pre2010Count: 141,
        }),
        ...assetRows(68, {
          prefix: 'utopia',
          communityId: null,
          communityName: 'Utopia Homelands',
          replacementCount: 0,
        }),
      ],
      error: null,
    },
    deployments: { rows: [], error: null },
    procurementSignals: {
      rows: [
        ...replacementSignals(139, TENNANT_COMMUNITY_ID, 'tennant-eol'),
        ...replacementSignals(141, PALM_COMMUNITY_ID, 'palm-eol'),
        {
          id: 'palm-demand-unmet',
          community_id: PALM_COMMUNITY_ID,
          buyer_entity_id: null,
          signal_type: 'demand_unmet',
          priority: 'high',
          title: 'Generated unmet demand',
          description: null,
          estimated_value: 39_000,
          estimated_units: 52,
          products_needed: ['bed'],
          funding_confidence: 'unknown',
          status: 'new',
          action_notes: null,
          actioned_at: null,
          created_at: '2026-04-22T20:00:40.084Z',
          updated_at: '2026-05-13T19:41:27.911Z',
        },
      ],
      error: null,
    },
    procurementEntities: {
      rows: Array.from({ length: 17 }, (_, index) => ({
        id: `wrong-palm-map-${index + 1}`,
        community_id: PALM_COMMUNITY_ID,
        entity_id: null,
        entity_name: `Cooktown mapped organisation ${index + 1}`,
        buyer_role: 'community_org',
        relationship_status: 'prospect',
        next_action: null,
        last_contact_date: null,
        estimated_annual_spend: null,
        product_fit: [],
        is_community_controlled: null,
        updated_at: '2026-03-28T20:26:04.817Z',
      })),
      error: null,
    },
    relationships: {
      rows: [
        {
          id: '0dfec60d-eabc-4328-aeae-498ca6c7e03b',
          relationship_type: 'supporter',
          display_name: 'PICC (Palm Island Community Company)',
          entity_id: null,
          ghl_contact_id: null,
          ghl_opportunity_id: null,
          stage: 'in_conversation',
          last_touch_at: '2026-05-15T00:00:00.000Z',
          next_action: 'Stale internal task that must not replace the canonical decision.',
          next_action_due: '2026-06-30',
          ask_amount_aud: 30_000,
          ask_purpose: 'In-kind and video collaboration',
          updated_at: '2026-06-11T02:01:11.038Z',
        },
        {
          id: 'fuzzy-oonchiumpa-name',
          relationship_type: 'production_partner',
          display_name: 'Oonchiumpa Consultancy',
          entity_id: null,
          ghl_contact_id: null,
          ghl_opportunity_id: null,
          stage: 'in_conversation',
          last_touch_at: '2026-07-21T00:00:00.000Z',
          next_action: 'This row must not be joined by display name.',
          next_action_due: null,
          ask_amount_aud: null,
          ask_purpose: null,
          updated_at: '2026-07-21T00:00:00.000Z',
        },
      ],
      error: null,
    },
    ghlOpportunities: {
      rows: [
        {
          ghl_id: '1JmWFa6nNFc4RAv6mggx',
          name: 'Alice Springs / Oonchiumpa — Community Production Pathway',
          pipeline_name: 'Goods — Community Pathways',
          stage_name: 'Modules selected',
          status: 'open',
          monetary_value: 0,
          xero_invoice_id: null,
          ghl_updated_at: '2026-07-24T02:05:19.927Z',
          last_synced_at: '2026-07-28T10:08:33.615Z',
          updated_at: '2026-07-28T10:08:33.953Z',
        },
        {
          ghl_id: 'T7Gb96DbTOQbhIeI1O87',
          name: 'Utopia / Urapuntja — Local Production and Shredder Pathway',
          pipeline_name: 'Goods — Community Pathways',
          stage_name: 'Listening',
          status: 'open',
          monetary_value: 0,
          xero_invoice_id: null,
          ghl_updated_at: '2026-07-24T02:05:41.204Z',
          last_synced_at: '2026-07-28T10:08:32.443Z',
          updated_at: '2026-07-28T10:08:32.640Z',
        },
        {
          ghl_id: 'rL9QFdJqVs0OfqBQW5Vn',
          name: 'Tennant Creek / Wumpurrarni — Community Production Pathway',
          pipeline_name: 'Goods — Community Pathways',
          stage_name: 'Listening',
          status: 'open',
          monetary_value: 0,
          xero_invoice_id: null,
          ghl_updated_at: '2026-07-24T02:05:35.852Z',
          last_synced_at: '2026-07-28T10:08:32.543Z',
          updated_at: '2026-07-28T10:08:32.765Z',
        },
        {
          ghl_id: 'rrV0rZBqRkr3l5ifm5Rt',
          name: 'Palm Island / Bwgcolman — Council-led Community Pathway',
          pipeline_name: 'Goods — Community Pathways',
          stage_name: 'Invitation',
          status: 'open',
          monetary_value: 0,
          xero_invoice_id: null,
          ghl_updated_at: '2026-07-24T02:05:32.217Z',
          last_synced_at: '2026-07-28T10:08:32.698Z',
          updated_at: '2026-07-28T10:08:32.896Z',
        },
        {
          ghl_id: 'KoXLnuCmAxIp8Nrpeb0W',
          name: 'PICC — Goods Stretch Bed v2.3',
          pipeline_name: 'Goods — Buyer Pipeline',
          stage_name: 'Invoiced',
          status: 'open',
          monetary_value: 36_300,
          xero_invoice_id: '44f9de6e-50f7-4663-955b-75b81566cd3b',
          ghl_updated_at: '2026-04-23T20:17:11.880Z',
          last_synced_at: '2026-05-27T02:45:07.730Z',
          updated_at: '2026-07-12T04:57:31.393Z',
        },
      ],
      error: null,
    },
    xeroInvoices: {
      rows: [
        invoice('INV-0260', 'PAID', 13_500, 13_500, '2025-08-11'),
        invoice('INV-0291', 'PAID', 85_712, 85_712, '2025-11-26'),
        invoice('INV-0308', 'PAID', 6_765, 6_765, '2026-01-20'),
        invoice('INV-0311', 'VOIDED', 68_200, 0, '2026-02-13'),
        invoice('INV-0317', 'VOIDED', 19_800, 0, '2026-02-16'),
        invoice('INV-0327', 'PAID', 1_200, 1_200, '2026-05-03'),
        invoice('INV-0331', 'VOIDED', 106_150, 0, '2026-05-17'),
      ],
      error: null,
    },
    contactEntityLinks: {
      rows: [...oonchiumpaLinks, ...utopiaLinks, ...palmLinks],
      error: null,
    },
    ghlContacts: { rows: contacts, error: null },
    relationshipHealth: {
      rows: [
        {
          ghl_contact_id: 'ghl-oon-contact-1',
          total_touchpoints: 40,
          last_contact_at: '2026-06-05T00:00:00.000Z',
          calculated_at: '2026-07-28T10:00:00.000Z',
          updated_at: '2026-07-28T10:00:00.000Z',
        },
        {
          ghl_contact_id: 'ghl-oon-contact-2',
          total_touchpoints: 38,
          last_contact_at: '2026-05-20T00:00:00.000Z',
          calculated_at: '2026-07-28T10:00:00.000Z',
          updated_at: '2026-07-28T10:00:00.000Z',
        },
        {
          ghl_contact_id: 'ghl-utopia-contact-1',
          total_touchpoints: 1,
          last_contact_at: '2025-09-29T00:00:00.000Z',
          calculated_at: '2026-07-28T10:00:00.000Z',
          updated_at: '2026-07-28T10:00:00.000Z',
        },
        {
          ghl_contact_id: 'ghl-utopia-contact-2',
          total_touchpoints: 0,
          last_contact_at: null,
          calculated_at: '2026-07-28T10:00:00.000Z',
          updated_at: '2026-07-28T10:00:00.000Z',
        },
        ...palmLinks.map((link, index) => ({
          ghl_contact_id: `ghl-${link.contact_id}`,
          total_touchpoints: palmTouchpoints[index],
          last_contact_at: index === 0
            ? '2026-06-08T00:00:00.000Z'
            : '2026-05-01T00:00:00.000Z',
          calculated_at: '2026-07-28T10:00:00.000Z',
          updated_at: '2026-07-28T10:00:00.000Z',
        })),
      ],
      error: null,
    },
    ...overrides,
  };
}

describe('Goods living decision evidence adapter', () => {
  const now = new Date('2026-07-28T12:00:00.000Z');

  it('uses the explicit four-place crosswalk and refuses fuzzy place or relationship matches', () => {
    const snapshot = buildGoodsLivingDataSnapshot(bundle(), now);

    expect(Object.keys(snapshot.places)).toEqual([
      'oonchiumpa',
      'utopia',
      'tennant-creek',
      'palm-island',
    ]);
    expect(snapshot.places['tennant-creek'].matchedCommunity).toMatchObject({
      id: TENNANT_COMMUNITY_ID,
      matchedBy: 'explicit-id',
    });
    expect(snapshot.places.oonchiumpa.matchedCommunity).toBeNull();
    expect(snapshot.places.oonchiumpa.demand.recordedBeds).toBeNull();
    expect(
      snapshot.places.oonchiumpa.relationships.signals.some(
        (signal) => signal.id === 'relationship:fuzzy-oonchiumpa-name',
      ),
    ).toBe(false);
    expect(GOODS_PLACE_CROSSWALK.utopia.communityId).toBeNull();
    expect(GOODS_PLACE_CROSSWALK['palm-island'].goodsRelationshipIds).toEqual([
      '0dfec60d-eabc-4328-aeae-498ca6c7e03b',
    ]);
  });

  it('keeps authority, current authorised request and internal coordination separate', () => {
    const place = buildGoodsLivingDataSnapshot(bundle(), now).places.oonchiumpa;

    expect(place.decisionRead.authority).toMatchObject({
      status: 'unconfirmed',
      artifactConnected: false,
    });
    expect(place.decisionRead.currentAuthorisedRequest).toMatchObject({
      status: 'absent',
      product: null,
      units: null,
      value: null,
    });
    expect(place.decisionRead.coordination).toMatchObject({
      status: 'connected',
      stage: 'Modules selected',
      evidenceTruth: 'internal-coordination-only',
      sourceId: '1JmWFa6nNFc4RAv6mggx',
    });
    expect(place.decisionRead.coordination.note).toContain('not community authority');
    expect(place.orders.signedOrderEvidence.connected).toBe(false);
    expect(place.decisionRead.qualityState).toBe('partial');
  });

  it('separates paid product trade, paid non-product work and voided invoices', () => {
    const snapshot = buildGoodsLivingDataSnapshot(bundle(), now);
    const utopia = snapshot.places.utopia.decisionRead.historicalTrade;
    const tennant = snapshot.places['tennant-creek'].decisionRead.historicalTrade;
    const palm = snapshot.places['palm-island'].decisionRead.historicalTrade;

    expect(utopia.paidProduct).toMatchObject([
      { invoiceNumber: 'INV-0291', product: 'beds', units: 107, status: 'PAID' },
    ]);
    expect(tennant.paidProduct.map((item) => item.invoiceNumber)).toEqual([
      'INV-0260',
      'INV-0308',
    ]);
    expect(tennant.voided.map((item) => item.invoiceNumber)).toEqual([
      'INV-0311',
      'INV-0331',
    ]);
    expect(tennant.voided.find((item) => item.invoiceNumber === 'INV-0331')).toMatchObject({
      product: 'mixed',
      units: 130,
    });
    expect(palm.voided).toMatchObject([
      { invoiceNumber: 'INV-0317', units: 20, paidAmount: 0 },
    ]);
    expect(palm.paidNonProduct).toMatchObject([
      { invoiceNumber: 'INV-0327', product: 'non-product', units: 0 },
    ]);
    expect(palm.paidProduct).toHaveLength(0);
  });

  it('quarantines the Palm geography overlay and CRM/Xero contradiction', () => {
    const palm = buildGoodsLivingDataSnapshot(bundle(), now).places['palm-island'];

    expect(
      palm.relationships.signals.filter(
        (signal) => signal.source === 'goods_procurement_entities',
      ),
    ).toHaveLength(0);
    expect(palm.orders.signals).toHaveLength(0);
    expect(palm.decisionRead.qualityState).toBe('review-required');
    expect(palm.decisionRead.conflicts.map((conflict) => conflict.id)).toEqual(
      expect.arrayContaining([
        'palm-island:mapped-organisations',
        'palm-island:algorithmic-signals',
        'palm-island:crm-xero-contradiction',
      ]),
    );
    expect(
      palm.decisionRead.conflicts.find(
        (conflict) => conflict.id === 'palm-island:crm-xero-contradiction',
      ),
    ).toMatchObject({
      quarantined: true,
      source: 'ghl_opportunities',
    });
  });

  it('quarantines all-overdue asset mirrors, generated replacement signals and Utopia unlinked rows', () => {
    const snapshot = buildGoodsLivingDataSnapshot(bundle(), now);
    const tennant = snapshot.places['tennant-creek'];
    const utopia = snapshot.places.utopia;

    expect(tennant.assets.lifecycleRecordCount).toBe(146);
    expect(tennant.assets.trustedLifecycleRecordCount).toBe(0);
    expect(tennant.assets.quarantinedRecordCount).toBe(146);
    expect(tennant.orders.signals).toHaveLength(0);
    expect(tennant.decisionRead.conflicts.map((conflict) => conflict.id)).toEqual(
      expect.arrayContaining([
        'tennant-creek:all-assets-overdue',
        'tennant-creek:pre-2010-deployment-dates',
        'tennant-creek:replacement-signals',
      ]),
    );
    expect(
      tennant.decisionRead.conflicts.find(
        (conflict) => conflict.id === 'tennant-creek:pre-2010-deployment-dates',
      )?.label,
    ).toBe('135 lifecycle rows have pre-2010 deployment dates');

    expect(utopia.assets.lifecycleRecordCount).toBe(68);
    expect(utopia.assets.trustedLifecycleRecordCount).toBe(0);
    expect(utopia.decisionRead.conflicts.map((conflict) => conflict.id)).toEqual(
      expect.arrayContaining([
        'utopia:all-assets-overdue',
        'utopia:unlinked-assets',
        'utopia:count-definition-conflict',
      ]),
    );
    expect(
      utopia.decisionRead.conflicts.find(
        (conflict) => conflict.id === 'utopia:count-definition-conflict',
      ),
    ).toMatchObject({
      label: '147 canonical Stretch Beds vs 107 paid Weave Beds vs 68 unlinked mirror rows',
      source: 'goods_asset_lifecycle',
      quarantined: true,
    });
    expect(
      utopia.decisionRead.conflicts.find(
        (conflict) => conflict.id === 'utopia:count-definition-conflict',
      )?.note,
    ).toContain('PAID INV-0291 evidences 107 Weave Beds');
    expect(utopia.evidence.liveSignals.some((signal) => signal.label === 'Asset records')).toBe(false);
    expect(
      snapshot.places['palm-island'].decisionRead.conflicts.map(
        (conflict) => conflict.id,
      ),
    ).toContain('palm-island:pre-2010-deployment-dates');
  });

  it('labels goods_communities quantities as population-modelled signals, not recorded need', () => {
    const palm = buildGoodsLivingDataSnapshot(bundle(), now).places['palm-island'];

    expect(palm.demand.recordedBeds).toBe(52);
    expect(palm.demand.recordedWashers).toBe(6);
    expect(palm.demand.note).toContain('population-modelled signals');
    expect(palm.demand.note).toContain('not recorded need');
    expect(palm.demand.note).toContain('or an order');
  });

  it('summarises exact entity-linked contact episodes without treating them as authority or relationship quality', () => {
    const snapshot = buildGoodsLivingDataSnapshot(bundle(), now);
    const oonchiumpa = snapshot.places.oonchiumpa.decisionRead.relationshipEvidence;
    const utopia = snapshot.places.utopia.decisionRead.relationshipEvidence;
    const tennant = snapshot.places['tennant-creek'].decisionRead.relationshipEvidence;
    const palm = snapshot.places['palm-island'].decisionRead.relationshipEvidence;

    expect(oonchiumpa).toMatchObject({
      status: 'connected',
      linkedContactCount: 2,
      totalTouchpoints: 78,
      latestContactAt: '2026-06-05T00:00:00.000Z',
    });
    expect(utopia).toMatchObject({
      linkedContactCount: 2,
      totalTouchpoints: 1,
      latestContactAt: '2025-09-29T00:00:00.000Z',
    });
    expect(tennant).toMatchObject({
      status: 'empty',
      linkedContactCount: 0,
      totalTouchpoints: 0,
    });
    expect(palm).toMatchObject({
      linkedContactCount: 9,
      totalTouchpoints: 34,
      latestContactAt: '2026-06-08T00:00:00.000Z',
    });
    expect(palm.note).toContain('not prove authority, consent or relationship quality');
    expect(palm.people[0]).not.toHaveProperty('email');
    expect(palm.people[0]).not.toHaveProperty('phone');
  });

  it('uses the canonical open decision without fabricating owner, due date or human review', () => {
    const palm = buildGoodsLivingDataSnapshot(bundle(), now).places['palm-island'];

    expect(palm.decisionRead.openAction).toMatchObject({
      action: 'Confirm the right people, decision process and first listening conversation.',
      owner: null,
      dueAt: null,
      source: 'canonical_model',
    });
    expect(palm.decisionRead.humanReview).toEqual({
      connected: false,
      status: 'not-connected',
      label: 'Human review memory not connected',
      reviewedAt: null,
      reviewDueAt: null,
      note: 'No review-memory table or artifact is available. Automated evidence must not be presented as human-approved.',
      source: null,
    });
  });

  it('reports freshness separately from evidence truth', () => {
    const staleBundle = bundle();
    staleBundle.ghlOpportunities.rows = staleBundle.ghlOpportunities.rows.map(
      (row) => ({
        ...row,
        ghl_updated_at: '2025-01-01T00:00:00.000Z',
        last_synced_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
      }),
    );
    const place = buildGoodsLivingDataSnapshot(staleBundle, now).places.oonchiumpa;
    const trace = place.provenance.find(
      (source) => source.key === 'ghl_opportunities',
    );

    expect(trace).toMatchObject({
      availability: 'available',
      freshness: 'stale',
    });
    expect(place.decisionRead.coordination).toMatchObject({
      status: 'connected',
      evidenceTruth: 'internal-coordination-only',
    });
    expect(place.decisionRead.currentAuthorisedRequest.status).toBe('absent');
  });

  it('falls back honestly when decision sources fail and never represents unpriced work as zero', () => {
    const error = (message: string) => ({ rows: [], error: message });
    const snapshot = buildGoodsLivingDataSnapshot(
      bundle({
        communities: error('community source unavailable'),
        assets: error('asset source unavailable'),
        deployments: error('deployment source unavailable'),
        procurementSignals: error('signal source unavailable'),
        procurementEntities: error('entity source unavailable'),
        relationships: error('relationship source unavailable'),
        ghlOpportunities: error('CRM source unavailable'),
        xeroInvoices: error('invoice source unavailable'),
        contactEntityLinks: error('contact link source unavailable'),
        ghlContacts: error('contact source unavailable'),
        relationshipHealth: error('episode source unavailable'),
      }),
      now,
    );
    const palm = snapshot.places['palm-island'];

    expect(palm.mode).toBe('canonical-fallback');
    expect(palm.demand.recordedBeds).toBeNull();
    expect(palm.assets.lifecycleRecordCount).toBeNull();
    expect(palm.canonical.operating.value).toBe('Governance work is unpriced');
    expect(palm.decisionRead.qualityState).toBe('source-unavailable');
    expect(palm.decisionRead.coordination.status).toBe('unavailable');
    expect(palm.decisionRead.currentAuthorisedRequest.status).toBe('absent');
    expect(
      palm.provenance.find((source) => source.key === 'goods_communities'),
    ).toMatchObject({
      availability: 'unavailable',
      error: 'community source unavailable',
    });
  });
});

describe('Goods canonical impact summary', () => {
  it('parses the public impact API shape', () => {
    const parsed = parseGoodsCanonicalImpactSummary({
      source: 'canonical asset register',
      generatedAt: '2026-07-28T12:00:00.000Z',
      beds: { deployed: 541, stretch: 178, basket: 363 },
      washers: { inCommunity: 22 },
      communitiesServed: 11,
      plasticDivertedKg: 3_560,
      livesImpactedModelled: 1_353,
      notes: {
        plastic: 'Stretch only.',
        washers: 'Manual ruling.',
        basis: 'Deployed quantities.',
      },
    });

    expect(parsed).toMatchObject({
      sourceUrl: GOODS_CANONICAL_IMPACT_URL,
      mode: 'live',
      beds: { deployed: 541, stretch: 178, basket: 363 },
      error: null,
    });
  });

  it('uses the dated static canonical totals when the API is unavailable', async () => {
    const impact = await getGoodsCanonicalImpactSummary(async () => {
      throw new Error('offline');
    });

    expect(impact).toEqual(goodsCanonicalImpactFallback('offline'));
    expect(impact.mode).toBe('static-fallback');
    expect(impact.beds).toEqual(GOODS_CANONICAL_IMPACT_FALLBACK.beds);
    expect(impact.washers.inCommunity).toBe(22);
    expect(impact.error).toBe('offline');
  });

  it('rejects incomplete API data instead of silently inventing missing totals', async () => {
    const impact = await getGoodsCanonicalImpactSummary(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        beds: { deployed: 540 },
        washers: { inCommunity: 22 },
      }),
    }));

    expect(impact.mode).toBe('static-fallback');
    expect(impact.error).toContain('invalid response shape');
    expect(impact.beds.deployed).toBe(540);
  });
});
