import { describe, it, expect } from 'vitest';
import { computeScored, computePipelineStats } from '@/app/reports/youth-justice/follow-the-child';
import type { HeatmapRow } from '@/app/reports/youth-justice/follow-the-child';

function makeRow(overrides: Partial<HeatmapRow> = {}): HeatmapRow {
  return {
    lga_name: 'Test LGA',
    state: 'NSW',
    population: 10000,
    low_icsea: 0,
    avg_icsea: 1000,
    schools: 5,
    indigenous_pct: 5,
    dsp_rate: 10,
    jobseeker_rate: 15,
    youth_allowance_rate: 8,
    cost_per_day: 1500,
    recidivism_pct: 50,
    indigenous_rate_ratio: 10,
    detention_indigenous_pct: 60,
    ndis_rate: 5,
    crime_rate: 3000,
    alma_count: 0,
    ...overrides,
  };
}

describe('computeScored', () => {
  it('returns scored rows sorted by burden descending', () => {
    const rows = [
      makeRow({ lga_name: 'Low', dsp_rate: 1, jobseeker_rate: 1, crime_rate: 100 }),
      makeRow({ lga_name: 'High', dsp_rate: 100, jobseeker_rate: 100, crime_rate: 50000 }),
    ];
    const scored = computeScored(rows);
    expect(scored[0].lga_name).toBe('High');
    expect(scored[1].lga_name).toBe('Low');
  });

  it('assigns burden between 0 and 1', () => {
    const rows = [
      makeRow({ lga_name: 'A' }),
      makeRow({ lga_name: 'B', dsp_rate: 0, jobseeker_rate: 0, crime_rate: 0 }),
    ];
    const scored = computeScored(rows);
    for (const row of scored) {
      expect(row.burden).toBeGreaterThanOrEqual(0);
      expect(row.burden).toBeLessThanOrEqual(1);
    }
  });

  it('handles single row without division errors', () => {
    const scored = computeScored([makeRow()]);
    expect(scored).toHaveLength(1);
    expect(Number.isFinite(scored[0].burden)).toBe(true);
  });

  it('handles empty array', () => {
    const scored = computeScored([]);
    expect(scored).toHaveLength(0);
  });

  it('handles all-zero indicators', () => {
    const rows = [
      makeRow({
        low_icsea: 0, avg_icsea: 0, indigenous_pct: 0,
        dsp_rate: 0, jobseeker_rate: 0, youth_allowance_rate: 0,
        cost_per_day: 0, recidivism_pct: null, indigenous_rate_ratio: 0,
        detention_indigenous_pct: 0, ndis_rate: 0, crime_rate: 0,
      }),
    ];
    const scored = computeScored(rows);
    expect(scored[0].burden).toBe(0);
  });

  it('weights LGA-specific indicators 2x over state-level', () => {
    // Two rows: one with high LGA-specific, one with high state-level
    const lgaHigh = makeRow({
      lga_name: 'LGA-heavy',
      dsp_rate: 100, jobseeker_rate: 100, ndis_rate: 100, crime_rate: 50000,
      low_icsea: 10, indigenous_pct: 80, youth_allowance_rate: 100,
      cost_per_day: 0, recidivism_pct: 0, indigenous_rate_ratio: 0, detention_indigenous_pct: 0,
    });
    const stateHigh = makeRow({
      lga_name: 'State-heavy',
      dsp_rate: 0, jobseeker_rate: 0, ndis_rate: 0, crime_rate: 0,
      low_icsea: 0, indigenous_pct: 0, youth_allowance_rate: 0,
      cost_per_day: 3000, recidivism_pct: 90, indigenous_rate_ratio: 30, detention_indigenous_pct: 95,
    });
    const scored = computeScored([lgaHigh, stateHigh]);
    // LGA-heavy should rank higher because its indicators are weighted 2x
    expect(scored[0].lga_name).toBe('LGA-heavy');
  });

  it('handles null recidivism_pct gracefully', () => {
    const rows = [
      makeRow({ recidivism_pct: null }),
      makeRow({ recidivism_pct: 70 }),
    ];
    const scored = computeScored(rows);
    const nullRow = scored.find(r => r.scores.recidivism === 0);
    expect(nullRow).toBeDefined();
  });
});

describe('computePipelineStats', () => {
  it('computes averages across rows', () => {
    const rows = [
      makeRow({ dsp_rate: 10, population: 5000 }),
      makeRow({ dsp_rate: 20, population: 15000 }),
    ];
    const stats = computePipelineStats(rows);
    expect(stats.avgDspRate).toBe(15);
    expect(stats.totalLgas).toBe(2);
    expect(stats.totalPopulation).toBe(20000);
  });

  it('handles empty array without division by zero', () => {
    const stats = computePipelineStats([]);
    expect(stats.totalLgas).toBe(0);
    expect(stats.avgDspRate).toBe(0);
    expect(stats.avgRecidivism).toBeNull();
  });

  it('counts service deserts correctly', () => {
    const rows = [
      makeRow({ alma_count: 0 }),
      makeRow({ alma_count: 3 }),
      makeRow({ alma_count: 0 }),
    ];
    const stats = computePipelineStats(rows);
    expect(stats.serviceDeserts).toBe(2);
  });

  it('excludes null recidivism from average', () => {
    const rows = [
      makeRow({ recidivism_pct: null }),
      makeRow({ recidivism_pct: 60 }),
      makeRow({ recidivism_pct: 80 }),
    ];
    const stats = computePipelineStats(rows);
    expect(stats.avgRecidivism).toBe(70); // (60+80)/2, not (0+60+80)/3
  });

  it('excludes zero crime rates from average', () => {
    const rows = [
      makeRow({ crime_rate: 0 }),
      makeRow({ crime_rate: 1000 }),
      makeRow({ crime_rate: 3000 }),
    ];
    const stats = computePipelineStats(rows);
    expect(stats.avgCrimeRate).toBe(2000); // (1000+3000)/2
  });
});
