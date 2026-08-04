import { describe, it, expect } from 'vitest';
import { computeImpactGap, GOODS_DELIVERED, rollupCommercial } from '@/lib/services/goods-proof';
import type { GoodsRelationship, GoodsRelType, GoodsStage } from '@/lib/services/goods-engagement-shared';

function rel(type: GoodsRelType, stage: GoodsStage, received = 0): GoodsRelationship {
  return {
    id: `${type}-${stage}-${received}`,
    relationship_type: type,
    display_name: 'X',
    entity_id: null,
    ghl_opportunity_id: null,
    ghl_contact_id: null,
    stage,
    target_stage: null,
    warmth_computed: 0,
    warmth_override: null,
    warmth_display: 0,
    last_touch_at: null,
    total_received_aud: received,
    alignment_score: null,
    has_prior_support: received > 0,
    next_action: null,
    next_action_due: null,
    warm_intro_path: null,
    notes: null,
    ask_amount_aud: null,
    ask_purpose: null,
  };
}

describe('computeImpactGap', () => {
  it('uses the current Goods physical-footprint canon', () => {
    expect(GOODS_DELIVERED).toEqual({ beds: 540, washers: 22, asOf: '2026-07-25' });
  });

  it('computes gap and % met from delivered vs demand', () => {
    const g = computeImpactGap(GOODS_DELIVERED, { beds: 12504, washers: 1563 });
    expect(g.bedsGap).toBe(11964);
    expect(g.washersGap).toBe(1541);
    expect(g.pctBedsMet).toBe(4); // 540/12504 ≈ 4%
  });

  it('never returns a negative gap when delivered exceeds demand', () => {
    const g = computeImpactGap({ beds: 100, washers: 100 }, { beds: 50, washers: 50 });
    expect(g.bedsGap).toBe(0);
    expect(g.washersGap).toBe(0);
    expect(g.pctBedsMet).toBe(200);
  });

  it('guards divide-by-zero demand', () => {
    expect(computeImpactGap({ beds: 10, washers: 1 }, { beds: 0, washers: 0 }).pctBedsMet).toBe(0);
  });
});

describe('rollupCommercial', () => {
  it('counts funders, committed funders, buyers and advancing buyers', () => {
    const rels = [
      rel('funder', 'committed', 50000),
      rel('funder', 'proposal'),
      rel('impact_investor', 'repeat', 300000),
      rel('repayable_finance', 'identified'),
      rel('buyer', 'in_conversation'),
      rel('buyer', 'committed'),
      rel('buyer', 'identified'),
      rel('supporter', 'committed'), // not a funder-type, not a buyer
    ];
    const c = rollupCommercial(rels, 350000);
    expect(c.lifetimeReceived).toBe(350000);
    expect(c.fundersEngaged).toBe(4); // 2 funder + impact_investor + repayable_finance
    expect(c.committedFunders).toBe(2); // committed funder + repeat impact_investor
    expect(c.buyersEngaged).toBe(3);
    expect(c.buyersAdvancing).toBe(2); // in_conversation + committed (identified excluded)
  });
});
