import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TenderBriefClient } from './tender-brief-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Tender Brief — Market Intelligence | CivicGraph',
  description: 'Enter tender keywords to get instant market intelligence: incumbents, contract history, and supplier landscape.',
};

export default async function TenderBriefPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/home/tender-brief');

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <Link href="/home" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-black text-bauhaus-black mt-1">Tender Brief</h1>
          <p className="text-sm text-bauhaus-muted mt-1">
            Enter tender keywords to get instant market intelligence — incumbents, contract history, and supplier landscape.
          </p>
        </div>
        <Link
          href="/tender-intelligence"
          className="text-xs font-black text-bauhaus-black uppercase tracking-widest hover:text-bauhaus-red"
        >
          Full Procurement Workspace &rarr;
        </Link>
      </div>
      <TenderBriefClient />
    </div>
  );
}
