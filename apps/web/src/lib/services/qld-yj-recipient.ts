// Shared service for QLD Youth Justice per-recipient drill-down pages.
// Pulled out of the §9.5 inline block in the QLD YJ sector report.
// Source: justice_funding ⨝ alma_interventions via alma_intervention_id FK.

import { getLiveReportSupabase } from '@/lib/report-supabase';

export type RecipientProgram = {
  program_name: string | null;
  financial_year: string | null;
  amount: number;
  description: string | null;
};

export type RecipientIntervention = {
  name: string;
  evidence_level: string | null;
  type: string | null;
};

export type RecipientChain = {
  recipient_name: string;
  total: number;
  grants: number;
  first_year: string | null;
  last_year: string | null;
  programs: RecipientProgram[];
  interventions: RecipientIntervention[];
  all_topics: string[];
};

// The eight recipients that have drill-down pages. Order = top-by-$.
// Slugs are stable; do not rename without setting up redirects.
export const QLD_YJ_DRILLDOWN_RECIPIENTS: Array<{ slug: string; recipient_name: string }> = [
  { slug: 'lifeline-community-care', recipient_name: 'Lifeline Community Care' },
  { slug: 'relationships-australia-qld', recipient_name: 'Relationships Australia (Qld)' },
  { slug: 'anglican-diocese-brisbane', recipient_name: 'The Corporation of the Synod of the Diocese of Brisbane' },
  { slug: 'mission-australia', recipient_name: 'Mission Australia' },
  { slug: 'ted-noffs-foundation', recipient_name: 'The Ted Noffs Foundation' },
  { slug: 'shine-for-kids', recipient_name: 'Shine For Kids Limited' },
  { slug: 'youthlink', recipient_name: 'YouthLink' },
  { slug: 'life-without-barriers', recipient_name: 'Life Without Barriers' },
];

export function recipientForSlug(slug: string): { slug: string; recipient_name: string } | null {
  return QLD_YJ_DRILLDOWN_RECIPIENTS.find(r => r.slug === slug) ?? null;
}

// Mirror of the §9.5 query, parameterised to a single recipient name.
// Returns the same shape as the inline RecipientChainRow.
export async function getRecipientChain(recipientName: string): Promise<RecipientChain | null> {
  const supabase = getLiveReportSupabase();
  const safeName = recipientName.replace(/'/g, "''");
  const query = `WITH rec AS (
    SELECT recipient_name,
           SUM(amount_dollars)::bigint AS total,
           COUNT(*)::int AS grants,
           MIN(financial_year) AS first_year,
           MAX(financial_year) AS last_year
    FROM public.justice_funding
    WHERE state='QLD' AND topics @> ARRAY['youth-justice'] AND amount_dollars > 0
      AND recipient_name = '${safeName}'
    GROUP BY 1
  ), prog AS (
    SELECT t.recipient_name,
           jsonb_agg(jsonb_build_object(
             'program_name', t.program_name,
             'financial_year', t.financial_year,
             'amount', t.amount_dollars,
             'description', LEFT(COALESCE(t.project_description, ''), 240)
           ) ORDER BY t.amount_dollars DESC) AS programs
    FROM (
      SELECT j.recipient_name, j.program_name, j.financial_year, j.amount_dollars, j.project_description,
             ROW_NUMBER() OVER (PARTITION BY j.recipient_name ORDER BY j.amount_dollars DESC) AS rn
      FROM public.justice_funding j
      WHERE j.state='QLD' AND j.topics @> ARRAY['youth-justice'] AND j.amount_dollars > 0
        AND j.recipient_name = '${safeName}'
    ) t
    WHERE t.rn <= 15
    GROUP BY 1
  ), alma AS (
    SELECT j.recipient_name,
           jsonb_agg(DISTINCT jsonb_build_object('name', a.name, 'evidence_level', a.evidence_level, 'type', a.type)) AS interventions
    FROM public.justice_funding j
    JOIN public.alma_interventions a ON a.id = j.alma_intervention_id
    WHERE j.state='QLD' AND j.topics @> ARRAY['youth-justice']
      AND j.recipient_name = '${safeName}'
    GROUP BY 1
  ), tp AS (
    SELECT recipient_name, ARRAY_AGG(DISTINCT topic) AS all_topics
    FROM (
      SELECT j.recipient_name, unnest(j.topics) AS topic
      FROM public.justice_funding j
      WHERE j.state='QLD' AND j.amount_dollars > 0
        AND j.recipient_name = '${safeName}'
    ) tt
    GROUP BY 1
  )
  SELECT rec.recipient_name, rec.total, rec.grants, rec.first_year, rec.last_year,
         COALESCE(prog.programs, '[]'::jsonb) AS programs,
         COALESCE(alma.interventions, '[]'::jsonb) AS interventions,
         COALESCE(tp.all_topics, ARRAY[]::text[]) AS all_topics
  FROM rec
  LEFT JOIN prog USING (recipient_name)
  LEFT JOIN alma USING (recipient_name)
  LEFT JOIN tp USING (recipient_name)`;
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error || !data) return null;
    const rows = data as RecipientChain[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
