#!/usr/bin/env node
/**
 * fix-goods-coverage.mjs
 *
 * Repairs core Goods data gaps:
 * 1) Reclassify buyer_role where role is null/other
 * 2) Fill known_buyer_name from best local buyer candidate
 * 3) Backfill NT region/postcode metadata from nt_communities
 * 4) Recompute buyer/service counts per community from procurement entities
 *
 * Run:
 *   node --env-file=.env scripts/fix-goods-coverage.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function sql(query) {
  const trimmed = query.trim();
  const isDdlOrDml =
    /^\s*(insert|update|delete|alter|create|drop|refresh|truncate|grant|revoke)\b/i.test(trimmed) ||
    /^\s*with\b[\s\S]*\b(update|insert|delete)\b/i.test(trimmed);

  if (isDdlOrDml) {
    const dbPassword = process.env.DATABASE_PASSWORD;
    if (!dbPassword) {
      throw new Error('DATABASE_PASSWORD is not set.');
    }
    const escaped = query.replace(/"/g, '\\"');
    execSync(
      `psql -h aws-0-ap-southeast-2.pooler.supabase.com -p 5432 -U "postgres.tednluwflfhxyucgwigh" -d postgres -c "${escaped}"`,
      {
        env: { ...process.env, PGPASSWORD: dbPassword },
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 120000,
      },
    );
    return [];
  }

  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(`SQL error: ${error.message}`);
  return data || [];
}

async function metricSnapshot() {
  const [community] = await sql(`
    SELECT
      COUNT(*)::int as communities_total,
      COUNT(*) FILTER (WHERE state = 'NT')::int as nt_total,
      COUNT(*) FILTER (WHERE known_buyer_name IS NOT NULL AND TRIM(known_buyer_name) <> '')::int as known_buyer_filled,
      COUNT(*) FILTER (WHERE postcode IS NOT NULL AND TRIM(postcode) <> '')::int as postcode_filled
    FROM goods_communities
  `);

  const roles = await sql(`
    SELECT buyer_role, COUNT(*)::int as count
    FROM goods_procurement_entities
    GROUP BY buyer_role
    ORDER BY count DESC
    LIMIT 8
  `);

  const [coverage] = await sql(`
    SELECT
      COUNT(*)::int as nt_communities,
      COUNT(*) FILTER (WHERE buyer_match_count = 0)::int as nt_zero_buyer_match,
      COUNT(*) FILTER (WHERE needs_postcode_enrichment)::int as nt_postcode_enrichment
    FROM v_nt_community_procurement_summary
  `);

  const [goodsNt] = await sql(`
    WITH nt_buyers AS (
      SELECT DISTINCT community_id
      FROM goods_procurement_entities
      WHERE community_id IS NOT NULL AND COALESCE(buyer_role, 'other') <> 'other'
    )
    SELECT
      COUNT(*)::int as nt_goods_communities,
      COUNT(*) FILTER (WHERE gc.postcode IS NULL OR TRIM(gc.postcode) = '')::int as nt_goods_missing_postcode,
      COUNT(*) FILTER (WHERE gc.known_buyer_name IS NOT NULL AND TRIM(gc.known_buyer_name) <> '')::int as nt_goods_known_buyer,
      COUNT(*) FILTER (WHERE nb.community_id IS NOT NULL)::int as nt_goods_with_buyer_rows
    FROM goods_communities gc
    LEFT JOIN nt_buyers nb ON nb.community_id = gc.id
    WHERE gc.state = 'NT'
  `);

  return { community, roles, coverage, goodsNt };
}

async function main() {
  console.log('=== Fix Goods Coverage ===\n');

  const before = await metricSnapshot();
  console.log('Before snapshot:');
  console.table([before.community, before.coverage, before.goodsNt]);
  console.table(before.roles);

  console.log('\n1) Reclassifying buyer roles...');
  await sql(`
    UPDATE goods_procurement_entities
    SET buyer_role = CASE
      WHEN entity_type = 'charity' THEN 'community_org'
      WHEN entity_type = 'company' AND LOWER(COALESCE(entity_name, '')) ~ '(aboriginal|community|enterprise|co-?operative)' THEN 'community_org'
      WHEN LOWER(COALESCE(entity_name, '')) ~ '(outback stores|alpa|arnhem land progress|store|supermarket|retail|trading)' THEN 'store'
      WHEN LOWER(COALESCE(entity_name, '')) ~ '(housing|tenancy|homeless|shelter|community housing|build)' THEN 'housing_provider'
      WHEN LOWER(COALESCE(entity_name, '')) ~ '(health|medical|clinic|hospital|accho|aboriginal medical|primary health|wellbeing)' THEN 'health_service'
      WHEN LOWER(COALESCE(entity_name, '')) ~ '(shire|council|regional council|city of)' THEN 'council'
      WHEN LOWER(COALESCE(entity_name, '')) ~ '(land council)' THEN 'land_council'
      WHEN LOWER(COALESCE(entity_name, '')) ~ '(school|education|college|training)' THEN 'education'
      WHEN LOWER(COALESCE(entity_name, '')) ~ '(disability|ndis|support services?)' THEN 'disability_service'
      WHEN is_community_controlled THEN 'community_org'
      ELSE buyer_role
    END,
    updated_at = NOW()
    WHERE buyer_role IS NULL OR buyer_role = 'other'
  `);

  console.log('4b) Backfilling Goods postcodes from nearest geo match...');
  await sql(`
    WITH nearest_geo AS (
      SELECT
        gc.id AS community_id,
        pg.postcode,
        pg.lga_name,
        ROW_NUMBER() OVER (
          PARTITION BY gc.id
          ORDER BY
            (
              POWER((gc.latitude::numeric - pg.latitude::numeric), 2)
              + POWER((gc.longitude::numeric - pg.longitude::numeric), 2)
            ) ASC,
            pg.postcode ASC
        ) AS rn
      FROM goods_communities gc
      JOIN postcode_geo pg
        ON pg.state = gc.state
       AND pg.latitude IS NOT NULL
       AND pg.longitude IS NOT NULL
      WHERE
        (gc.postcode IS NULL OR TRIM(gc.postcode) = '')
        AND gc.latitude IS NOT NULL
        AND gc.longitude IS NOT NULL
        AND gc.state IN ('NT', 'QLD')
    )
    UPDATE goods_communities gc
    SET
      postcode = ng.postcode,
      lga_name = COALESCE(NULLIF(gc.lga_name, ''), ng.lga_name),
      updated_at = NOW()
    FROM nearest_geo ng
    WHERE gc.id = ng.community_id
      AND ng.rn = 1
      AND (gc.postcode IS NULL OR TRIM(gc.postcode) = '')
  `);

  console.log('2) Backfilling known_buyer_name...');
  await sql(`
    WITH top_buyer AS (
      SELECT
        community_id,
        entity_name,
        ROW_NUMBER() OVER (
          PARTITION BY community_id
          ORDER BY
            COALESCE(fit_score, 0) DESC,
            COALESCE(govt_contract_value, 0) DESC,
            COALESCE(govt_contract_count, 0) DESC,
            updated_at DESC
        ) as rn
      FROM goods_procurement_entities
      WHERE
        community_id IS NOT NULL
        AND entity_name IS NOT NULL
        AND TRIM(entity_name) <> ''
        AND COALESCE(buyer_role, 'other') <> 'other'
    )
    UPDATE goods_communities gc
    SET
      known_buyer_name = tb.entity_name,
      updated_at = NOW()
    FROM top_buyer tb
    WHERE
      gc.id = tb.community_id
      AND tb.rn = 1
      AND (gc.known_buyer_name IS NULL OR TRIM(gc.known_buyer_name) = '')
  `);

  console.log('3) Backfilling NT postcodes from postcode_geo...');
  await sql(`
    WITH pg_best AS (
      SELECT DISTINCT ON (norm_name)
        norm_name,
        postcode
      FROM (
        SELECT
          regexp_replace(replace(lower(trim(locality)), 'mt ', 'mount '), '[^a-z0-9]+', '', 'g') AS norm_name,
          postcode
        FROM postcode_geo
        WHERE state = 'NT' AND locality IS NOT NULL AND postcode IS NOT NULL AND TRIM(postcode) <> ''
      ) p
      ORDER BY norm_name, postcode
    )
    UPDATE nt_communities nc
    SET
      postcode = pg.postcode,
      updated_at = NOW()
    FROM pg_best pg
    WHERE
      (nc.postcode IS NULL OR TRIM(nc.postcode) = '')
      AND regexp_replace(replace(lower(trim(nc.community_name)), 'mt ', 'mount '), '[^a-z0-9]+', '', 'g') = pg.norm_name
  `);

  console.log('4) Backfilling NT metadata into Goods communities...');
  await sql(`
    WITH norm_goods AS (
      SELECT
        id,
        regexp_replace(replace(lower(trim(community_name)), 'mt ', 'mount '), '[^a-z0-9]+', '', 'g') AS norm_name
      FROM goods_communities
      WHERE state = 'NT'
    ),
    norm_nt AS (
      SELECT
        community_name,
        region_label,
        service_region,
        land_council,
        postcode,
        proof_line,
        regexp_replace(replace(lower(trim(community_name)), 'mt ', 'mount '), '[^a-z0-9]+', '', 'g') AS norm_name
      FROM nt_communities
    )
    UPDATE goods_communities gc
    SET
      region_label = COALESCE(NULLIF(gc.region_label, ''), nn.region_label),
      service_region = COALESCE(NULLIF(gc.service_region, ''), nn.service_region),
      land_council = COALESCE(NULLIF(gc.land_council, ''), nn.land_council),
      postcode = COALESCE(NULLIF(gc.postcode, ''), nn.postcode),
      proof_line = COALESCE(NULLIF(gc.proof_line, ''), nn.proof_line),
      updated_at = NOW()
    FROM norm_goods ng
    JOIN norm_nt nn ON nn.norm_name = ng.norm_name
    WHERE
      gc.id = ng.id
      AND (
        gc.region_label IS NULL OR TRIM(gc.region_label) = ''
        OR gc.service_region IS NULL OR TRIM(gc.service_region) = ''
        OR gc.land_council IS NULL OR TRIM(gc.land_council) = ''
        OR gc.postcode IS NULL OR TRIM(gc.postcode) = ''
      )
  `);

  console.log('5) Recomputing buyer/service counts per community...');
  await sql(`
    WITH agg AS (
      SELECT
        community_id,
        COUNT(*)::int as buyer_entity_count,
        COUNT(*) FILTER (WHERE buyer_role = 'store')::int as store_count,
        COUNT(*) FILTER (WHERE buyer_role = 'health_service')::int as health_service_count,
        COUNT(*) FILTER (WHERE buyer_role = 'housing_provider')::int as housing_org_count,
        COUNT(*) FILTER (WHERE buyer_role = 'council')::int as council_count
      FROM goods_procurement_entities
      WHERE community_id IS NOT NULL
      GROUP BY community_id
    )
    UPDATE goods_communities gc
    SET
      buyer_entity_count = agg.buyer_entity_count,
      store_count = agg.store_count,
      health_service_count = agg.health_service_count,
      housing_org_count = agg.housing_org_count,
      council_count = agg.council_count,
      updated_at = NOW()
    FROM agg
    WHERE gc.id = agg.community_id
  `);

  console.log('6) Backfilling NT buyers from crosswalk + anchor inference...');
  await sql(`
    WITH norm_goods AS (
      SELECT
        gc.id AS goods_community_id,
        gc.community_name,
        regexp_replace(replace(lower(trim(gc.community_name)), 'mt ', 'mount '), '[^a-z0-9]+', '', 'g') AS norm_name
      FROM goods_communities gc
      WHERE gc.state = 'NT'
    ),
    crosswalk AS (
      SELECT
        ng.goods_community_id AS community_id,
        x.entity_id,
        x.gs_id,
        x.buyer_name AS entity_name,
        NULLIF(x.abn, '') AS abn,
        x.entity_type,
        CASE x.buyer_type
          WHEN 'store' THEN 'store'
          WHEN 'health' THEN 'health_service'
          WHEN 'housing' THEN 'housing_provider'
          WHEN 'council' THEN 'council'
          ELSE CASE WHEN x.is_community_controlled THEN 'community_org' ELSE 'other' END
        END AS buyer_role,
        x.is_community_controlled,
        x.website,
        (55 + COALESCE(x.match_score, 0))::numeric AS fit_score,
        CASE x.buyer_type
          WHEN 'store' THEN ARRAY['bed', 'mattress', 'washer', 'fridge']::text[]
          WHEN 'health' THEN ARRAY['bed', 'mattress']::text[]
          WHEN 'housing' THEN ARRAY['bed', 'mattress', 'washer', 'fridge']::text[]
          WHEN 'council' THEN ARRAY['bed', 'washer', 'fridge']::text[]
          ELSE ARRAY['bed', 'mattress']::text[]
        END AS product_fit,
        COALESCE(ac.contract_count, 0) AS govt_contract_count,
        COALESCE(ac.contract_value, 0)::numeric AS govt_contract_value,
        'unknown'::text AS procurement_method,
        'prospect'::text AS relationship_status,
        'Review match evidence and open intro pathway.'::text AS next_action
      FROM v_nt_community_buyer_crosswalk x
      JOIN norm_goods ng
        ON regexp_replace(replace(lower(trim(x.community_name)), 'mt ', 'mount '), '[^a-z0-9]+', '', 'g') = ng.norm_name
      LEFT JOIN (
        SELECT
          supplier_abn AS abn,
          COUNT(*)::int AS contract_count,
          SUM(COALESCE(contract_value, 0))::numeric AS contract_value
        FROM austender_contracts
        WHERE supplier_abn IS NOT NULL AND TRIM(supplier_abn) <> ''
        GROUP BY supplier_abn
      ) ac ON ac.abn = NULLIF(x.abn, '')
    )
    INSERT INTO goods_procurement_entities (
      community_id, entity_id, gs_id, entity_name, abn, entity_type, buyer_role,
      procurement_method, relationship_status, product_fit, fit_score, next_action,
      govt_contract_count, govt_contract_value, is_community_controlled, website
    )
    SELECT
      c.community_id, c.entity_id, c.gs_id, c.entity_name, c.abn, c.entity_type, c.buyer_role,
      c.procurement_method, c.relationship_status, c.product_fit, c.fit_score, c.next_action,
      c.govt_contract_count, c.govt_contract_value, c.is_community_controlled, c.website
    FROM crosswalk c
    WHERE NOT EXISTS (
      SELECT 1
      FROM goods_procurement_entities gpe
      WHERE gpe.community_id = c.community_id
        AND (
          (c.gs_id IS NOT NULL AND gpe.gs_id = c.gs_id)
          OR (c.abn IS NOT NULL AND gpe.abn = c.abn)
          OR (LOWER(COALESCE(gpe.entity_name, '')) = LOWER(COALESCE(c.entity_name, '')))
        )
    )
  `);

  await sql(`
    WITH uncovered AS (
      SELECT gc.id AS community_id, gc.community_name, gc.region_label, gc.service_region, gc.land_council
      FROM goods_communities gc
      WHERE gc.state = 'NT'
        AND NOT EXISTS (
          SELECT 1
          FROM goods_procurement_entities g
          WHERE g.community_id = gc.id
            AND COALESCE(g.buyer_role, 'other') <> 'other'
        )
    ),
    contract_rollup AS (
      SELECT
        supplier_abn AS abn,
        COUNT(*)::int AS contract_count,
        SUM(COALESCE(contract_value, 0))::numeric AS contract_value
      FROM austender_contracts
      WHERE supplier_abn IS NOT NULL AND TRIM(supplier_abn) <> ''
      GROUP BY supplier_abn
    ),
    anchor_candidates AS (
      SELECT
        e.id AS entity_id,
        e.gs_id,
        e.canonical_name AS entity_name,
        e.abn,
        e.entity_type,
        e.website,
        e.is_community_controlled,
        CASE
          WHEN e.canonical_name ~* '(outback stores|store|supermarket|alpa|arnhem land progress|progress association)' THEN 'store'
          WHEN e.canonical_name ~* '(health|medical|clinic|health board|health service)' THEN 'health_service'
          WHEN e.canonical_name ~* '(housing)' THEN 'housing_provider'
          WHEN e.canonical_name ~* '(council|regional council|shire)' THEN 'council'
          WHEN e.canonical_name ~* '(land council)' THEN 'land_council'
          ELSE CASE WHEN e.is_community_controlled THEN 'community_org' ELSE 'other' END
        END AS buyer_role,
        COALESCE(cr.contract_count, 0) AS contract_count,
        COALESCE(cr.contract_value, 0)::numeric AS contract_value
      FROM gs_entities e
      LEFT JOIN contract_rollup cr ON cr.abn = e.abn
      WHERE e.state = 'NT'
        AND (
          e.canonical_name ~* '(outback stores|alpa|arnhem land progress|store|supermarket|housing|health|medical|clinic|council|shire|land council|regional council)'
          OR COALESCE(cr.contract_count, 0) > 0
        )
    ),
    ranked AS (
      SELECT
        u.community_id,
        a.entity_id,
        a.gs_id,
        a.entity_name,
        a.abn,
        a.entity_type,
        a.buyer_role,
        a.website,
        a.is_community_controlled,
        a.contract_count,
        a.contract_value,
        (
          CASE
            WHEN u.land_council IS NOT NULL AND u.land_council <> '' AND a.entity_name ILIKE ('%' || split_part(u.land_council, ' ', 1) || '%') THEN 40
            WHEN u.region_label IS NOT NULL AND u.region_label <> '' AND a.entity_name ILIKE ('%' || split_part(u.region_label, ' ', 1) || '%') THEN 28
            WHEN u.service_region IS NOT NULL AND u.service_region <> '' AND a.entity_name ILIKE ('%' || split_part(u.service_region, ' ', 1) || '%') THEN 24
            WHEN a.entity_name ~* '(outback stores|alpa|arnhem land progress)' THEN 22
            ELSE 0
          END
          + CASE
              WHEN a.buyer_role IN ('store', 'housing_provider', 'health_service', 'council', 'land_council') THEN 14
              ELSE 0
            END
          + CASE WHEN a.contract_value > 0 THEN 12 ELSE 0 END
          + CASE WHEN a.is_community_controlled THEN 8 ELSE 0 END
        )::numeric AS fit_score,
        ROW_NUMBER() OVER (
          PARTITION BY u.community_id
          ORDER BY
            (
              CASE
                WHEN u.land_council IS NOT NULL AND u.land_council <> '' AND a.entity_name ILIKE ('%' || split_part(u.land_council, ' ', 1) || '%') THEN 40
                WHEN u.region_label IS NOT NULL AND u.region_label <> '' AND a.entity_name ILIKE ('%' || split_part(u.region_label, ' ', 1) || '%') THEN 28
                WHEN u.service_region IS NOT NULL AND u.service_region <> '' AND a.entity_name ILIKE ('%' || split_part(u.service_region, ' ', 1) || '%') THEN 24
                WHEN a.entity_name ~* '(outback stores|alpa|arnhem land progress)' THEN 22
                ELSE 0
              END
              + CASE
                  WHEN a.buyer_role IN ('store', 'housing_provider', 'health_service', 'council', 'land_council') THEN 14
                  ELSE 0
                END
              + CASE WHEN a.contract_value > 0 THEN 12 ELSE 0 END
              + CASE WHEN a.is_community_controlled THEN 8 ELSE 0 END
            ) DESC,
            a.contract_value DESC,
            a.contract_count DESC,
            a.entity_name ASC
        ) AS rn
      FROM uncovered u
      CROSS JOIN anchor_candidates a
      WHERE a.buyer_role <> 'other'
    )
    INSERT INTO goods_procurement_entities (
      community_id, entity_id, gs_id, entity_name, abn, entity_type, buyer_role,
      procurement_method, relationship_status, product_fit, fit_score, next_action,
      govt_contract_count, govt_contract_value, is_community_controlled, website
    )
    SELECT
      r.community_id,
      r.entity_id,
      r.gs_id,
      r.entity_name,
      r.abn,
      r.entity_type,
      r.buyer_role,
      'unknown'::text AS procurement_method,
      'prospect'::text AS relationship_status,
      CASE
        WHEN r.buyer_role = 'store' THEN ARRAY['bed', 'mattress', 'washer', 'fridge']::text[]
        WHEN r.buyer_role IN ('housing_provider', 'council', 'land_council') THEN ARRAY['bed', 'mattress', 'washer', 'fridge']::text[]
        WHEN r.buyer_role = 'health_service' THEN ARRAY['bed', 'mattress']::text[]
        ELSE ARRAY['bed', 'mattress']::text[]
      END AS product_fit,
      LEAST(100, GREATEST(35, r.fit_score)) AS fit_score,
      'Open outreach with Goods proof pack and local partner framing.'::text AS next_action,
      r.contract_count AS govt_contract_count,
      r.contract_value AS govt_contract_value,
      r.is_community_controlled,
      r.website
    FROM ranked r
    WHERE r.rn <= 2
      AND NOT EXISTS (
        SELECT 1
        FROM goods_procurement_entities gpe
        WHERE gpe.community_id = r.community_id
          AND (
            (r.gs_id IS NOT NULL AND gpe.gs_id = r.gs_id)
            OR (r.abn IS NOT NULL AND gpe.abn = r.abn)
            OR LOWER(COALESCE(gpe.entity_name, '')) = LOWER(COALESCE(r.entity_name, ''))
          )
      )
  `);

  await sql(`
    WITH top_buyer AS (
      SELECT
        community_id,
        entity_name,
        ROW_NUMBER() OVER (
          PARTITION BY community_id
          ORDER BY
            COALESCE(fit_score, 0) DESC,
            COALESCE(govt_contract_value, 0) DESC,
            COALESCE(govt_contract_count, 0) DESC,
            updated_at DESC
        ) as rn
      FROM goods_procurement_entities
      WHERE
        community_id IS NOT NULL
        AND entity_name IS NOT NULL
        AND TRIM(entity_name) <> ''
        AND COALESCE(buyer_role, 'other') <> 'other'
    )
    UPDATE goods_communities gc
    SET
      known_buyer_name = tb.entity_name,
      updated_at = NOW()
    FROM top_buyer tb
    WHERE
      gc.id = tb.community_id
      AND tb.rn = 1
      AND (gc.known_buyer_name IS NULL OR TRIM(gc.known_buyer_name) = '')
  `);

  await sql(`
    WITH agg AS (
      SELECT
        community_id,
        COUNT(*)::int as buyer_entity_count,
        COUNT(*) FILTER (WHERE buyer_role = 'store')::int as store_count,
        COUNT(*) FILTER (WHERE buyer_role = 'health_service')::int as health_service_count,
        COUNT(*) FILTER (WHERE buyer_role = 'housing_provider')::int as housing_org_count,
        COUNT(*) FILTER (WHERE buyer_role = 'council')::int as council_count
      FROM goods_procurement_entities
      WHERE community_id IS NOT NULL
      GROUP BY community_id
    )
    UPDATE goods_communities gc
    SET
      buyer_entity_count = agg.buyer_entity_count,
      store_count = agg.store_count,
      health_service_count = agg.health_service_count,
      housing_org_count = agg.housing_org_count,
      council_count = agg.council_count,
      updated_at = NOW()
    FROM agg
    WHERE gc.id = agg.community_id
  `);

  const after = await metricSnapshot();
  console.log('\nAfter snapshot:');
  console.table([after.community, after.coverage, after.goodsNt]);
  console.table(after.roles);
  console.log('\nDone.');
}

main().catch((error) => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
