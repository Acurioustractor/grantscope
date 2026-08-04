import { describe, expect, it } from 'vitest';
import {
  CORRECTION_TYPES,
  impliedLabelFor,
  validateCorrection,
} from '@/lib/services/ask-grantscope-corrections';

describe('impliedLabelFor', () => {
  it('maps not_useful to not_relevant', () => {
    expect(impliedLabelFor('not_useful', null)).toBe('not_relevant');
  });

  it('maps good_result to relevant', () => {
    expect(impliedLabelFor('good_result', null)).toBe('relevant');
  });

  it('never guesses a direction for wrong_eligibility', () => {
    expect(impliedLabelFor('wrong_eligibility', null)).toBeNull();
    expect(impliedLabelFor('wrong_eligibility', 'relevant')).toBe('relevant');
    expect(impliedLabelFor('wrong_eligibility', 'not_relevant')).toBe('not_relevant');
  });

  it('implies no label for corrections that have no case to relabel', () => {
    expect(impliedLabelFor('missing_opportunity', null)).toBeNull();
    expect(impliedLabelFor('wrong_fact', null)).toBeNull();
  });

  it('ignores a supplied label where the type carries none', () => {
    expect(impliedLabelFor('missing_opportunity', 'relevant')).toBeNull();
    expect(impliedLabelFor('wrong_fact', 'not_relevant')).toBeNull();
  });

  it('produces only valid benchmark labels for every correction type', () => {
    for (const type of CORRECTION_TYPES) {
      const label = impliedLabelFor(type, null);
      expect(label === null || label === 'relevant' || label === 'not_relevant').toBe(true);
    }
  });
});

describe('validateCorrection', () => {
  const base = {
    question: 'What can fund Goods in the NT right now?',
    projectCode: 'ACT-GD',
    opportunityId: '11111111-1111-1111-1111-111111111111',
    rationale: 'Research-only program, not applicable to enterprise delivery.',
    reviewer: { userId: null, email: 'ben@benjamink.com.au' },
  };

  it('accepts a complete not_useful correction', () => {
    const result = validateCorrection({ ...base, correctionType: 'not_useful' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('requires a rationale, since a reason-free correction teaches nothing', () => {
    const result = validateCorrection({ ...base, correctionType: 'not_useful', rationale: '  ' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('rationale is required');
  });

  it('requires an explicit label for wrong_eligibility', () => {
    const result = validateCorrection({ ...base, correctionType: 'wrong_eligibility' });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('explicit label');
  });

  it('accepts wrong_eligibility once a direction is given', () => {
    const result = validateCorrection({
      ...base,
      correctionType: 'wrong_eligibility',
      label: 'not_relevant',
    });
    expect(result.valid).toBe(true);
  });

  it('requires an opportunity for opportunity-specific corrections', () => {
    const result = validateCorrection({
      ...base,
      correctionType: 'not_useful',
      opportunityId: null,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('requires an opportunityId');
  });

  it('allows missing_opportunity without an opportunity id', () => {
    const result = validateCorrection({
      ...base,
      correctionType: 'missing_opportunity',
      opportunityId: null,
      projectCode: null,
    });
    expect(result.valid).toBe(true);
  });

  it('requires a project code, because relevance is relative to a project', () => {
    const result = validateCorrection({
      ...base,
      correctionType: 'good_result',
      projectCode: null,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('requires a projectCode');
  });

  it('rejects an unknown correction type', () => {
    const result = validateCorrection({
      ...base,
      correctionType: 'looks_wrong' as never,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('correctionType must be one of');
  });

  it('rejects a label outside the benchmark vocabulary', () => {
    const result = validateCorrection({
      ...base,
      correctionType: 'wrong_eligibility',
      label: 'maybe' as never,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('label must be relevant or not_relevant');
  });
});
