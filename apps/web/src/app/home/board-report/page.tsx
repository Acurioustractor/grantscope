import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { BriefingGeneratorShell } from '@/app/components/briefing-generator-shell';
import { buildBoardReportPageState } from '@/app/components/briefing-page-params';
import { BoardReportClient } from './board-report-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Board Report Generator | CivicGraph',
  description: 'Generate printable board-ready reports summarizing grant landscape, relationships, and funding data.',
};

type SearchParams = {
  q?: string;
  autosearch?: string;
  subject?: string;
  lanes?: string;
};

export default async function BoardReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const {
    briefingComposeHref,
    loop,
    nextPath,
  } = buildBoardReportPageState(params);
  const initialSearchTerm = params.q || '';
  const autoSearch = params.autosearch === '1';

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  return (
    <BriefingGeneratorShell
      hubHref={briefingComposeHref}
      title="Board Report Generator"
      description="Generate printable board-ready reports summarizing grant landscape, relationships, and funding data. Go back to the hub if you need to change the start point, output type, or story handoff."
      badge="Decision Intelligence"
      loop={loop}
    >
      <BoardReportClient initialSearchTerm={initialSearchTerm} autoSearch={autoSearch} />
    </BriefingGeneratorShell>
  );
}
