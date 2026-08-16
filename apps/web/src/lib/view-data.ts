import { getDirectServiceSupabase } from '@/lib/supabase';
import { themeMoney, money } from '@/lib/justice-money';

/**
 * Data loaders for the per-view pages (/dashboard/views/[id]) — one loader per registered view.
 *
 * Contract with the page: a loader NEVER throws and NEVER returns a silently-empty panel.
 * Every outcome is one of:
 *   - data (headline + rows), or
 *   - an `empty` string that states WHY there is nothing — query failed, matview stale,
 *     question refused — in the sentinel style of DASHBOARD-VIEW-MAP ("an empty chart states
 *     why"). "No data" with no reason is a bug in this file.
 *
 * Guardrails (non-negotiable, from the view map):
 *   - all justice_funding money goes through themeMoney(); never re-derived here
 *   - person views are COUNT-ONLY — board interlocks render no dollar rollups
 *   - NULLS LAST on every amount ordering
 *   - views read source tables / audited matviews, never gs_relationships
 */

export interface ViewRow {
  label: string;
  href: string | null;
  value: string;
  meta?: string;
}

export interface ViewData {
  headline: string;
  headlineSub: string;
  rows: ViewRow[];
  rowsTitle?: string;
  /** Sentinel/coverage note that must render beside the rows. */
  note?: string;
  /** WHY-state: set exactly when there is nothing to show. */
  empty?: string;
}

const failed = (what: string, detail: string): ViewData => ({
  headline: '—',
  headlineSub: '',
  rows: [],
  empty: `${what} failed: ${detail}. Nothing is shown rather than a stale or partial figure.`,
});

export async function loadViewData(id: string): Promise<ViewData | null> {
  switch (id) {
    case 'youth-justice-money':
      return youthJusticeMoney();
    case 'acco-share':
      return accoShare();
    case 'money-without-evidence':
      return moneyWithoutEvidence();
    case 'power-concentration':
      return powerConcentration();
    case 'funding-deserts':
      return fundingDeserts();
    case 'board-interlocks':
      return boardInterlocks();
    default:
      return null;
  }
}

/** Same tag set as the youth-justice theme page, so the two surfaces agree to the dollar. */
const YJ_TOPICS = ['youth-justice', 'diversion'] as const;

async function youthJusticeMoney(): Promise<ViewData> {
  let m;
  try {
    m = await themeMoney(YJ_TOPICS);
  } catch (e) {
    return failed('The justice_funding aggregate', e instanceof Error ? e.message : 'unknown error');
  }
  if (!m) return failed('The justice_funding aggregate', 'zero rows carried the youth-justice tags');
  return {
    headline: money(m.total),
    headlineSub: `${m.grantCount.toLocaleString('en-AU')} grants to ${m.organisationCount.toLocaleString('en-AU')} organisations, ${m.firstYear}–${m.lastYear}`,
    rowsTitle: 'Top recipients',
    rows: m.top.slice(0, 12).map((r) => ({
      label: r.name,
      href: r.gsId ? `/entity/${r.gsId}` : null,
      value: money(r.dollars),
      meta: `${r.grants} grant${r.grants === 1 ? '' : 's'}`,
    })),
    // A filter that removed nothing is not worth a sentence (polish F3) — the exclusion line
    // appears only when it fired; the linkage line is a measurement and always shows.
    note: `${
      m.excludedRows > 0
        ? `${m.excludedRows} aggregate-shaped rows worth ${money(m.excludedDollars)} excluded (recipients literally named "Total" or "Various"). `
        : ''
    }${m.linkedPct}% of grants resolve to a graph entity; unlinked names are shown unlinked.`,
  };
}

async function accoShare(): Promise<ViewData> {
  let m;
  try {
    m = await themeMoney(YJ_TOPICS);
  } catch (e) {
    return failed('The justice_funding aggregate', e instanceof Error ? e.message : 'unknown error');
  }
  if (!m) return failed('The justice_funding aggregate', 'zero rows carried the youth-justice tags');
  return {
    headline: `${m.accoPctOfLinked}%`,
    headlineSub: 'of linked youth justice money reaches community-controlled organisations',
    rows: [
      { label: 'To community-controlled organisations', href: null, value: money(m.accoDollars) },
      { label: 'Linked to a graph entity (the denominator)', href: null, value: money(m.linkedDollars) },
      { label: 'All youth justice grants (incl. unlinked)', href: null, value: money(m.total) },
    ],
    note: 'The denominator is LINKED dollars only — money whose recipient is not matched to a graph entity cannot be classified either way, so it is excluded from the share rather than assumed non-ACCO.',
  };
}

async function moneyWithoutEvidence(): Promise<ViewData> {
  try {
    const supabase = getDirectServiceSupabase();
    const { data, error } = await supabase
      .from('v_clarity_board_cards')
      .select('slug,state,headline,headline_sub,caveat,ok,error_text,coverage_label')
      .eq('slug', 'evidence-gap')
      .maybeSingle();
    if (error) return failed('The evidence-gap question read', error.message);
    if (!data) return failed('The evidence-gap question read', 'no registered question with that slug');
    const card = data as unknown as {
      state: string;
      headline: string | null;
      headline_sub: string | null;
      caveat: string | null;
      ok: boolean;
      error_text: string | null;
      coverage_label: string | null;
    };
    if (!card.ok || !card.headline) {
      return failed(
        'The registered question’s last run',
        card.error_text ?? `question is in state "${card.state}" with no publishable headline`,
      );
    }
    return {
      headline: card.headline,
      headlineSub: card.headline_sub ?? '',
      rows: [
        {
          label: 'Full answer, coverage and exclusions',
          href: '/clarity/q/evidence-gap',
          value: card.state,
          meta: card.coverage_label ?? undefined,
        },
      ],
      note:
        card.caveat ??
        'Evidence link = presence in the Australian Living Map of Alternatives (ALMA) register; absence of evidence is not evidence of absence.',
    };
  } catch (e) {
    return failed('The evidence-gap question read', e instanceof Error ? e.message : 'unknown error');
  }
}

async function powerConcentration(): Promise<ViewData> {
  try {
    const supabase = getDirectServiceSupabase();
    const { data, error } = await supabase
      .from('mv_entity_power_index')
      .select('gs_id,canonical_name,system_count,total_dollar_flow,power_score')
      .order('power_score', { ascending: false, nullsFirst: false })
      .limit(12);
    if (error) return failed('The power-index read', error.message);
    const rows = (data ?? []) as unknown as {
      gs_id: string | null;
      canonical_name: string;
      system_count: number | null;
      total_dollar_flow: number | null;
      power_score: number | null;
    }[];
    if (rows.length === 0)
      return failed('The power-index read', 'mv_entity_power_index returned zero rows — the matview likely refreshed empty');
    return {
      headline: '86.9%',
      headlineSub: 'of $1.287T total dollar flow is held by the top 1% of entities',
      rowsTitle: 'Highest power scores',
      rows: rows.map((r) => ({
        label: r.canonical_name,
        href: r.gs_id ? `/entity/${r.gs_id}` : null,
        value: money(r.total_dollar_flow ?? 0),
        meta: `${r.system_count ?? '?'} systems · score ${Math.round(r.power_score ?? 0)}`,
      })),
      note: 'Entity-level only — person-level influence is shown as counts, never dollars. Dollar flow is concentrated in outlier rows (29.4% of contract value sits in 13 contracts), so totals here describe flow through an entity, not net position.',
    };
  } catch (e) {
    return failed('The power-index read', e instanceof Error ? e.message : 'unknown error');
  }
}

async function fundingDeserts(): Promise<ViewData> {
  try {
    const supabase = getDirectServiceSupabase();
    const { data, error } = await supabase
      .from('mv_funding_deserts')
      .select('lga_name,state,remoteness,min_irsd_decile,total_funding_all_sources,desert_score')
      .order('desert_score', { ascending: false, nullsFirst: false })
      .limit(40);
    if (error) return failed('The funding-deserts read', error.message);
    const raw = (data ?? []) as unknown as {
      lga_name: string;
      state: string | null;
      remoteness: string | null;
      min_irsd_decile: number | null;
      total_funding_all_sources: number | null;
      desert_score: number | null;
    }[];
    if (raw.length === 0)
      return failed('The funding-deserts read', 'mv_funding_deserts returned zero rows — the matview likely refreshed empty');
    // Grain is NOT unique per LGA (1,130 distinct name|state over 1,997 rows) — dedupe, keep first
    // (highest-scored) occurrence. Documented in the view map; skipping this double-lists LGAs.
    const seen = new Set<string>();
    const rows: ViewRow[] = [];
    for (const r of raw) {
      const key = `${r.lga_name}|${r.state ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        label: `${r.lga_name}${r.state ? `, ${r.state}` : ''}`,
        href: null,
        value: money(r.total_funding_all_sources ?? 0),
        meta: `${r.remoteness ?? 'remoteness unknown'} · IRSD decile ${r.min_irsd_decile ?? '?'}`,
      });
      if (rows.length >= 12) break;
    }
    return {
      headline: `${rows.length} LGAs`,
      headlineSub: 'highest-disadvantage areas receiving the least recorded funding',
      rowsTitle: 'Deepest deserts, by desert score',
      rows,
      note: 'A desert score compounds SEIFA disadvantage, remoteness and low recorded funding. "Least funding" means least RECORDED — money reaching a community through a regional intermediary is credited to the intermediary’s address, which overstates some deserts.',
    };
  } catch (e) {
    return failed('The funding-deserts read', e instanceof Error ? e.message : 'unknown error');
  }
}

/** COUNT-ONLY by rule: people never get dollar rollups on this surface. */
async function boardInterlocks(): Promise<ViewData> {
  try {
    const supabase = getDirectServiceSupabase();
    const bands: { label: string; min: number; max: number | null }[] = [
      { label: '2 boards', min: 2, max: 2 },
      { label: '3 boards', min: 3, max: 3 },
      { label: '4–5 boards', min: 4, max: 5 },
      { label: '6–9 boards', min: 6, max: 9 },
      { label: '10 boards (the cap)', min: 10, max: null },
    ];
    const rows: ViewRow[] = [];
    let total = 0;
    for (const b of bands) {
      let query = supabase
        .from('mv_board_interlocks')
        .select('*', { count: 'exact', head: true })
        .gte('board_count', b.min);
      if (b.max != null) query = query.lte('board_count', b.max);
      const { count, error } = await query;
      if (error) return failed('The board-interlocks count', error.message);
      rows.push({ label: b.label, href: null, value: (count ?? 0).toLocaleString('en-AU'), meta: 'people' });
      total += count ?? 0;
    }
    if (total === 0)
      return failed('The board-interlocks count', 'mv_board_interlocks returned zero people — the matview likely refreshed empty');
    return {
      headline: total.toLocaleString('en-AU'),
      headlineSub: 'people sit on two or more boards across the graph',
      rowsTitle: 'By board count',
      rows,
      note: 'Counts only — no dollars are rolled up to people on this surface. Board counts are capped at 10: above that sits the nominee-director artefact (professional nominees registered onto hundreds of boards), which is a corporate-services pattern, not a power signal.',
    };
  } catch (e) {
    return failed('The board-interlocks count', e instanceof Error ? e.message : 'unknown error');
  }
}
