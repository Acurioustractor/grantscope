import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { MatchesClient } from './matches-client';

export const metadata = {
  title: 'Matched Grants — CivicGraph',
};

export default async function MatchesPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <MatchesClient />;
}
