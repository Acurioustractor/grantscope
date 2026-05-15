import { getServiceSupabase } from '@/lib/supabase';
import { TriageClient, type TriageRow } from './triage-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Triage Promoted Opps — Ops',
  description: 'Classify unverified grant opportunities into open_grant / placeholder / invitation_only / etc.',
};

export default async function TriagePage() {
  const supabase = getServiceSupabase();

  const { data: rows } = await supabase
    .from('alma_funding_opportunities')
    .select(
      'id, name, description, funder_name, source_url, application_url, deadline, min_grant_amount, max_grant_amount, focus_areas, keywords, jurisdictions, eligible_org_types, scrape_source, opportunity_type, verification_status, verification_notes, raw_data'
    )
    .eq('opportunity_type', 'unverified')
    .order('funder_name', { ascending: true });

  // Funder context dossiers (joined client-side by funder_name)
  const { data: contexts } = await supabase
    .from('funder_context_snapshot')
    .select('*');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TriageClient rows={(rows ?? []) as TriageRow[]} contexts={contexts ?? []} />
    </div>
  );
}
