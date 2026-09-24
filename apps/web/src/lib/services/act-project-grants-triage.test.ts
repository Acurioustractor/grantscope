import { describe, expect, it } from 'vitest';
import { buildProjectGrantRows, grantDecisionDue, jevStrongFit, jevWords, type TriageSourceRow } from './act-project-grants-triage';

const TODAY = new Date('2026-09-24T03:00:00Z');

const src = (over: Partial<TriageSourceRow>): TriageSourceRow => ({
  id: 'g1', name: 'Round', provider: 'Funder', deadline: null, closes_at: null, amount_min: null, amount_max: 50000,
  url: null, status: 'open', geography: null, dgr_required: null, accepts_pty_ltd: null, place: null,
  ghl_opportunity_id: null, aligned_projects: ['ACT-CN'], goods_relevance_score: 0, goods_relevance_signals: null,
  project_relevance: {}, ...over,
});

describe('project grant rows', () => {
  it('reads the close date from closes_at before deadline, and drops closed rounds', () => {
    const [row] = buildProjectGrantRows([src({ closes_at: '2026-10-04', deadline: '2026-09-01' })], TODAY);
    expect(row.deadline).toBe('2026-10-04');
    expect(row.daysToDeadline).toBe(10);
    expect(buildProjectGrantRows([src({ closes_at: '2026-09-20' })], TODAY)).toHaveLength(0);
  });

  it('carries the keyword score, Jev verdict and who tagged it, per project', () => {
    const [row] = buildProjectGrantRows([src({
      project_relevance: { contained: { score: 10, tagged_by: 'rubric', rubric: { score: 2.85, confidence: 0.85 } } },
    })], TODAY);
    expect(row).toMatchObject({ project: 'contained', code: 'ACT-CN', fitScore: 10, jevScore: 2.85, jevConfidence: 0.85, taggedBy: 'rubric' });
    expect(jevStrongFit(row)).toBe(true);
    // Visions of Australia: keyword 10 would never make it due; Jev's strong fit does.
    expect(grantDecisionDue(row)).toBe(true);
  });

  it('takes Goods fit and provenance from the Goods columns', () => {
    const [row] = buildProjectGrantRows([src({
      aligned_projects: ['ACT-GD', 'goods'], goods_relevance_score: 78, goods_relevance_signals: { tagged_by: 'keyword' },
    })], TODAY);
    expect(row).toMatchObject({ project: 'goods', fitScore: 78, taggedBy: 'keyword', jevScore: null });
    expect(grantDecisionDue(row)).toBe(false);
  });

  it('does not count a Jev fit outside the project area or below the confidence bar', () => {
    const base = { jevScore: 2.9, jevConfidence: 0.9, jevOutsideArea: false };
    expect(jevStrongFit({ ...base, jevOutsideArea: true })).toBe(false);
    expect(jevStrongFit({ ...base, jevConfidence: 0.3 })).toBe(false);
  });

  it('says the Jev score in words', () => {
    expect(jevWords(null)).toBe('not read yet');
    expect(jevWords(2.6)).toBe('strong fit');
    expect(jevWords(1.99)).toBe('plausible');
    expect(jevWords(0.58)).toBe('no connection');
  });
});

describe('amounts', () => {
  it('treats a stored zero as not stated', () => {
    const [row] = buildProjectGrantRows([src({ amount_min: 0, amount_max: 0 })], TODAY);
    expect(row.amountMin).toBeNull();
    expect(row.amountMax).toBeNull();
  });
});
