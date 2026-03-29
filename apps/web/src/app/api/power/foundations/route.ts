import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/sql';

export async function GET() {
  try {
    const supabase = getServiceSupabase();

    const [topFoundations, typeBreakdown, thematicFocus, topRecipients, dualFunded, summary] =
      await Promise.all([
        // Top 30 foundations by annual giving
        safe(
          supabase
            .from('foundations')
            .select(
              'id, name, type, total_giving_annual, thematic_focus, geographic_focus, endowment_size, gs_entity_id, acnc_abn, website'
            )
            .gt('total_giving_annual', 0)
            .order('total_giving_annual', { ascending: false })
            .limit(30)
        ),

        // Type breakdown
        safe(
          supabase.rpc('exec_sql', {
            query: `
            SELECT type, count(*) as count,
              round(sum(total_giving_annual)) as total_giving,
              round(avg(total_giving_annual)) as avg_giving
            FROM foundations
            WHERE total_giving_annual > 0 AND type IS NOT NULL
            GROUP BY type ORDER BY total_giving DESC LIMIT 12
          `,
          })
        ),

        // Thematic focus distribution
        safe(
          supabase.rpc('exec_sql', {
            query: `
            SELECT unnest(thematic_focus) as theme, count(*) as count
            FROM foundations
            WHERE thematic_focus IS NOT NULL
            GROUP BY theme ORDER BY count DESC LIMIT 15
          `,
          })
        ),

        // Top grant recipients from justice_funding
        safe(
          supabase.rpc('exec_sql', {
            query: `
            SELECT
              jf.recipient_name,
              o.name as org_name,
              o.is_indigenous_org,
              o.state,
              count(*) as grant_count,
              sum(jf.amount_dollars) as total_received
            FROM justice_funding jf
            LEFT JOIN organizations o ON o.id = jf.alma_organization_id
            WHERE jf.source = 'foundation-notable-grants'
              AND jf.amount_dollars > 0
              AND jf.amount_dollars < 100000000
            GROUP BY jf.recipient_name, o.name, o.is_indigenous_org, o.state
            ORDER BY total_received DESC
            LIMIT 25
          `,
          })
        ),

        // Dual-funded orgs (both govt + foundation money)
        safe(
          supabase.rpc('exec_sql', {
            query: `
            WITH foundation_sources AS (
              SELECT unnest(ARRAY[
                'foundation-notable-grants', 'prf-portfolio',
                'prf-jr-portfolio-review-2025', 'dusseldorp-yir-2025'
              ]) AS src
            ),
            foundation_funded AS (
              SELECT alma_organization_id as org_id,
                sum(amount_dollars) as foundation_total,
                count(*) as foundation_grants
              FROM justice_funding
              WHERE alma_organization_id IS NOT NULL
                AND source IN (SELECT src FROM foundation_sources)
                AND amount_dollars > 0
              GROUP BY alma_organization_id
            ),
            govt_funded AS (
              SELECT alma_organization_id as org_id,
                sum(amount_dollars) as govt_total,
                count(*) as govt_grants
              FROM justice_funding
              WHERE alma_organization_id IS NOT NULL
                AND source NOT IN (SELECT src FROM foundation_sources)
                AND amount_dollars > 0
              GROUP BY alma_organization_id
            )
            SELECT
              o.name, o.state, o.is_indigenous_org,
              ff.foundation_total, ff.foundation_grants,
              gf.govt_total, gf.govt_grants
            FROM foundation_funded ff
            JOIN govt_funded gf ON gf.org_id = ff.org_id
            JOIN organizations o ON o.id = ff.org_id
            ORDER BY ff.foundation_total DESC
            LIMIT 20
          `,
          })
        ),

        // Summary stats
        safe(
          supabase.rpc('exec_sql', {
            query: `
            SELECT
              count(*) as total_foundations,
              count(CASE WHEN total_giving_annual > 0 THEN 1 END) as with_giving_data,
              round(sum(total_giving_annual)) as total_annual_giving,
              count(CASE WHEN type = 'corporate_foundation' THEN 1 END) as corporate_count,
              count(CASE WHEN type = 'private_ancillary_fund' THEN 1 END) as paf_count,
              count(CASE WHEN type = 'trust' THEN 1 END) as trust_count,
              count(CASE WHEN type = 'grantmaker' THEN 1 END) as grantmaker_count,
              count(CASE WHEN 'indigenous' = ANY(thematic_focus) THEN 1 END) as indigenous_focus_count,
              count(CASE WHEN 'youth' = ANY(thematic_focus) THEN 1 END) as youth_focus_count
            FROM foundations
          `,
          })
        ),
      ]);

    return NextResponse.json({
      topFoundations: topFoundations || [],
      typeBreakdown: typeBreakdown || [],
      thematicFocus: thematicFocus || [],
      topRecipients: topRecipients || [],
      dualFunded: dualFunded || [],
      summary: Array.isArray(summary) ? summary[0] : null,
    });
  } catch (err) {
    console.error('Foundation API error:', err);
    return NextResponse.json({ error: 'Failed to load foundation data' }, { status: 500 });
  }
}
