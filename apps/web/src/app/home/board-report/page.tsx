import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BoardReportClient } from './board-report-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Board Report Generator | CivicGraph',
  description: 'Generate printable board-ready reports summarizing grant landscape, relationships, and funding data.',
};

export default async function BoardReportPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/home/board-report');

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <Link href="/home" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-black text-bauhaus-black mt-1">Board Report Generator</h1>
          <p className="text-sm text-bauhaus-muted mt-1">
            Generate printable board-ready reports summarizing grant landscape, relationships, and funding data.
          </p>
        </div>
        <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
          Decision Intelligence
        </div>
      </div>

      <BoardReportClient />
    </div>
  );
}
