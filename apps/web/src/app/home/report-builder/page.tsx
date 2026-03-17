import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ReportBuilderClient } from './report-builder-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Custom Report Builder | CivicGraph',
  description: 'Build custom funding intelligence reports by topic, state, and LGA.',
};

export default async function ReportBuilderPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/home/report-builder');

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <Link href="/home" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-black text-bauhaus-black mt-1">Custom Report Builder</h1>
          <p className="text-sm text-bauhaus-muted mt-1">
            Build custom funding intelligence reports by topic, state, and geography.
          </p>
        </div>
        <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
          Funder Intelligence
        </div>
      </div>

      <ReportBuilderClient />
    </div>
  );
}
