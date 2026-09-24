import { describe, expect, it } from 'vitest';
import { decisionKey, decisionState, isWrongProject, latestDecisions, passReasonLabel, VERB_DECISION, type DecisionRow } from './act-desk-decisions';

const row = (over: Partial<DecisionRow>): DecisionRow => ({
  id: 'x', source_type: 'grant', source_ref: 'g1', project_code: 'ACT-GD',
  decision: 'no', reason: null, notes: null, created_at: '2026-09-24T00:00:00Z', ...over,
});

describe('desk decisions', () => {
  it('maps every verb into the opportunity_decisions CHECK vocabulary', () => {
    const allowed = ['no', 'later', 'research', 'partner', 'apply', 'send_to_ghl', 'won', 'lost', 'more_info', 'review'];
    for (const d of Object.values(VERB_DECISION)) expect(allowed).toContain(d);
  });

  it('lets the latest row per grant and project win, whatever order rows arrive in', () => {
    const m = latestDecisions([
      row({ id: 'b', decision: 'apply', created_at: '2026-09-24T02:00:00Z' }),
      row({ id: 'a', decision: 'no', created_at: '2026-09-24T01:00:00Z' }),
      row({ id: 'c', project_code: 'ACT-JH', decision: 'later' }),
    ]);
    expect(m.get(decisionKey('grant', 'g1', 'ACT-GD'))?.state).toBe('pursuing');
    expect(m.get(decisionKey('grant', 'g1', 'ACT-JH'))?.state).toBe('saved');
  });

  it('puts an undone decision back on the desk', () => {
    const m = latestDecisions([
      row({ id: 'a', decision: 'no', created_at: '2026-09-24T01:00:00Z' }),
      row({ id: 'b', decision: 'review', created_at: '2026-09-24T02:00:00Z' }),
    ]);
    expect(m.get(decisionKey('grant', 'g1', 'ACT-GD'))?.state).toBe('open');
  });

  it('reads a wrong-project pass, including the three older free-text passes', () => {
    expect(isWrongProject('wrong_project')).toBe(true);
    expect(isWrongProject('Not relevant to Goods on Country')).toBe(true);
    expect(isWrongProject('not_now')).toBe(false);
    expect(isWrongProject(null)).toBe(false);
  });

  it('keeps a null project code distinct from a coded one', () => {
    expect(decisionKey('funder', 'f1', null)).not.toBe(decisionKey('funder', 'f1', 'ACT-GD'));
    expect(decisionState('send_to_ghl')).toBe('pursuing');
    expect(passReasonLabel('cannot_apply')).toBe("We can't apply");
    expect(passReasonLabel('Not relevant to Goods on Country')).toBe('Not relevant to Goods on Country');
  });
});
