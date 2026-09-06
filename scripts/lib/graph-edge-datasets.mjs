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
    // TWO types out of one source, split on receipt_type. See the CASE in selectSql below.
    // `relationshipType` stays for the reporting label; `relationshipTypes` is what the
    // completeness gate counts, or it would expect every row and find only the donations.
    relationshipType: 'donation',
    relationshipTypes: ['donation', 'party_receipt'],
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
       donor.id AS source_entity_id, party.id AS target_entity_id,
       -- relationship_type = 'donation' is a CLAIM about a row, and until 2026-08-20 this
       -- builder made it about every row of political_donations. Measured on the edges:
       --
       --   other receipt        797,404 edges   108.62 bn   <- fundraising income, transfers, levies
       --   donation received    184,078 edges    17.32 bn   <- the actual donations
       --   (null)               103,887 edges     6.85 bn
       --   subscription          17,813 edges     1.20 bn
       --   unspecified           27,237 edges     0.94 bn
       --   public funding         1,435 edges     0.35 bn
       --
       -- 87% of the dollars were not donations, and /reports/donor-contractors published the
       -- inflated total as "they donated 31.3 bn to 1073 political parties".
       --
       -- The fix is NOT a WHERE clause. Filtering here would delete 950K rows of real, useful
       -- data — party fundraising income is how parties are funded, and worth being able to ask
       -- about. It is also not a filter at each read site: seven matviews read this type, and
       -- asking every future consumer to remember properties->>'receipt_type' is precisely how
       -- the justice_funding filters came to be missing from 98 of 100 files.
       --
       -- So the rows stay and the LABEL stops lying. Everything that already filters
       -- relationship_type = 'donation' becomes correct with no change to it.
       CASE WHEN d.receipt_type = 'donation received' THEN 'donation'
            ELSE 'party_receipt' END AS relationship_type, d.amount,
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
       -- GUARD ADDED 2026-08-14. donor_entity_matches holds 771 rows (of 10,264) whose matched_abn
       -- is '0'. Without this, all 771 distinct donors collapse onto the single gs_entities row
       -- that carries abn='0' ("112 Trenerry Crescent Pty Ltd"), producing 53,148 donation edges
       -- attributed to one company. NULLIF on an all-zero ABN makes the coalesce fall through to
       -- NULL, so those donations produce NO edge rather than a confidently wrong one.
       ON donor.gs_id = 'AU-ABN-' || NULLIF(
            regexp_replace(coalesce(NULLIF(trim(d.donor_abn), ''), dm.matched_abn), '\\s', '', 'g'),
            repeat('0', length(regexp_replace(coalesce(NULLIF(trim(d.donor_abn), ''), dm.matched_abn), '\\s', '', 'g'))))
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
    // BUYER RESOLUTION MIRRORS THE ENTITY PHASE (govGsId in build-entity-graph.mjs), not just the gs_id.
    // The 2026-08-21 gov-entity merge folded 151 AU-GOV-<buyer_id> entities into their ABN-keyed
    // winners and deleted the losers. The entity phase already resolves a buyer by name against the
    // surviving government identities; this join used to resolve by gs_id alone, so every contract
    // from a merged buyer (216,822 of them, Home Affairs, the AFP, Finance...) fell out of the
    // derivation. Measured 2026-09-06: 147,608 existing edges looked "stale" because the recipe could
    // no longer produce them, and 377 contracts published since the merge had no edge at all.
    // Resolution order, per distinct buyer key, identical to govGsId in the entity phase:
    //   1. exact gs_id AU-GOV-<key>;
    //   2. the ONE government entity with that name;
    //   3. (2026-09-06, "link then mint") the ONE non-person entity of any type with that name, so a
    //      state buyer that already exists under an ABN (universities, TAFE NSW, NSW Police) links to
    //      that node instead of getting a second one.
    // An ambiguous name (two entities) resolves to nothing at rungs 2 and 3, as in the entity phase.
    prelude: `CREATE TEMP TABLE austender_buyer_map AS
      WITH keys AS (
        SELECT DISTINCT coalesce(NULLIF(buyer_id, ''), buyer_name) AS key, lower(trim(buyer_name)) AS name_key
        FROM austender_contracts WHERE buyer_name IS NOT NULL OR buyer_id IS NOT NULL),
      gov_by_name AS (
        SELECT lower(trim(canonical_name)) AS name_key, (array_agg(id))[1] AS entity_id, count(*) AS n
        FROM gs_entities WHERE entity_type = 'government_body' OR gs_id LIKE 'AU-GOV-%'
        GROUP BY 1),
      any_by_name AS (
        SELECT lower(trim(canonical_name)) AS name_key, (array_agg(id))[1] AS entity_id, count(*) AS n
        FROM gs_entities
        WHERE entity_type NOT IN ('person', 'political_party')
          AND lower(trim(canonical_name)) IN (SELECT name_key FROM keys)
        GROUP BY 1)
      SELECT k.key, coalesce(g.id,
                             CASE WHEN n.n = 1 THEN n.entity_id END,
                             CASE WHEN a.n = 1 THEN a.entity_id END) AS entity_id
      FROM keys k
      LEFT JOIN gs_entities g ON g.gs_id = 'AU-GOV-' || k.key
      LEFT JOIN gov_by_name n ON n.name_key = k.name_key
      LEFT JOIN any_by_name a ON a.name_key = k.name_key;
      DELETE FROM austender_buyer_map WHERE entity_id IS NULL;
      CREATE INDEX ON austender_buyer_map (key);
      ANALYZE austender_buyer_map;`,
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
     JOIN austender_buyer_map bm
       ON bm.key = coalesce(NULLIF(c.buyer_id, ''), c.buyer_name)
     JOIN gs_entities buyer
       ON buyer.id = bm.entity_id
     JOIN gs_entities supplier
       ON supplier.gs_id = 'AU-ABN-' || regexp_replace(c.supplier_abn, '\\s', '', 'g')
     WHERE c.supplier_abn IS NOT NULL
       AND regexp_replace(c.supplier_abn, '\\s', '', 'g') ~ '^[0-9]{11}$'`,
  },
  // `grant_opportunities` was RETIRED as an edge dataset on 2026-09-06. Its only derivation was a
  // self-loop (foundation -> itself, one per program), which the 2026-08-20 self-loop migration
  // deleted (6,229 rows) and now forbids via gs_relationships_no_judged_selfloops. Left in place, the
  // build phase could only violate that constraint and the completeness gate counted 5,468 forbidden
  // edges as "missing". A program is not a counterparty; it needs its own node before it can be an edge.
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
    dataset: 'grantconnect_awards',
    relationshipType: 'grant',
    label: 'Commonwealth grant awards (GrantConnect)',
    sourceTable: 'grantconnect_awards',
    cols: '(source_entity_id, target_entity_id, relationship_type, amount, year, start_date, end_date, dataset, source_record_id, confidence, properties)',
    // ADDED 2026-08-14. grantconnect_awards held 291,264 rows and ZERO edges — the largest
    // awarded-grants source in the database was absent from the relationship layer entirely.
    // Not stale: never built.
    //
    // MEASURED BEFORE WRITING (2026-08-14), because three diagnoses this week were wrong from
    // guessing at a join instead of measuring it:
    //   291,264 awards · 210,761 (72.4%) carry gs_entity_id · 100% carry value_aud and a date
    //   44 distinct agencies, 38 match a gs_entities canonical_name (86%)
    //   -> 189,590 awards (65.1%) satisfy BOTH sides and will produce an edge
    //
    // WHY agency_map: of the 38 matching agency names, 15 match MORE THAN ONE gs_entities row
    // (worst case 4). gs_entities carries 41 duplicate-name groups among government_body alone.
    // Joining agency->name directly would multiply those awards by up to 4x — the exact edge
    // blowup this graph has been wrongly accused of before. DISTINCT ON collapses each agency to
    // ONE node, preferring a row that carries an ABN, then a government_body, then lowest id.
    prelude: `CREATE TEMP TABLE gc_agency_map AS
       SELECT DISTINCT ON (agency_key) agency_key, ent_id
         FROM (
           SELECT upper(trim(a.agency)) AS agency_key, e.id AS ent_id,
                  (e.abn IS NOT NULL) AS has_abn,
                  (e.entity_type = 'government_body') AS is_gov
             FROM (SELECT DISTINCT agency FROM grantconnect_awards WHERE agency IS NOT NULL) a
             JOIN gs_entities e ON upper(trim(e.canonical_name)) = upper(trim(a.agency))
         ) z
        ORDER BY agency_key, is_gov DESC, has_abn DESC, ent_id ASC;
       CREATE INDEX ON gc_agency_map(agency_key);
       ANALYZE gc_agency_map;`,
    // source = funding agency (collapsed via gc_agency_map); target = recipient via the
    // gs_entity_id already stamped on the award. Using the stamp rather than re-matching the ABN
    // keeps this consistent with whatever linkage pass produced it.
    // source_record_id = ga_id, the GrantConnect natural key, so an edge resolves back to its award.
    selectSql: `SELECT
       m.ent_id AS source_entity_id, g.gs_entity_id AS target_entity_id, 'grant' AS relationship_type,
       g.value_aud AS amount,
       extract(year FROM coalesce(g.approval_date, g.start_date))::int AS year,
       g.start_date, g.end_date,
       'grantconnect_awards', g.ga_id AS source_record_id, 'registry',
       jsonb_build_object(
         'agency',         g.agency,
         'category',       g.category,
         'grant_program',  g.grant_program,
         'recipient_name', g.recipient_name,
         'delivery_state', g.delivery_state,
         'purpose',        left(g.purpose, 500))
     FROM grantconnect_awards g
     JOIN gc_agency_map m ON m.agency_key = upper(trim(g.agency))
     WHERE g.gs_entity_id IS NOT NULL AND g.agency IS NOT NULL`,
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
