/**
 * Ben's "not a fit" passes on the One Desk, read back by the tag scorers.
 *
 * The desk writes opportunity_decisions (source_type 'grant', source_ref = grant_opportunities.id,
 * project_code = ACT-GD etc). The latest row per (grant, project) is the state. When that row is a pass
 * (decision 'no') whose reason says the project is wrong, the tag stays off:
 *   - applyProjectTags / applyGoodsTag read row.human_no (array of codes) and never add those codes;
 *   - enforceHumanVerdicts removes them from rows the current run did not rescore.
 * The machine scores are still stored beside the verdict, so keyword vs Jev vs Ben stays measurable.
 * Keep isWrongProject in step with apps/web/src/lib/services/act-desk-decisions.ts.
 */
import { PROJECT_CODES } from './project-relevance.mjs';

export function isWrongProject(reason) {
  if (!reason) return false;
  return reason === 'wrong_project' || /^not relevant to/i.test(reason);
}

/** Pure: latest decision per (grant, project) wins; returns Map grantId -> Set of rejected project codes. */
export function verdictsFromRows(rows) {
  const latest = new Map();
  for (const r of [...rows].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (!r.project_code) continue;
    latest.set(`${r.source_ref}|${r.project_code}`, r);
  }
  const out = new Map();
  for (const r of latest.values()) {
    if (r.decision !== 'no' || !isWrongProject(r.reason)) continue;
    if (!out.has(r.source_ref)) out.set(r.source_ref, new Set());
    out.get(r.source_ref).add(r.project_code);
  }
  return out;
}

export async function loadWrongProjectVerdicts(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('opportunity_decisions')
      .select('source_ref, project_code, decision, reason, created_at')
      .eq('source_type', 'grant')
      .order('created_at', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`human verdicts: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return verdictsFromRows(rows);
}

/** The rejected codes for a row, as an array (what the tag functions read from row.human_no). */
export function humanNoFor(verdicts, id) {
  return Array.from(verdicts.get(id) ?? []);
}

const SLUG_BY_CODE = Object.fromEntries(Object.entries(PROJECT_CODES).map(([slug, code]) => [code, slug]));

/**
 * Pure: take the rejected tags off one row. Returns null when nothing changes, else the columns to write.
 * ACT-GD also drops the legacy 'goods' literal and stamps goods_relevance_signals; the other five stamp
 * project_relevance.<slug>.tagged_by. Both record a tag_change by 'human'.
 */
export function enforceOnRow(row, codes, at = new Date().toISOString()) {
  const before = row.aligned_projects || [];
  const drop = new Set(codes);
  if (drop.has('ACT-GD')) drop.add('goods');
  const tagged = before.filter((t) => !drop.has(t));
  if (tagged.length === before.length) return null;

  const update = { aligned_projects: tagged };
  if (codes.includes('ACT-GD') && before.includes('ACT-GD')) {
    update.goods_relevance_signals = {
      ...(row.goods_relevance_signals || {}),
      tagged_by: 'human_no',
      tag_change: { change: 'removed', at, previous_score: row.goods_relevance_score ?? null, score: row.goods_relevance_score ?? null, by: 'human' },
    };
  }
  const relevance = { ...(row.project_relevance || {}) };
  let relevanceChanged = false;
  for (const code of codes) {
    const slug = SLUG_BY_CODE[code];
    if (!slug || slug === 'goods' || !before.includes(code)) continue;
    relevance[slug] = { ...(relevance[slug] || {}), tagged_by: 'human_no' };
    relevance.tag_changes = {
      ...(relevance.tag_changes || {}),
      [slug]: { change: 'removed', at, previous_score: relevance[slug]?.score ?? null, score: relevance[slug]?.score ?? null, by: 'human' },
    };
    relevanceChanged = true;
  }
  if (relevanceChanged) update.project_relevance = relevance;
  return update;
}

/** Remove every rejected tag still on a grant. Returns the names changed; writes only when apply is true. */
export async function enforceHumanVerdicts(supabase, verdicts, { apply = false } = {}) {
  const ids = Array.from(verdicts.keys());
  const changed = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from('grant_opportunities')
      .select('id, name, aligned_projects, goods_relevance_score, goods_relevance_signals, project_relevance')
      .in('id', ids.slice(i, i + 200));
    if (error) throw new Error(`enforce verdicts: ${error.message}`);
    for (const row of data ?? []) {
      const update = enforceOnRow(row, humanNoFor(verdicts, row.id));
      if (!update) continue;
      changed.push(row.name);
      if (apply) {
        const { error: upErr } = await supabase.from('grant_opportunities').update(update).eq('id', row.id);
        if (upErr) throw new Error(`enforce verdicts ${row.id}: ${upErr.message}`);
      }
    }
  }
  return changed;
}
