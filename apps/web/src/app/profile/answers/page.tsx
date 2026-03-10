import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { AnswerBankClient } from './answers-client';

export const metadata = {
  title: 'Answer Bank — CivicGraph',
};

export default async function AnswerBankPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <AnswerBankClient />;
}
