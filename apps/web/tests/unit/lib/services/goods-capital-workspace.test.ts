import { describe, expect, it } from 'vitest';
import {
  GOODS_CAPITAL_BLOCK_SEED,
  GOODS_FUNDING_MATTER_SEED,
  GOODS_FUNDING_ROUTE_SEED,
  applicationGates,
  buildGoodsCapitalWorkspace,
  selectGoodsAttention,
  type GoodsRouteAllocation,
} from '@/lib/services/goods-capital-workspace';

describe('GOODS capital workspace', () => {
  it('keeps the $925K target stack separate from the $367K-$620K need and commitments', () => {
    const workspace = buildGoodsCapitalWorkspace({
      blocks: GOODS_CAPITAL_BLOCK_SEED,
      matters: GOODS_FUNDING_MATTER_SEED,
      routes: GOODS_FUNDING_ROUTE_SEED,
      allocations: [],
      now: new Date('2026-08-01T00:00:00.000Z'),
      dataSource: 'evidence_safe_seed',
    });

    expect(workspace.summary).toMatchObject({
      needMinAud: 367_000,
      needMaxAud: 620_000,
      targetAud: 925_000,
      askMadeAud: 0,
      committedAud: 0,
      receivedAud: 0,
      allocatedTargetAud: 0,
      unallocatedTargetAud: 925_000,
      signedCommitmentCount: 0,
    });
  });

  it('does not count a target against a capital block without an explicit allocation', () => {
    const workspace = buildGoodsCapitalWorkspace({
      blocks: GOODS_CAPITAL_BLOCK_SEED,
      matters: GOODS_FUNDING_MATTER_SEED,
      routes: GOODS_FUNDING_ROUTE_SEED,
      allocations: [],
      now: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(workspace.coverage.every((block) => block.targetedAud === 0)).toBe(true);
    expect(workspace.coverage.every((block) => block.committedAud === 0)).toBe(true);
    expect(workspace.coverage.find((block) => block.code === 'operating-cover')).toMatchObject({
      remainingMinAud: 110_000,
      remainingMaxAud: 165_000,
    });
  });

  it('requires written evidence and an explicit allocation before capital is counted as committed', () => {
    const snow = GOODS_FUNDING_ROUTE_SEED.find((route) => route.routeCode === 'snow-150k-route');
    const operating = GOODS_CAPITAL_BLOCK_SEED.find((block) => block.code === 'operating-cover');
    expect(snow).toBeTruthy();
    expect(operating).toBeTruthy();

    const route = {
      ...snow!,
      commitmentState: 'accepted' as const,
      commitmentAmountAud: 150_000,
      commitmentEvidenceForm: 'letter' as const,
      commitmentEvidenceRef: 'signed-letter-2026-08-10',
    };
    const allocation: GoodsRouteAllocation = {
      id: 'allocation-snow-operating',
      routeId: route.id,
      capitalBlockId: operating!.id,
      proposedAmountAud: 150_000,
      acceptedAmountAud: 150_000,
      restrictions: null,
      allocationEvidenceRef: 'signed-letter-2026-08-10',
    };
    const workspace = buildGoodsCapitalWorkspace({
      blocks: GOODS_CAPITAL_BLOCK_SEED,
      matters: GOODS_FUNDING_MATTER_SEED,
      routes: GOODS_FUNDING_ROUTE_SEED.map((candidate) => candidate.id === route.id ? route : candidate),
      allocations: [allocation],
      now: new Date('2026-08-10T00:00:00.000Z'),
    });

    expect(workspace.summary.committedAud).toBe(150_000);
    expect(workspace.coverage.find((block) => block.code === 'operating-cover')).toMatchObject({
      targetedAud: 150_000,
      committedAud: 150_000,
      remainingMinAud: 0,
      remainingMaxAud: 15_000,
    });
  });

  it('keeps the leader queue bounded to five matters and puts the QBE truth reset first', () => {
    const attention = selectGoodsAttention(
      GOODS_FUNDING_MATTER_SEED,
      GOODS_FUNDING_ROUTE_SEED,
      [],
      [],
      new Date('2026-08-01T00:00:00.000Z'),
    );

    expect(attention).toHaveLength(5);
    expect(attention[0]).toMatchObject({
      trigger: 'truth_reset',
      matter: { slug: 'qbe-stage-2-truth-reset' },
    });
  });

  it('shows that a current public page alone is not application readiness', () => {
    const tfff = GOODS_FUNDING_MATTER_SEED.find((matter) => matter.slug === 'tim-fairfax-150k');
    const route = GOODS_FUNDING_ROUTE_SEED.find((candidate) => candidate.routeCode === 'tim-fairfax-150k-route');
    expect(tfff).toBeTruthy();
    expect(route).toBeTruthy();

    const gates = applicationGates(tfff!, route!, []);

    expect(gates.find((item) => item.key === 'current')?.state).toBe('pass');
    expect(gates.find((item) => item.key === 'route')?.state).toBe('pass');
    expect(gates.find((item) => item.key === 'use')?.state).toBe('blocked');
    expect(gates.find((item) => item.key === 'entity')?.state).toBe('check');
    expect(gates.find((item) => item.key === 'timing')?.state).toBe('blocked');
  });
});
