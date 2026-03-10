import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { ProfileClient } from './profile-client';

export const metadata = {
  title: 'Organisation Profile — CivicGraph',
};

export default async function ProfilePage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <ProfileClient />;
}
