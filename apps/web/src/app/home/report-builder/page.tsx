import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { BriefingGeneratorShell } from '@/app/components/briefing-generator-shell';
import { buildReportBuilderPageState } from '@/app/components/briefing-page-params';
import { ReportBuilderClient } from './report-builder-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Custom Report Builder | CivicGraph',
  description: 'Build custom funding intelligence reports by topic, state, and LGA.',
};

type SearchParams = {
  topic?: string;
  state?: string;
  focus?: string;
  autogenerate?: string;
  lanes?: string;
};

export default async function ReportBuilderPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const {
    briefingComposeHref,
    loop,
    nextPath,
  } = buildReportBuilderPageState(params);
  const initialTopic = params.topic || 'youth-justice';
  const initialStateFilter = params.state || '';
  const initialFocus = params.focus || '';
  const autoGenerate = params.autogenerate === '1';

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  return (
    <BriefingGeneratorShell
      hubHref={briefingComposeHref}
      title="Custom Report Builder"
      description="Build custom funding intelligence reports by topic, state, and geography. Go back to the hub if you need to shift the subject, output type, or story handoff lane first."
      badge="Funder Intelligence"
      loop={loop}
    >
      <ReportBuilderClient
        initialTopic={initialTopic}
        initialStateFilter={initialStateFilter}
        initialFocus={initialFocus}
        autoGenerate={autoGenerate}
      />
    </BriefingGeneratorShell>
  );
}
