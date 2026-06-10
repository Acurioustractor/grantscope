/**
 * Thin service for the Goods Evidence Readiness board.
 *
 * Static-imports the QBE diagnostic snapshot (bundled inside the app so it
 * deploys), applies the pure ordering and summary logic, and hands the page a
 * ready-to-render shape. This board mirrors Notion; it never edits it. Refresh
 * the snapshot with scripts/sync-qbe-diagnostic.mjs.
 */
import snapshot from '../data/goods-qbe-diagnostic.json';
import {
  compareAreas,
  summarize,
  type QbeArea,
  type EvidenceSummary,
} from './goods-evidence-shared';

export interface GoodsEvidence {
  syncedAt: string;
  areas: QbeArea[];
  summary: EvidenceSummary;
}

/**
 * Read the bundled snapshot and return areas sorted by urgency (status rank
 * then number) plus the headline summary. `now` is injectable for tests; it
 * defaults to the current date so overdue figures stay live.
 */
export function getGoodsEvidence(now: Date = new Date()): GoodsEvidence {
  const areas = (snapshot.areas as QbeArea[]).slice().sort(compareAreas);
  return {
    syncedAt: snapshot.syncedAt,
    areas,
    summary: summarize(areas, now),
  };
}
