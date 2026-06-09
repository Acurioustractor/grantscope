/**
 * Lockstep guard for the warmth formula, which exists twice:
 *   JS  — computeWarmth() in goods-engagement-shared.ts
 *   SQL — goods_compute_warmth() in supabase/migrations/20260609060000_goods_relationships_engagement.sql
 *
 * 1. The pure grid pins the JS formula to known outputs (catches accidental JS edits).
 * 2. The live test calls the SQL function via RPC and compares (catches one-sided edits).
 *    It runs only when Supabase creds are in the environment:
 *      set -a; source ../../.env; set +a; npx vitest run src/lib/services/goods-warmth-lockstep.test.ts
 *    Tolerance is ±1 point: SQL uses now() on the DB clock, JS injects its own.
 */
import { describe, it, expect } from 'vitest';
import { computeWarmth, type GoodsStage } from './goods-engagement-shared';

const NOW = Date.parse('2026-06-10T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

interface Case {
  stage: GoodsStage;
  lastTouch: string | null;
  totalReceived: number;
  alignment: number | null;
  hasPrior: boolean;
  advocacy: number;
}

const GRID: Case[] = [
  { stage: 'identified', lastTouch: null, totalReceived: 0, alignment: null, hasPrior: false, advocacy: 0 },
  { stage: 'researching', lastTouch: daysAgo(10), totalReceived: 0, alignment: 40, hasPrior: false, advocacy: 0 },
  { stage: 'contacted', lastTouch: daysAgo(30), totalReceived: 0, alignment: 60, hasPrior: false, advocacy: 20 },
  { stage: 'in_conversation', lastTouch: daysAgo(5), totalReceived: 25_000, alignment: 80, hasPrior: true, advocacy: 50 },
  { stage: 'proposal', lastTouch: daysAgo(45), totalReceived: 100_000, alignment: 90, hasPrior: true, advocacy: 0 },
  { stage: 'committed', lastTouch: daysAgo(0), totalReceived: 500_000, alignment: 100, hasPrior: true, advocacy: 100 },
  { stage: 'repeat', lastTouch: daysAgo(90), totalReceived: 1_000_000, alignment: 75, hasPrior: true, advocacy: 80 },
  { stage: 'dormant', lastTouch: daysAgo(400), totalReceived: 50_000, alignment: 50, hasPrior: true, advocacy: 0 },
  { stage: 'declined', lastTouch: daysAgo(200), totalReceived: 0, alignment: 0, hasPrior: false, advocacy: 0 },
  // clamp edges
  { stage: 'proposal', lastTouch: daysAgo(1), totalReceived: 0, alignment: 150, hasPrior: false, advocacy: 150 },
  { stage: 'contacted', lastTouch: daysAgo(1), totalReceived: 0, alignment: -10, hasPrior: false, advocacy: -10 },
];

const js = (c: Case) =>
  computeWarmth({
    stage: c.stage,
    lastTouch: c.lastTouch,
    totalReceived: c.totalReceived,
    alignment: c.alignment,
    hasPrior: c.hasPrior,
    advocacy: c.advocacy,
    now: NOW,
  });

describe('warmth formula — JS grid pin', () => {
  it('produces stable scores for the fixture grid', () => {
    expect(GRID.map(js)).toEqual([4, 33, 38, 75, 73, 96, 80, 35, 1, 70, 36]);
  });
});

describe('warmth formula — SQL lockstep', () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  it.skipIf(!url || !key)('goods_compute_warmth() matches computeWarmth() within ±1', async () => {
    // Recompute the JS side with the real clock so both sides decay from "now".
    const realNow = Date.now();
    for (const c of GRID) {
      const res = await fetch(`${url}/rest/v1/rpc/goods_compute_warmth`, {
        method: 'POST',
        headers: { apikey: key!, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_stage: c.stage,
          p_last_touch: c.lastTouch,
          p_total_received: c.totalReceived,
          p_alignment: c.alignment,
          p_has_prior: c.hasPrior,
          p_advocacy: c.advocacy,
        }),
      });
      expect(res.ok).toBe(true);
      const sqlScore = (await res.json()) as number;
      const jsScore = computeWarmth({
        stage: c.stage,
        lastTouch: c.lastTouch,
        totalReceived: c.totalReceived,
        alignment: c.alignment,
        hasPrior: c.hasPrior,
        advocacy: c.advocacy,
        now: realNow,
      });
      expect(Math.abs(sqlScore - jsScore), `stage=${c.stage}`).toBeLessThanOrEqual(1);
    }
  });
});
