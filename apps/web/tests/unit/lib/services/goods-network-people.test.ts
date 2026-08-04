import { describe, expect, it } from 'vitest';
import { buildGoodsNetworkSnapshot } from '@/lib/services/goods-network-people';

describe('GOODS network people', () => {
  it('keeps direct, reported and research-only signals distinct', () => {
    const relationships = [
      {
        id: 'bodie-path',
        relationship_type: 'production_partner',
        display_name: 'NT Corrections',
        stage: 'in_conversation',
        next_action: 'Scope a pilot.',
        next_action_due: '2026-08-03',
        source_refs: {
          goodsNetwork: true,
          networkLane: 'production',
          networkPriority: 10,
          interestEvidence: { form: 'direct_message', summary: 'Direct offer to explore capability.' },
          qbeRelevance: 'Execution pathway, not external capital.',
          guardrail: 'No production commitment.',
        },
      },
      {
        id: 'gavin-path',
        relationship_type: 'impact_investor',
        display_name: 'Wyatt CLIF',
        stage: 'in_conversation',
        source_refs: {
          goodsNetwork: true,
          networkLane: 'capital',
          networkPriority: 20,
          interestEvidence: { form: 'user_reported', summary: 'Interest reported by Ben.' },
          qbeRelevance: 'Potential patient debt.',
          guardrail: 'No ask or commitment.',
        },
      },
      {
        id: 'cdu-path',
        relationship_type: 'production_partner',
        display_name: 'CDU',
        stage: 'researching',
        source_refs: {
          goodsNetwork: true,
          networkLane: 'production',
          networkPriority: 30,
          interestEvidence: { form: 'public_research', summary: 'Official adjacency only.' },
          qbeRelevance: 'Training pathway.',
          guardrail: 'Do not claim interest.',
        },
      },
    ];
    const contacts = [
      { id: 'bodie', name: 'Bodie Green', goods_relationship_id: 'bodie-path', notes: 'Privacy-safe summary.' },
      { id: 'gavin', name: 'Gavin Reid', goods_relationship_id: 'gavin-path', notes: 'Reported interest.' },
    ];

    const snapshot = buildGoodsNetworkSnapshot({ contactRows: contacts, relationshipRows: relationships });

    expect(snapshot.people).toHaveLength(2);
    expect(snapshot.people.find((person) => person.name === 'Bodie Green')).toMatchObject({
      evidenceForm: 'direct_message',
      lane: 'production',
    });
    expect(snapshot.people.find((person) => person.name === 'Gavin Reid')).toMatchObject({
      evidenceForm: 'user_reported',
      lane: 'capital',
    });
    expect(snapshot.pathways.find((pathway) => pathway.displayName === 'CDU')).toMatchObject({
      evidenceForm: 'public_research',
      stage: 'researching',
    });
    expect(snapshot.people.some((person) => person.relationshipId === 'cdu-path')).toBe(false);
  });
});
