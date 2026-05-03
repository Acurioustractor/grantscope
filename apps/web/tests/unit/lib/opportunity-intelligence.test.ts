import { describe, expect, it } from 'vitest';
import {
  buildOpportunityActionReceipt,
  buildOpportunityRoutes,
  dedupeOpportunitySignals,
  filterOpportunitySignals,
  scoreOpportunitySignal,
  type OpportunityIntelligenceResponse,
  type OpportunitySignal,
} from '@/lib/opportunity-intelligence';
import { buildOpportunitySystemSweep } from '@/lib/opportunity-system-sweep';
import { buildGoodsReadinessSnapshotFromRows } from '@/lib/goods-readiness-snapshot';

function signal(overrides: Partial<OpportunitySignal>): OpportunitySignal {
  return {
    id: 'signal:1',
    title: 'Goods buyer opportunity',
    summary: 'Remote housing procurement route for beds and washers.',
    source: 'procurement',
    sourceLabel: 'Procurement and buyer signals',
    sourceRef: 'source-1',
    sourceUrl: 'https://example.org/goods',
    lane: 'buyer',
    status: 'researching',
    project: 'goods',
    projects: ['goods'],
    organisation: 'Example Buyer',
    amount: '$50,000',
    deadline: '2026-05-20',
    score: 88,
    scoreReasons: ['buyer or procurement lane'],
    whyNow: 'Buyer route needs a next touch.',
    readiness: {
      level: 'medium',
      notes: ['ABN and website available'],
    },
    evidence: [],
    relationships: [],
    nextAction: {
      kind: 'contact',
      label: 'Queue contact',
      description: 'Human next touch only.',
    },
    browseLinks: [],
    lastSyncedAt: '2026-05-01T00:00:00.000Z',
    sourceConfidence: 'high',
    freshness: 'fresh',
    matchedKeys: ['source-1', 'example-org-goods'],
    ...overrides,
  };
}

describe('opportunity intelligence scoring', () => {
  it('prioritises urgent, evidenced Goods buyer signals over weak stale signals', () => {
    const now = new Date('2026-05-01T00:00:00.000Z');
    const strong = scoreOpportunitySignal(
      {
        title: 'Goods procurement buyer',
        source: 'procurement',
        lane: 'buyer',
        projects: ['goods'],
        deadline: '2026-05-20',
        evidenceCount: 3,
        relationshipWarmth: 'warm',
        readiness: 'high',
        sourceConfidence: 'high',
        freshness: 'fresh',
      },
      now,
    );
    const weak = scoreOpportunitySignal(
      {
        title: 'Generic stale contact',
        source: 'crm',
        lane: 'relationship',
        projects: ['civicgraph'],
        evidenceCount: 0,
        relationshipWarmth: 'unknown',
        readiness: 'low',
        sourceConfidence: 'low',
        freshness: 'stale',
      },
      now,
    );

    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.reasons).toContain('buyer or procurement lane');
  });
});

describe('opportunity intelligence filtering and dedupe', () => {
  it('filters by project, lane, query, deadline, and minimum score', () => {
    const rows = [
      signal({ id: 'signal:goods', title: 'Goods buyer opportunity', score: 90 }),
      signal({
        id: 'signal:justice',
        title: 'Youth justice grant',
        lane: 'grant',
        project: 'justicehub',
        projects: ['justicehub'],
        score: 70,
      }),
    ];

    const filtered = filterOpportunitySignals(rows, {
      project: 'goods',
      lane: 'buyer',
      q: 'washers',
      deadline: '30d',
      minScore: 80,
    }, new Date('2026-05-01T00:00:00.000Z'));

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('signal:goods');
  });

  it('dedupes by matched source keys and keeps the higher scoring signal', () => {
    const lower = signal({ id: 'low', score: 60, matchedKeys: ['same-source'] });
    const higher = signal({ id: 'high', score: 91, matchedKeys: ['same-source'] });

    expect(dedupeOpportunitySignals([lower, higher])).toEqual([higher]);
  });
});

describe('opportunity intelligence action receipts', () => {
  it('does not write to external systems when preparing a GHL action', () => {
    const receipt = buildOpportunityActionReceipt(
      {
        kind: 'send_to_ghl',
        signalId: 'signal:goods',
        signal: signal({ id: 'signal:goods' }),
        note: 'Prepare a human next touch.',
        owner: 'Ben',
      },
      new Date('2026-05-01T00:00:00.000Z'),
    );

    expect(receipt.status).toBe('planned');
    expect(receipt.writeMode).toBe('planned');
    expect(receipt.externalWrites).toEqual([]);
    expect(receipt.warnings.join(' ')).toContain('needs confirmation');
  });
});

describe('opportunity route directives', () => {
  it('turns a Goods buyer signal into a Goods HighLevel route', () => {
    const [route] = buildOpportunityRoutes([signal({ lane: 'buyer', projects: ['goods'], score: 90 })]);

    expect(route.project_code).toBe('ACT-GD');
    expect(route.pathway).toBe('buyer');
    expect(route.recommended_role).toBe('contractor');
    expect(route.ghl.recommendedPipeline).toBe('Goods — Buyer Pipeline');
    expect(route.ghl.tags).toContain('cg-project:act-gd');
  });

  it('uses previous no decisions to lower the same future route', () => {
    const base = signal({ id: 'same-route', source: 'foundation', sourceRef: 'source-1', lane: 'foundation', projects: ['justicehub'], score: 85 });
    const cleanRoute = buildOpportunityRoutes([base])[0];
    const learnedRoute = buildOpportunityRoutes([base], [
      {
        id: 'decision-1',
        source_type: 'foundation',
        source_ref: 'source-1',
        project_code: 'ACT-JH',
        pathway: 'foundation',
        decision: 'no',
        reason: 'No lead applicant',
        notes: null,
        evidence_gaps: [],
        outcome: null,
        created_at: '2026-05-01T00:00:00.000Z',
      },
    ])[0];

    expect(learnedRoute.overall_score).toBeLessThan(cleanRoute.overall_score);
    expect(learnedRoute.why_recommended).toContain('Past no/loss');
  });
});

describe('opportunity system sweep', () => {
  it('turns cockpit signals into project coverage, offline gaps, and Goods roadmap', () => {
    const intelligence: OpportunityIntelligenceResponse = {
      generatedAt: '2026-05-01T00:00:00.000Z',
      filters: {},
      signals: [
        signal({ id: 'goods:grant', source: 'goods', lane: 'grant', score: 100 }),
        signal({ id: 'goods:capital', source: 'goods', lane: 'capital', score: 98 }),
        signal({ id: 'goods:procurement', source: 'procurement', lane: 'procurement', score: 90 }),
      ],
      routes: [],
      topDirective: null,
      projectQueues: [],
      learningSummary: {
        decisionCount: 0,
        negativeCount: 0,
        positiveCount: 0,
        moreInfoCount: 0,
        commonNoReasons: [],
        notes: [],
      },
      actions: [],
      sourceHealth: [],
      projectState: [],
      relationshipContext: {
        summary: 'No contacts',
        warmCount: 0,
        staleCount: 0,
        priorityContacts: [],
        commonTags: [],
      },
      safety: {
        mode: 'mirror-plus-actions',
        externalWrites: 'disabled-by-default',
        notes: ['No auto-send'],
      },
    };

    const sweep = buildOpportunitySystemSweep(intelligence);
    const goods = sweep.projectSweep.find((project) => project.code === 'ACT-GD');

    expect(goods?.signalCount).toBe(3);
    expect(sweep.offlineGaps.map((gap) => gap.id)).toContain('ghl-opportunity-pipeline-mirror');
    expect(sweep.goodsFocus.roadmap[0].id).toBe('goods-evidence-freeze');
    expect(sweep.goodsFocus.laneSweep.map((lane) => lane.lane)).toContain('procurement');
  });
});

describe('Goods readiness snapshot', () => {
  it('summarises demand, assets, procurement, products, GHL mirror state, and checklist gaps', () => {
    const snapshot = buildGoodsReadinessSnapshotFromRows(
      {
        communities: {
          rows: [
            {
              id: 'community-1',
              community_name: 'MANINGRIDA',
              state: 'NT',
              postcode: '0822',
              priority: 'lead',
              demand_beds: 10,
              demand_washers: 2,
              demand_fridges: 1,
              demand_mattresses: 10,
              assets_deployed: 1,
              assets_active: 1,
              assets_overdue: 0,
              known_buyer_name: 'Buyer Org',
              buyer_entity_count: 1,
              total_govt_contract_value: 1000,
              total_justice_funding: 0,
              nearest_staging_hub: 'Darwin',
              freight_corridor: 'Top End',
              data_quality_score: 90,
              last_profiled_at: '2026-04-25T00:00:00.000Z',
              updated_at: '2026-04-25T00:00:00.000Z',
            },
          ],
          error: null,
        },
        assets: {
          rows: [
            {
              id: 'asset-1',
              goods_asset_id: 'G-1',
              product_slug: 'stretch-bed',
              product_type: 'Stretch Bed',
              community_name: 'MANINGRIDA',
              current_status: 'active',
              deployed_at: '2026-04-20T00:00:00.000Z',
              last_checkin_at: '2026-04-25T00:00:00.000Z',
              is_overdue: false,
              needs_replacement: false,
              last_synced_at: '2026-04-30T00:00:00.000Z',
              updated_at: '2026-04-30T00:00:00.000Z',
            },
          ],
          error: null,
        },
        signals: {
          rows: [
            {
              id: 'signal-1',
              signal_type: 'demand_unmet',
              priority: 'medium',
              title: 'Unmet demand',
              description: 'Needs beds and washers',
              estimated_value: 5000,
              estimated_units: 12,
              products_needed: ['bed', 'washer'],
              matched_grant_ids: ['grant-1'],
              matched_foundation_ids: [],
              funding_confidence: 'possible',
              status: 'new',
              ghl_contact_id: 'ghl-contact-1',
              ghl_synced_at: '2026-04-30T00:00:00.000Z',
              created_at: '2026-04-29T00:00:00.000Z',
              updated_at: '2026-04-30T00:00:00.000Z',
              community_id: 'community-1',
              buyer_entity_id: 'buyer-1',
            },
          ],
          error: null,
        },
        buyers: {
          rows: [
            {
              id: 'buyer-1',
              entity_name: 'Buyer Org',
              buyer_role: 'store',
              relationship_status: 'prospect',
              estimated_annual_spend: 10000,
              govt_contract_value: 1000,
              fit_score: 95,
              next_action: 'Open intro pathway.',
              last_contact_date: null,
              product_fit: ['bed'],
              community_id: 'community-1',
              updated_at: '2026-04-30T00:00:00.000Z',
            },
          ],
          error: null,
        },
        products: {
          rows: [
            {
              id: 'product-1',
              slug: 'stretch-bed',
              name: 'Stretch Bed',
              status: 'active',
              material_cost_aud: 85,
              manufacturing_cost_aud: 165,
              wholesale_price_aud: 749,
              typical_delivered_cost_remote: 2000,
              goods_delivered_cost_remote: 850,
              expected_lifespan_months: 120,
              warranty_months: 60,
              updated_at: '2026-04-30T00:00:00.000Z',
            },
          ],
          error: null,
        },
        ghlOpportunities: {
          rows: [
            {
              id: 'opp-1',
              ghl_id: 'ghl-opp-1',
              ghl_pipeline_id: 'pipe-1',
              ghl_stage_id: 'stage-1',
              name: 'Goods buyer opportunity',
              pipeline_name: 'Goods - Buyer Pipeline',
              stage_name: 'Outreach Queued',
              status: 'open',
              monetary_value: 5000,
              project_code: 'ACT-GD',
              ghl_updated_at: '2026-04-30T00:00:00.000Z',
              last_synced_at: '2026-04-30T00:00:00.000Z',
            },
          ],
          error: null,
        },
        ghlPipelines: {
          rows: [
            {
              id: 'pipe-row-1',
              ghl_id: 'pipe-1',
              name: 'Goods - Buyer Pipeline',
              stages: [],
              last_synced_at: '2026-04-30T00:00:00.000Z',
            },
          ],
          error: null,
        },
        governance: {
          rows: [],
          error: 'relation "goods_governance_readiness" does not exist',
        },
      } as any,
      new Date('2026-05-01T00:00:00.000Z'),
    );

    expect(snapshot.demand.communityCount).toBe(1);
    expect(snapshot.demand.totalDemand.beds).toBe(10);
    expect(snapshot.assets.assetCount).toBe(1);
    expect(snapshot.procurement.syncedToGhlCount).toBe(1);
    expect(snapshot.ghlMirror.goodsOpportunityCount).toBe(1);
    expect(snapshot.governance.sourceMode).toBe('wiki-fallback');
    expect(snapshot.governance.criticalGapCount).toBeGreaterThan(0);
    expect(snapshot.checklist.find((item) => item.id === 'governance-vehicle')?.status).toBe('gap');
  });
});
