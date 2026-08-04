import type {
  ActMatterDeskEvidenceState,
  ActMatterDeskMatter,
  ActMatterDeskSnapshot,
} from '@/lib/services/act-matter-desk';
import type {
  GoodsLivingDataSnapshot,
  GoodsLivingPlaceId,
} from '@/lib/services/goods-living-data-adapter';
import {
  GOODS_PLACE_PATHWAYS,
  GOODS_PUBLIC_STAGES,
} from '@/lib/services/goods-living-investment-model';

export type GoodsMatterDeskSnapshot = ActMatterDeskSnapshot<GoodsLivingPlaceId>;

function evidenceState(value: string): ActMatterDeskEvidenceState {
  if (value === 'confirmed' || value === 'connected') return 'verified';
  if (value === 'unavailable') return 'unavailable';
  return 'unknown';
}

/**
 * Translate Goods records into the shared ACT matter-desk contract.
 *
 * This is deliberately a projection, not a second source of truth. The Goods
 * adapter retains the domain detail; the shared contract carries only the
 * evidence needed to support a human decision.
 */
export function buildGoodsMatterDesk(
  snapshot: GoodsLivingDataSnapshot,
): GoodsMatterDeskSnapshot {
  const matters = Object.fromEntries(
    GOODS_PLACE_PATHWAYS.map((pathway): [GoodsLivingPlaceId, ActMatterDeskMatter<GoodsLivingPlaceId>] => {
      const place = snapshot.places[pathway.id];
      const stage = GOODS_PUBLIC_STAGES.find((candidate) => candidate.id === pathway.stage);
      const evidenceStateValue: ActMatterDeskEvidenceState =
        place.decisionRead.conflicts.length > 0
          ? 'conflicted'
          : place.decisionRead.qualityState === 'clear'
            ? 'verified'
            : place.decisionRead.qualityState === 'source-unavailable'
              ? 'unavailable'
              : 'partial';

      return [
        pathway.id,
        {
          id: pathway.id,
          projectId: 'goods',
          title: pathway.name,
          placeLabel: pathway.country,
          readAt: snapshot.asOf,
          pathway: {
            position: pathway.stage,
            label: stage?.label ?? pathway.stage,
            holds: stage?.holds ?? 'Working position',
            disclaimer: 'A human-held working position, not a CRM stage, consent record or score.',
          },
          nextDecision: pathway.nextDecision,
          unresolvedQuestions: [...pathway.questions],
          authority: {
            state: evidenceState(place.decisionRead.authority.status),
            label: place.decisionRead.authority.label,
            note: place.decisionRead.authority.note,
          },
          currentRequest: {
            state: evidenceState(place.decisionRead.currentAuthorisedRequest.status),
            label: place.decisionRead.currentAuthorisedRequest.label,
            note: place.decisionRead.currentAuthorisedRequest.note,
          },
          evidence: {
            state: evidenceStateValue,
            conflictCount: place.decisionRead.conflicts.length,
            sourceCount: place.provenance.length,
            humanReviewConnected: place.decisionRead.humanReview.connected,
            note: place.fallbackReasons[0] ?? 'Connected records remain bounded by their source and authority.',
          },
          nextAction: {
            label: place.decisionRead.openAction.action,
            owner: place.decisionRead.openAction.owner,
            dueAt: place.decisionRead.openAction.dueAt,
            source: place.decisionRead.openAction.source,
          },
        },
      ];
    }),
  ) as Record<GoodsLivingPlaceId, ActMatterDeskMatter<GoodsLivingPlaceId>>;

  return {
    project: {
      id: 'goods',
      label: 'Goods',
      purpose: 'Community-held products, capability and ownership on Country.',
    },
    matters,
    matterOrder: GOODS_PLACE_PATHWAYS.map((pathway) => pathway.id),
    mode: 'read-only',
    assembledAt: snapshot.asOf,
  };
}
