import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServer, hasSupabaseServerEnv } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Account — CivicGraph',
  description: 'Your CivicGraph workspace: feedback you’ve sent, reports you’ve requested, and what’s shifted on the things you watch.',
};

type Submission = {
  id: string;
  submitted_at: string;
  target_subject: string;
  target_type: string | null;
  budget_signal: string | null;
  free_5_apply: boolean;
  permission_to_publish: boolean;
};

type Feedback = {
  id: string;
  submitted_at: string;
  report_subject: string | null;
  value_score: number | null;
  value_signals: string[] | null;
  topics_wanted: string[] | null;
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.floor((now - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default async function AccountPage() {
  if (!hasSupabaseServerEnv()) redirect('/login?redirect=/account');
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/account');

  const email = user.email ?? null;
  const db = getServiceSupabase();

  // Look up by email — both submissions tables key on contact_email
  const [submissionsRes, feedbackRes] = await Promise.all([
    email ? db.from('report_submissions').select('id, submitted_at, target_subject, target_type, budget_signal, free_5_apply, permission_to_publish').eq('contact_email', email).order('submitted_at', { ascending: false }).limit(20) : { data: null, error: null },
    email ? db.from('report_feedback').select('id, submitted_at, report_subject, value_score, value_signals, topics_wanted').eq('contact_email', email).order('submitted_at', { ascending: false }).limit(20) : { data: null, error: null },
  ]);

  const submissions = (submissionsRes.data ?? []) as Submission[];
  const feedback = (feedbackRes.data ?? []) as Feedback[];

  return (
    <div>
      <div className="mb-10">
        <Link href="/discover" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">← Discover</Link>
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Your account</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-3 uppercase tracking-tight leading-tight">
          Welcome back
        </h1>
        <p className="text-bauhaus-muted text-base font-medium">
          Signed in as <span className="font-black text-bauhaus-black">{email ?? '—'}</span>
        </p>
      </div>

      {/* Quick actions */}
      <section className="grid sm:grid-cols-3 gap-4 mb-10">
        <Link href="/changes" className="block border-4 border-bauhaus-black p-5 bg-white hover:bg-bauhaus-canvas">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">● Live</div>
          <div className="font-black text-bauhaus-black uppercase tracking-tight text-sm leading-tight">What&apos;s changing on CivicGraph →</div>
          <p className="text-xs text-bauhaus-muted font-medium mt-2">Watchhouse refreshes, ingestion runs, recent reports.</p>
        </Link>
        <Link href="/discover" className="block border-4 border-bauhaus-black p-5 bg-bauhaus-yellow hover:bg-bauhaus-canvas">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">Reports</div>
          <div className="font-black text-bauhaus-black uppercase tracking-tight text-sm leading-tight">Browse featured reports →</div>
          <p className="text-xs text-bauhaus-black/70 font-medium mt-2">QLD Youth Justice live · FECCA &amp; ECCV worked example.</p>
        </Link>
        <Link href="/get-a-report?free=true&src=account" className="block border-4 border-bauhaus-black p-5 bg-bauhaus-black text-white hover:bg-bauhaus-red">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">★ Free for now</div>
          <div className="font-black uppercase tracking-tight text-sm leading-tight">Request a report on your sector →</div>
          <p className="text-xs text-white/70 font-medium mt-2">5–7 day turnaround. First 5 free for public case studies.</p>
        </Link>
      </section>

      {/* Submissions */}
      <section className="mb-10">
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">Your report requests ({submissions.length})</h2>
        {submissions.length === 0 ? (
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            <p className="text-bauhaus-muted text-sm font-medium mb-3">No requests yet.</p>
            <Link href="/get-a-report?free=true&src=account-empty" className="inline-block px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">★ Request your first →</Link>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Subject</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Type</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Tier</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs whitespace-nowrap">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">{s.target_subject}</td>
                    <td className="p-3 text-xs text-bauhaus-muted whitespace-nowrap">{s.target_type ?? '—'}</td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {s.free_5_apply ? <span className="font-black text-bauhaus-red">★ Free 5</span> : (s.budget_signal || '—')}
                    </td>
                    <td className="p-3 text-xs font-mono text-bauhaus-muted whitespace-nowrap">{timeAgo(s.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Feedback */}
      <section className="mb-10">
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-4">Your feedback ({feedback.length})</h2>
        {feedback.length === 0 ? (
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            <p className="text-bauhaus-muted text-sm font-medium mb-3">You haven&apos;t sent feedback yet.</p>
            <Link href="/feedback?subject=account-empty" className="inline-block px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-yellow text-bauhaus-black border-2 border-bauhaus-black hover:bg-bauhaus-canvas">★ Send feedback →</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {feedback.map(f => (
              <div key={f.id} className="border-4 border-bauhaus-black p-4 bg-white">
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow">{f.report_subject ?? 'general'}</div>
                  <div className="text-xs font-mono text-bauhaus-muted">{timeAgo(f.submitted_at)}</div>
                </div>
                <div className="flex items-baseline gap-3 mb-3">
                  {f.value_score != null && (
                    <span className="text-2xl font-black text-bauhaus-black tabular-nums">{f.value_score}<span className="text-sm text-bauhaus-muted">/5</span></span>
                  )}
                  <span className="text-xs font-medium text-bauhaus-muted">
                    {f.value_signals?.length ? `${f.value_signals.length} signals` : ''}
                    {f.value_signals?.length && f.topics_wanted?.length ? ' · ' : ''}
                    {f.topics_wanted?.length ? `${f.topics_wanted.length} topics` : ''}
                  </span>
                </div>
                {f.value_signals && f.value_signals.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {f.value_signals.slice(0, 3).map((sig, i) => (
                      <span key={i} className="text-[10px] font-black uppercase tracking-widest bg-bauhaus-canvas text-bauhaus-black px-2 py-1 border border-bauhaus-black">{sig.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Settings (placeholder) */}
      <section className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas mb-10">
        <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-tight mb-3">What you can do here today</h2>
        <ul className="space-y-2 text-sm font-medium text-bauhaus-black leading-relaxed">
          <li>· See every report request and feedback submission you&apos;ve made.</li>
          <li>· Browse featured reports and the live data feed.</li>
          <li>· Request a new report on your sector.</li>
        </ul>
        <h3 className="text-sm font-black uppercase tracking-widest text-bauhaus-yellow mt-5 mb-2">Coming next</h3>
        <ul className="space-y-2 text-xs font-medium text-bauhaus-muted leading-relaxed">
          <li>· Watchlists — star any org or report and we&apos;ll alert you when something material changes.</li>
          <li>· Sector subscriptions — recurring reports + monthly briefing memos.</li>
          <li>· Branded delivery — white-labelled reports your team can show stakeholders.</li>
        </ul>
        <p className="text-xs font-mono text-bauhaus-muted mt-4">
          Want one of these now? <Link href="/feedback?subject=account-roadmap" className="text-bauhaus-blue font-black hover:underline">Tell us</Link>.
        </p>
      </section>
    </div>
  );
}
