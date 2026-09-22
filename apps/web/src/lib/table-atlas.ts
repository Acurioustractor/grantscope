import linkageBaseline from '../../../../data/linkage-baseline.json';

/**
 * The table atlas: for every public relation, how it links to the entity register.
 *
 * The rule is the CI guard's (scripts/check-table-linkage.mjs), not a second opinion:
 * table-atlas.test.ts fails if these patterns drift from the guard's. A table "names
 * organisations" when it has a column like funder_name; it is "linked" when it also has a
 * join key (abn, gs_entity_id, ...) or a foreign key to a table that does.
 */

// Same strings as ORG and KEY in scripts/check-table-linkage.mjs.
export const ORG_COLUMN =
  '^(organisation|organization|operating_organi[sz]ation|canonical_name|((recipient|supplier|buyer|donor|entity|org|organisation|organization|company|charity|funder|grantee|provider|grantor|agency|employer|contractor|applicant)_name))$';
export const KEY_COLUMN = '(^|_)(abn|acn|gs_id|gs_entity_id|entity_id|icn)$';

export type LinkStatus =
  | { kind: 'keyed'; keys: string[] }
  | { kind: 'via_fk'; via: string[] }
  | { kind: 'unlinked_accepted' }
  | { kind: 'unlinked_exempt'; reason: string }
  | { kind: 'unlinked_new' }
  | { kind: 'no_organisations' }
  | { kind: 'not_a_table' };

const baseline = linkageBaseline as { accepted: string[]; exempt: Record<string, string> };

export function linkStatus(t: {
  kind: string | null;
  key_columns: string[] | null;
  org_columns: string[] | null;
  fk_to_keyed: string[] | null;
  object: string;
}): LinkStatus {
  if (t.kind !== 'r' && t.kind !== 'p') return { kind: 'not_a_table' };
  if (t.key_columns?.length) return { kind: 'keyed', keys: t.key_columns };
  if (t.fk_to_keyed?.length) return { kind: 'via_fk', via: t.fk_to_keyed };
  if (!t.org_columns?.length) return { kind: 'no_organisations' };
  if (t.object in baseline.exempt) return { kind: 'unlinked_exempt', reason: baseline.exempt[t.object] };
  if (baseline.accepted.includes(t.object)) return { kind: 'unlinked_accepted' };
  return { kind: 'unlinked_new' };
}

export const LINK_LABEL: Record<LinkStatus['kind'], string> = {
  keyed: 'joins register',
  via_fk: 'joins via key',
  unlinked_accepted: 'gap, accepted',
  unlinked_exempt: 'gap, exempt',
  unlinked_new: 'GAP, NEW',
  no_organisations: 'no organisations',
  not_a_table: '',
};

/**
 * One row per object in schema_ownership. Row counts are pg_class.reltuples (the planner's
 * estimate, refreshed by ANALYZE): n_live_tup is unreliable on this project, and count(*) over
 * 1,024 relations would take minutes. -1 means never analysed.
 */
// Read from pg_catalog, not information_schema: the information_schema views check privileges
// row by row and took past exec_sql's ~8s limit over 1,024 relations.
export const ATLAS_SQL = `
  WITH rel AS (
    SELECT c.oid, c.relname, c.relkind, c.reltuples
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m')
  ), cols AS (
    SELECT r.relname, a.attname, a.atttypid
      FROM rel r JOIN pg_attribute a ON a.attrelid = r.oid AND a.attnum > 0 AND NOT a.attisdropped
  ), keyed AS (
    SELECT relname, array_agg(attname::text ORDER BY attname) AS key_columns
      FROM cols WHERE attname ~ '${KEY_COLUMN}' AND atttypid <> 'boolean'::regtype
     GROUP BY 1
  ), orgs AS (
    SELECT relname, array_agg(attname::text ORDER BY attname) AS org_columns
      FROM cols WHERE attname ~ '${ORG_COLUMN}'
     GROUP BY 1
  ), fks AS (
    SELECT DISTINCT src.relname AS src, dst.relname AS dst
      FROM pg_constraint k
      JOIN rel src ON src.oid = k.conrelid
      JOIN pg_class dst ON dst.oid = k.confrelid
     WHERE k.contype = 'f'
  ), fk_out AS (
    SELECT src, array_agg(dst::text ORDER BY dst) AS fk_out,
           array_agg(dst::text ORDER BY dst) FILTER (WHERE dst IN (SELECT relname FROM keyed)) AS fk_to_keyed
      FROM fks GROUP BY 1
  ), fk_in AS (
    SELECT dst, array_agg(src::text ORDER BY src) AS fk_in FROM fks GROUP BY 1
  )
  SELECT r.relname::text AS object, r.relkind AS kind, r.reltuples::bigint AS est_rows,
         k.key_columns, o.org_columns, fo.fk_out, fi.fk_in, fo.fk_to_keyed,
         EXISTS (SELECT 1 FROM schema_ownership s WHERE s.object = r.relname) AS registered
    FROM rel r
    LEFT JOIN keyed k ON k.relname = r.relname
    LEFT JOIN orgs o ON o.relname = r.relname
    LEFT JOIN fk_out fo ON fo.src = r.relname
    LEFT JOIN fk_in fi ON fi.dst = r.relname`;

export type AtlasRow = {
  object: string;
  kind: string | null;
  est_rows: number | null;
  key_columns: string[] | null;
  org_columns: string[] | null;
  fk_out: string[] | null;
  fk_in: string[] | null;
  fk_to_keyed: string[] | null;
  registered: boolean;
};

export function fmtRows(n: number | null): string {
  if (n == null || n < 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
