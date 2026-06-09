import { describe, it, expect } from 'vitest';
import {
  decodeFunderInsight, rankInsights, summariseInsights,
  type FunderInsightInput,
} from '@/lib/services/goods-funder-insight-shared';

const NOW = Date.parse('2026-06-09T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function input(over: Partial<FunderInsightInput> = {}): FunderInsightInput {
  return {
    id: 'r1',
    name: 'Test Foundation',
    relationshipType: 'funder',
    stage: 'identified',
    warmthDisplay: 40,
    lastTouchAt: daysAgo(10),
    totalReceived: 0,
    hasPrior: false,
    signal: { tags: [] },
    now: NOW,
    ...over,
  };
}

describe('decodeFunderInsight — temperature', () => {
  it('reads the explicit goods-* temperature tag', () => {
    expect(decodeFunderInsight(input({ signal: { tags: ['goods-hot'] } })).temperature).toBe('hot');
    expect(decodeFunderInsight(input({ signal: { tags: ['goods-cooling'] } })).temperature).toBe('cooling');
    expect(decodeFunderInsight(input({ signal: { tags: ['role:funder'] } })).temperature).toBe('unknown');
  });

  it('surfaces the most attention-demanding temperature when several are present', () => {
    // hot beats steady; cooling beats warm
    expect(decodeFunderInsight(input({ signal: { tags: ['goods-steady', 'goods-hot'] } })).temperature).toBe('hot');
    expect(decodeFunderInsight(input({ signal: { tags: ['goods-warm', 'goods-cooling'] } })).temperature).toBe('cooling');
  });
});

describe('decodeFunderInsight — decoded dimensions', () => {
  it('maps subscribed briefs to human "cares about" labels', () => {
    const i = decodeFunderInsight(input({
      signal: { tags: ['newsletter-stream:funder-brief', 'newsletter-stream:youth-justice-brief', 'interest:housing'] },
    }));
    expect(i.interests).toContain('Funder brief');
    expect(i.interests).toContain('Youth justice');
    expect(i.interests).toContain('Housing');
  });

  it('reads engagement ring (vip), roles, comms, place, campaign stage', () => {
    const i = decodeFunderInsight(input({
      signal: { tags: ['ring:vip', 'role:funder', 'comms:funder-drip', 'place:nt', 'campaign-stage:personal-invite'] },
    }));
    expect(i.engagementTier).toBe('vip');
    expect(i.roles).toContain('Funder');
    expect(i.commsStreams).toContain('Funder Drip');
    expect(i.places).toContain('NT');
    expect(i.campaignStage).toBe('Personal Invite');
  });
});

describe('decodeFunderInsight — attention precedence', () => {
  it('flags a funded relationship going cold as act-now (top priority)', () => {
    const i = decodeFunderInsight(input({
      stage: 'repeat', hasPrior: true, totalReceived: 50000,
      signal: { tags: ['goods-cooling'] },
    }));
    expect(i.attention).toBe('act-now');
    expect(i.flags.map((f) => f.key)).toContain('at-risk');
  });

  it('flags a hot funder as act-now with strike-now guidance', () => {
    const i = decodeFunderInsight(input({ signal: { tags: ['goods-hot'] } }));
    expect(i.attention).toBe('act-now');
    expect(i.nextMove.toLowerCase()).toContain('hot');
  });

  it('treats a new inquiry as act-now', () => {
    expect(decodeFunderInsight(input({ signal: { tags: ['goods-inquiry'] } })).attention).toBe('act-now');
  });

  it('flags a funded relationship untouched >60d as overdue act-now', () => {
    const i = decodeFunderInsight(input({
      stage: 'committed', hasPrior: true, lastTouchAt: daysAgo(90), signal: { tags: [] },
    }));
    expect(i.attention).toBe('act-now');
    expect(i.flags.map((f) => f.key)).toContain('overdue');
  });

  it('non-funded cooling is watch, not act-now', () => {
    expect(decodeFunderInsight(input({ signal: { tags: ['goods-cold'] } })).attention).toBe('watch');
  });

  it('warm + recent is steady', () => {
    expect(decodeFunderInsight(input({ signal: { tags: ['goods-warm'] }, lastTouchAt: daysAgo(5) })).attention).toBe('steady');
  });

  it('treats an owed report as act-now with a report-due flag and move', () => {
    const i = decodeFunderInsight(input({
      stage: 'repeat', hasPrior: true,
      signal: { tags: ['goods-impact-report-needed', 'goods-steady'] },
    }));
    expect(i.attention).toBe('act-now');
    expect(i.flags.map((f) => f.key)).toContain('report-due');
    expect(i.flags.map((f) => f.key)).not.toContain('steward'); // report-due supersedes stewarding
    expect(i.nextMove.toLowerCase()).toContain('report due');
  });

  it('recognises named report tags (goods-report-*)', () => {
    expect(decodeFunderInsight(input({ signal: { tags: ['goods-report-board-pack'] } })).attention).toBe('act-now');
  });
});

describe('rank + summary', () => {
  it('ranks act-now ahead of steady, hottest first', () => {
    const hot = decodeFunderInsight(input({ id: 'hot', signal: { tags: ['goods-hot'] } }));
    const warm = decodeFunderInsight(input({ id: 'warm', signal: { tags: ['goods-warm'] }, lastTouchAt: daysAgo(3) }));
    const sorted = [warm, hot].sort(rankInsights);
    expect(sorted[0].id).toBe('hot');
  });

  it('summarises counts deterministically', () => {
    const items = [
      decodeFunderInsight(input({ id: 'a', signal: { tags: ['goods-hot', 'ring:vip'] } })),
      decodeFunderInsight(input({ id: 'b', stage: 'repeat', hasPrior: true, signal: { tags: ['goods-cooling'] } })),
      decodeFunderInsight(input({ id: 'c', signal: { tags: [] } })),
    ];
    const s = summariseInsights(items);
    expect(s.total).toBe(3);
    expect(s.hot).toBe(1);
    expect(s.cooling).toBe(1);
    expect(s.vip).toBe(1);
    expect(s.withSignal).toBe(2);
    expect(s.actNow).toBe(2); // hot + funded-cooling
  });
});
