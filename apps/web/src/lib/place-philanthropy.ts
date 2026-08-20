import { getDirectServiceSupabase } from '@/lib/supabase';

/**
 * Philanthropic grants we can see reaching organisations in a place.
 *
 * WHAT THIS IS. `foundation_grantees` holds grantee lists scraped or curated from foundations that
 * publish them. Joined to placed organisations it answers a question none of the government lanes
 * can: which foundations and family trusts actually fund the organisations in this council.
 *
 * It reaches further into remote Australia than expected — 519 grants across 121 remote and
 * very-remote councils. The Ian Potter Foundation gave $300,000 to Wilya Anyul Janta Aboriginal
 * Corporation in Barkly; FRRR gave $50,000 to Laynhapuy Homelands in East Arnhem.
 *
 * THE COVERAGE CAVEAT IS SEVERE AND MUST TRAVEL WITH EVERY FIGURE. Measured 2026-08-21:
 *
 *   - We hold a grantee list for **24 foundations**. `foundations` holds **11,177**.
 *   - Of the 519 grants reaching remote councils, **FRRR is 462 and the Ian Potter Foundation is
 *     46 — 98% between them.** Paul Ramsay is 5; nine others hold one or two each.
 *
 * So this is not a picture of philanthropy in a place. It is a picture of the two foundations that
 * publish comprehensively, plus fragments. **An empty result means we do not hold that funder's
 * list — never that no philanthropy reached the community**, and the surface has to say so, because
 * a blank here would read as neglect by the sector rather than absence in our records.
 *
 * AMOUNTS. Some rows carry no amount because the funder does not publish one — those are flagged
 * `amount_unknown` (#291, 152 rows marked 2026-08-21) and must render as "amount not published"
 * rather than blank or zero. A funder that lists a grantee without a figure has still funded them.
 */

export interface PlaceGrant {
  foundation: string;
  grantee: string;
  granteeGsId: string | null;
  amount: number | null;
  /** True where the funder published a grantee but no figure. Not the same as an unknown we failed
   * to look up — see #285's backfill/unknown split. */
  amountNotPublished: boolean;
  year: number | null;
}

export interface PlacePhilanthropy {
  grants: PlaceGrant[];
  foundations: number;
  totalKnown: number;
}

export async function philanthropyInPlace(
  lgaName: string,
  limit = 12,
): Promise<PlacePhilanthropy | null> {
  const safe = lgaName.replace(/'/g, "''");
  const cap = Math.max(1, Math.min(60, Math.floor(limit)));
  const db = getDirectServiceSupabase();
  const { data, error } = await db.rpc('exec_sql', {
    query: `
      SELECT fg.foundation_name AS foundation,
             fg.grantee_name AS grantee,
             e.gs_id AS grantee_gs_id,
             fg.grant_amount AS amount,
             COALESCE(fg.amount_unknown, false) AS amount_unknown,
             fg.grant_year AS year
        FROM foundation_grantees fg
        JOIN gs_entities e ON e.id = fg.grantee_entity_id
       WHERE e.lga_name = '${safe}'
       ORDER BY fg.grant_amount DESC NULLS LAST, fg.grant_year DESC NULLS LAST
       LIMIT ${cap}`,
  });
  if (error) throw new Error(`place philanthropy query failed: ${error.message}`);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return null;

  const grants: PlaceGrant[] = rows.map(r => ({
    foundation: String(r.foundation ?? ''),
    grantee: String(r.grantee ?? ''),
    granteeGsId: (r.grantee_gs_id as string | null) || null,
    amount: r.amount === null || r.amount === undefined ? null : Number(r.amount) || 0,
    amountNotPublished: r.amount_unknown === true,
    year: r.year === null || r.year === undefined ? null : Number(r.year) || null,
  }));

  return {
    grants,
    foundations: new Set(grants.map(g => g.foundation)).size,
    totalKnown: grants.reduce((sum, g) => sum + (g.amount ?? 0), 0),
  };
}
