import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ApiKeysClient } from './api-keys-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'API Keys — Programmatic Access | CivicGraph',
  description: 'Manage your API keys for programmatic access to CivicGraph data.',
};

export default async function ApiKeysPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/home/api-keys');

  return <ApiKeysClient />;
}
