import { describe, expect, it } from 'vitest';
import {
  buildGoodsLivingDataSnapshot,
  type GoodsLivingRowsBundle,
} from '@/lib/services/goods-living-data-adapter';
import { buildGoodsMatterDesk } from '@/lib/services/goods-matter-desk';

function emptyBundle(): GoodsLivingRowsBundle {
  const empty = { rows: [], error: null };
  return {
    communities: empty,
    assets: empty,
    deployments: empty,
    procurementSignals: empty,
    procurementEntities: empty,
    relationships: empty,
    ghlOpportunities: empty,
    xeroInvoices: empty,
    contactEntityLinks: empty,
    ghlContacts: empty,
    relationshipHealth: empty,
  };
}

describe('buildGoodsMatterDesk', () => {
  it('projects each Goods place into the shared matter contract', () => {
    const snapshot = buildGoodsLivingDataSnapshot(
      emptyBundle(),
      new Date('2026-07-29T00:00:00.000Z'),
    );

    const desk = buildGoodsMatterDesk(snapshot);

    expect(desk.project).toMatchObject({
      id: 'goods',
      label: 'Goods',
    });
    expect(desk.matterOrder).toEqual([
      'oonchiumpa',
      'utopia',
      'tennant-creek',
      'palm-island',
    ]);
    expect(desk.matters.oonchiumpa).toMatchObject({
      projectId: 'goods',
      title: 'Oonchiumpa',
      placeLabel: 'Mparntwe / Alice Springs, NT',
      pathway: {
        position: 'resource',
        label: 'Resource',
      },
      authority: {
        state: 'unknown',
        label: 'Community authority unconfirmed',
      },
      currentRequest: {
        state: 'unknown',
      },
      nextAction: {
        owner: null,
        dueAt: null,
      },
    });
  });

  it('keeps source gaps and conflicts as evidence state rather than readiness', () => {
    const snapshot = buildGoodsLivingDataSnapshot(
      emptyBundle(),
      new Date('2026-07-29T00:00:00.000Z'),
    );

    const matter = buildGoodsMatterDesk(snapshot).matters.utopia;

    expect(matter.evidence.state).toBe('partial');
    expect(matter.evidence.humanReviewConnected).toBe(false);
    expect(matter.pathway.disclaimer).toContain('not a CRM stage');
  });
});

