/**
 * Graph edge datasets — the single source of truth for how each relationship
 * dataset in `gs_relationships` is derived from source tables.
 *
 * Both consumers import this array so they can NEVER drift apart:
 *   - `build-entity-graph.mjs` runs `INSERT INTO gs_relationships <cols> <selectSql>`
 *     (column aliases below are ignored — INSERT maps by position).
 *   - `check-graph-completeness.mjs` runs `count(DISTINCT <key>)` over the SAME
 *     `selectSql` to compute the EXPECTED edge count, and compares to ACTUAL.
 *     The key-column aliases (source_entity_id / target_entity_id /
 *     relationship_type / source_record_id) are what let the check count
 *     distinct edge-keys without re-deriving the joins.
 *
 * The dedup key mirrors build-entity-graph's DEDUP_TARGET:
 *   (source_entity_id, target_entity_id, relationship_type, dataset, COALESCE(source_record_id,''))
 * Within one dataset, `dataset` is a constant literal, so the per-dataset
 * distinct key reduces to (source_entity_id, target_entity_id, relationship_type,
 * COALESCE(source_record_id,'')) — see EDGE_KEY_COLS below.
 *
 * If you change a join/filter here, the completeness check's "expected" moves with
 * it automatically — that is the whole point. Do not copy these SELECTs anywhere else.
 */

/** Dedup-key columns for a single dataset (dataset literal is constant within each). */
export const EDGE_KEY_COLS = "source_entity_id, target_entity_id, relationship_type, COALESCE(source_record_id, '')";

export const GRAPH_EDGE_DATASETS = [
  {
    dataset: 'aec_donations',
    relationshipType: 'donation',
    label: 'Donation relationships',
    sourceTable: 'political_donations',
    cols: '(source_entity_id, target_entity_id, relationship_type, amount, year, dataset, source_record_id, confidence, properties)',
    // prelude: materialise + index the donor name→ABN map so the join below is an index scan,
    // not a nested loop over an unindexed Materialize node (~4B ops → runaway).
    prelude: `CREATE TEMP TABLE donor_map AS
       SELECT DISTINCT ON (key) key, matched_abn FROM (
         SELECT upper(trim(donor_name)) AS key, matched_abn
           FROM donor_entity_matches WHERE matched_abn IS NOT NULL
         UNION ALL
         SELECT upper(trim(donor_name_normalized)), matched_abn
           FROM donor_entity_matches
           WHERE donor_name_normalized IS NOT NULL AND matched_abn IS NOT NULL
       ) z ORDER BY key;
     CREATE INDEX ON donor_map(key);
     ANALYZE donor_map;`,
    selectSql: `SELECT
       donor.id AS source_entity_id, party.id AS target_entity_id, 'donation' AS relationship_type, d.amount,
       NULLIF(split_part(d.financial_year, '-', 1), '')::int,
       'aec_donations', d.id::text AS source_record_id, 'registry',
       jsonb_build_object(
         'financial_year', d.financial_year,
         'return_type',    d.return_type,
         'receipt_type',   d.receipt_type,
         'donation_date',  d.donation_date)
     FROM political_donations d
     LEFT JOIN donor_map dm ON dm.key = upper(trim(d.donor_name))
     JOIN gs_entities donor
       ON donor.gs_id = 'AU-ABN-' || regexp_replace(coalesce(NULLIF(trim(d.donor_abn), ''), dm.matched_abn), '\\s', '', 'g')
     JOIN gs_entities party
       ON party.entity_type = 'political_party'
      AND upper(trim(party.canonical_name)) = upper(trim(d.donation_to))`,
  },
  {
    dataset: 'austender',
    relationshipType: 'contract',
    label: 'Contract relationships',
    sourceTable: 'austender_contracts',
    cols: '(source_entity_id, target_entity_id, relationship_type, amount, year, start_date, end_date, dataset, source_record_id, confidence, properties)',
    prelude: '',
    // buyer: AU-GOV-<buyer_id> (falls back to buyer_name, matching makeGsId({buyer_id: id||name})).
    // supplier: AU-ABN-<abn>. source_record_id mirrors `c.ocid || c.id` (every row has an ocid).
    // supplier_abn filtered to valid 11-digit ABNs (kept in sync with Phase 1e entity creation).
    selectSql: `SELECT
       buyer.id AS source_entity_id, supplier.id AS target_entity_id, 'contract' AS relationship_type, c.contract_value,
       coalesce(extract(year FROM c.contract_start)::int, extract(year FROM c.date_published)::int),
       c.contract_start, c.contract_end,
       'austender', coalesce(NULLIF(c.ocid, ''), c.id::text) AS source_record_id, 'registry',
       jsonb_build_object(
         'category',           c.category,
         'procurement_method', c.procurement_method,
         'buyer_name',         c.buyer_name,
         'supplier_name',      c.supplier_name)
     FROM austender_contracts c
     JOIN gs_entities buyer
       ON buyer.gs_id = 'AU-GOV-' || coalesce(NULLIF(c.buyer_id, ''), c.buyer_name)
     JOIN gs_entities supplier
       ON supplier.gs_id = 'AU-ABN-' || regexp_replace(c.supplier_abn, '\\s', '', 'g')
     WHERE c.supplier_abn IS NOT NULL
       AND regexp_replace(c.supplier_abn, '\\s', '', 'g') ~ '^[0-9]{11}$'`,
  },
  {
    dataset: 'grant_opportunities',
    relationshipType: 'grant',
    label: 'Grant relationships',
    sourceTable: 'grant_opportunities',
    cols: '(source_entity_id, target_entity_id, relationship_type, amount, dataset, source_record_id, confidence, properties)',
    prelude: '',
    // self-ref edge on the foundation entity (foundation offers grant); amount = max || min.
    selectSql: `SELECT
       f_ent.id AS source_entity_id, f_ent.id AS target_entity_id, 'grant' AS relationship_type, coalesce(g.amount_max, g.amount_min),
       'grant_opportunities', g.id::text AS source_record_id, 'registry',
       jsonb_build_object(
         'grant_name', g.name,
         'categories', array_to_string(g.categories, ', '),
         'closes_at',  g.closes_at,
         'provider',   g.provider)
     FROM grant_opportunities g
     JOIN foundations f
       ON f.id = g.foundation_id AND f.acnc_abn IS NOT NULL
     JOIN gs_entities f_ent
       ON f_ent.gs_id = 'AU-ABN-' || regexp_replace(f.acnc_abn, '\\s', '', 'g')
     WHERE g.foundation_id IS NOT NULL`,
  },
  {
    dataset: 'foundations',
    relationshipType: 'subsidiary_of',
    label: 'Cross-registry links',
    sourceTable: 'foundations',
    cols: '(source_entity_id, target_entity_id, relationship_type, dataset, source_record_id, confidence, properties)',
    prelude: '',
    // parent matched by exact (case-insensitive) canonical_name = parent_company, mirroring the
    // old nameIdMap.get(parent_company.toUpperCase()). DISTINCT ON keeps one parent per foundation
    // (the JS map held a single id per name) — deterministic by parent.id.
    selectSql: `SELECT DISTINCT ON (f.acnc_abn)
       parent.id AS source_entity_id, f_ent.id AS target_entity_id, 'subsidiary_of' AS relationship_type, 'foundations', f.acnc_abn AS source_record_id, 'reported',
       jsonb_build_object('parent_company', f.parent_company)
     FROM foundations f
     JOIN gs_entities f_ent
       ON f_ent.gs_id = 'AU-ABN-' || regexp_replace(f.acnc_abn, '\\s', '', 'g')
     JOIN gs_entities parent
       ON upper(parent.canonical_name) = upper(f.parent_company)
     WHERE f.parent_company IS NOT NULL AND f.acnc_abn IS NOT NULL
     ORDER BY f.acnc_abn, parent.id`,
  },
];

/** Look up one dataset definition by its `dataset` key; throws if unknown. */
export function edgeDataset(dataset) {
  const def = GRAPH_EDGE_DATASETS.find((d) => d.dataset === dataset);
  if (!def) throw new Error(`No graph edge dataset definition for '${dataset}'`);
  return def;
}
