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
  {
    dataset: 'justice_funding',
    relationshipType: 'grant',
    label: 'Justice funding relationships',
    sourceTable: 'justice_funding',
    cols: '(source_entity_id, target_entity_id, relationship_type, amount, year, dataset, source_record_id, properties)',
    // The program ENTITY layer (gs_entities entity_type='program') is created/refreshed by
    // JUSTICE_PROGRAM_ENSURE_SQL (below), run by build-entity-graph's justice phase and the bridge
    // BEFORE the edge insert. It is deliberately NOT in this prelude, so the completeness gate
    // (which executes preludes to compute "expected") stays strictly read-only.
    //
    // Why prog_map + the build-side guard: the program layer accreted two gs_id formats
    // (old GS-PROG-<slug60>-<state>, new GS-PROG-<slug80>-<md5x4>-<state>) plus slug collisions,
    // so the ~56K pre-existing edges are split across nodes with NO single clean (name,state)→node
    // mapping. prog_map collapses each program to ONE node (preferring the node that already carries
    // justice edges, then old/hash-less format, then lowest id) so newly built edges stay coherent.
    // The completeness gate measures this FULL derivation; the WRITE additionally appends
    // JUSTICE_BUILD_GUARD so it only touches payments with no edge yet — making re-runs idempotent
    // and adding ZERO duplicates regardless of which node a payment's prior edge happens to sit on.
    prelude: `CREATE TEMP TABLE jf_prog_map AS
       SELECT DISTINCT ON (canonical_name, norm_state) canonical_name, norm_state, id AS prog_id
         FROM (
           SELECT e.id, e.canonical_name,
                  coalesce(NULLIF(trim(e.state),''),'NAT') AS norm_state,
                  (e.gs_id ~ '-[0-9a-f]{4}-[a-z]{2,3}$') AS new_fmt,
                  EXISTS (SELECT 1 FROM gs_relationships r
                           WHERE r.source_entity_id = e.id
                             AND r.dataset='justice_funding' AND r.relationship_type='grant') AS has_edges
             FROM gs_entities e WHERE e.entity_type='program'
         ) z
        ORDER BY canonical_name, norm_state, has_edges DESC, new_fmt ASC, id ASC;
       CREATE INDEX ON jf_prog_map(canonical_name, norm_state);
       ANALYZE jf_prog_map;`,
    // source = canonical program node (prog_map); target = recipient matched by exact ABN.
    // year mirrors parseInt(financial_year): leading digits of e.g. '2016-17' / '2016-ongoing'.
    selectSql: `SELECT
       pm.prog_id AS source_entity_id, rec.id AS target_entity_id, 'grant' AS relationship_type,
       jf.amount_dollars,
       NULLIF(substring(jf.financial_year from '^[0-9]+'),'')::int,
       'justice_funding', jf.id::text AS source_record_id,
       jsonb_build_object('program', jf.program_name, 'state', jf.state, 'recipient', jf.recipient_name)
     FROM justice_funding jf
     JOIN gs_entities rec ON rec.abn = jf.recipient_abn
     JOIN jf_prog_map pm ON pm.canonical_name = jf.program_name
                        AND pm.norm_state    = coalesce(NULLIF(trim(jf.state),''),'NAT')
     WHERE jf.recipient_abn IS NOT NULL AND jf.amount_dollars > 0`,
  },
];

/**
 * Additive write-guard for the justice build: only emit edges for payments that have NO existing
 * justice edge. Because the historical program-node layer is split across two gs_id formats, a
 * payment's prior edge may sit on a different node than prog_map now picks; this guard ensures the
 * write never creates a second (duplicate) edge for an already-edged payment — so re-runs add zero
 * duplicates and are fully idempotent. The completeness gate measures the bare `selectSql` (the full
 * derivation); ONLY the WRITE path appends this guard, right before `ON CONFLICT … DO NOTHING`.
 */
export const JUSTICE_BUILD_GUARD = `
     AND NOT EXISTS (SELECT 1 FROM gs_relationships y
                      WHERE y.dataset='justice_funding' AND y.relationship_type='grant'
                        AND COALESCE(y.source_record_id,'') = jf.id::text)`;

/**
 * Ensure a program entity exists for every justice (program_name, state) that has none yet.
 * Brand-new nodes get the collision-resistant new format (slug80 + md5[:4] + state, mirroring
 * programGsId() in bridge-justice-to-graph.mjs); any existing node (either format) is reused via
 * the NOT EXISTS guard. Idempotent (ON CONFLICT (gs_id) DO NOTHING). Run BEFORE the justice edge
 * insert — NOT from the dataset prelude (keeps the gate read-only).
 */
export const JUSTICE_PROGRAM_ENSURE_SQL = `
  INSERT INTO gs_entities (gs_id, canonical_name, entity_type, sector, state, confidence)
  SELECT DISTINCT
    'GS-PROG-'
      || left(regexp_replace(regexp_replace(lower(jf.program_name),'[^a-z0-9]+','-','g'),'(^-|-$)','','g'),80)
      || '-' || left(md5(jf.program_name),4)
      || '-' || lower(coalesce(NULLIF(trim(jf.state),''),'NAT')),
    jf.program_name, 'program', 'government', NULLIF(trim(jf.state),''), 'inferred'
  FROM justice_funding jf
  WHERE jf.recipient_abn IS NOT NULL AND jf.amount_dollars > 0
    AND NOT EXISTS (
      SELECT 1 FROM gs_entities e
       WHERE e.entity_type='program'
         AND e.canonical_name = jf.program_name
         AND coalesce(NULLIF(trim(e.state),''),'NAT') = coalesce(NULLIF(trim(jf.state),''),'NAT'))
  ON CONFLICT (gs_id) DO NOTHING;`;

/** Look up one dataset definition by its `dataset` key; throws if unknown. */
export function edgeDataset(dataset) {
  const def = GRAPH_EDGE_DATASETS.find((d) => d.dataset === dataset);
  if (!def) throw new Error(`No graph edge dataset definition for '${dataset}'`);
  return def;
}
