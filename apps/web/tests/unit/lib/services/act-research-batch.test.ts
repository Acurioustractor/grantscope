import { describe, expect, it } from 'vitest';
import { benchmarkLane, selectWeeklyBenchmarkBatch } from '@/lib/services/act-research';

describe('weekly benchmark batch', () => {
  it('classifies benchmark projects into the phase-one lanes', () => {
    expect(benchmarkLane('ACT-GD')).toBe('commercial_public_benefit');
    expect(benchmarkLane('ACT-HV')).toBe('community_partner');
    expect(benchmarkLane('ACT-JH-CT')).toBe('arts_cultural');
    expect(benchmarkLane('ACT-JH')).toBe('portfolio');
  });

  it('caps the queue and balances the three benchmark lanes', () => {
    const cases = [
      ...Array.from({ length: 8 }, (_, index) => ({ id: `g-${index}`, project_code: 'ACT-GD', candidate_role: index % 2 ? 'control' : 'plausible' })),
      ...Array.from({ length: 8 }, (_, index) => ({ id: `h-${index}`, project_code: 'ACT-HV', candidate_role: index % 2 ? 'control' : 'plausible' })),
      ...Array.from({ length: 8 }, (_, index) => ({ id: `a-${index}`, project_code: 'ACT-JH-CT', candidate_role: index % 2 ? 'control' : 'plausible' })),
    ];
    const batch = selectWeeklyBenchmarkBatch(cases);
    expect(batch).toHaveLength(12);
    expect(batch.filter((item) => benchmarkLane(item.project_code) === 'commercial_public_benefit')).toHaveLength(4);
    expect(batch.filter((item) => benchmarkLane(item.project_code) === 'community_partner')).toHaveLength(4);
    expect(batch.filter((item) => benchmarkLane(item.project_code) === 'arts_cultural')).toHaveLength(4);
  });
});
