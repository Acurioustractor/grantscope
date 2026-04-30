import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getLiveReportSupabase } from '@/lib/report-supabase';
import { safe } from '@/lib/services/utils';

export const dynamic = 'force-dynamic';

const STATES: Record<string, { code: string; label: string; pop10to17?: number; rogsContext?: string }> = {
  nsw: { code: 'NSW', label: 'New South Wales' },
  vic: { code: 'VIC', label: 'Victoria' },
  wa: { code: 'WA', label: 'Western Australia' },
  sa: { code: 'SA', label: 'South Australia' },
  nt: { code: 'NT', label: 'Northern Territory' },
  tas: { code: 'TAS', label: 'Tasmania' },
  act: { code: 'ACT', label: 'Australian Capital Territory' },
};

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const meta = STATES[state];
  if (!meta) return { title: 'State not found · CivicGraph' };
  return {
    title: `${meta.label} Youth Justice — Sector Deep Dive · CivicGraph`,
    description: `Live youth-justice data for ${meta.label}: detention vs community spend, top funded recipients, cross-sector providers, parliamentary signals. Cross-state companion to the QLD flagship.`,
  };
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}
function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString();
}

function StackedBar({ total, segments }: { total: number; segments: Array<{ key: string; value: number; color: string; label: string }> }) {
  const t = Math.max(total || 0, 1);
  return (
    <div>
      <div className="relative h-7 bg-bauhaus-canvas border-2 border-bauhaus-black flex">
        {segments.map(s => {
          if (!s.value || s.value <= 0) return null;
          return <div key={s.key} className={`${s.color} h-full`} style={{ width: `${(s.value / t) * 100}%` }} title={`${s.label}: ${money(s.value)}`} />;
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono text-bauhaus-muted">
        {segments.filter(s => (s.value || 0) > 0).map(s => (
          <span key={s.key}>
            <span className={`inline-block w-2 h-2 ${s.color} mr-1 align-middle`} />
            {s.label} {money(s.value)} ({total ? ((s.value / total) * 100).toFixed(0) : 0}%)
          </span>
        ))}
      </div>
    </div>
  );
}

function displayName(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^the\s+corporation\s+of\s+the\s+trustees\s+of\s+the\s+/i, '');
  s = s.replace(/^the\s+corporation\s+of\s+the\s+synod\s+of\s+the\s+diocese\s+of\s+brisbane(\s*-\s*)?/i, 'Anglican Diocese of Brisbane $1');
  s = s.replace(/^the\s+trustee\s+for\s+/i, '');
  s = s.replace(/\s+(pty\s+ltd|pty|ltd\.?|limited|incorporated|inc\.?|pictures\s+limited)$/i, '');
  if (/^[A-Z0-9\s&.,'-]+$/.test(s) && s.length > 4) {
    s = s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    s = s.replace(/\bBhp\b/g, 'BHP').replace(/\bAcco\b/g, 'ACCO').replace(/\bNgo\b/g, 'NGO').replace(/\bQld\b/g, 'QLD').replace(/\bNsw\b/g, 'NSW');
  }
  s = s.replace(/\s*-\s*$/, '').trim();
  return s;
}

function classifyStatement(s: { headline: string }): 'punitive' | 'preventive' | 'mixed' {
  const h = s.headline.toLowerCase();
  if (/adult crime|adult time|tougher|crackdown|tough\s+on|stronger\s+(youth\s+)?bail|bail\s+(monitoring|breach|crackdown|tough)|new\s+detention|new\s+prison|45\s+offences|expanding\s+adult|harder\s+on|life\s+sentenc|adult\s+penalt/.test(h)) return 'punitive';
  if (/early intervention|rehabilitation|step up step down|career pathways|youth week|prevention|community-led|treaty|justice reinvestment|family-led|kickstart|wrap.?around|diversion\b|education\b|jobs/.test(h)) return 'preventive';
  return 'mixed';
}

type SpendRow = { recipient_name: string; total: number };
type RecipientRow = { recipient_name: string; total: number; grants: number };
type CrossSectorRow = { recipient_name: string; sectors: number; total: number };
type AlmaRow = { name: string; type: string; evidence_level: string | null };
type HansardRow = { sitting_date: string; speaker_name: string | null; speaker_party: string | null; subject: string | null; snippet: string; source_url: string | null };
type MinStatement = { published_at: string; minister_name: string | null; portfolio: string | null; headline: string; source_url: string };

async function getStateReport(stateCode: string) {
  const supabase = getLiveReportSupabase();
  const [spend, recipients, crossSector, alma, hansard, statements, contracts, almaQldCount] = await Promise.all([
    safe(supabase.rpc('exec_sql', { query: `SELECT recipient_name, SUM(amount_dollars)::bigint AS total FROM public.justice_funding WHERE state = '${stateCode}' AND recipient_name LIKE 'Youth Justice -%' GROUP BY 1` })) as Promise<SpendRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT recipient_name, SUM(amount_dollars)::bigint AS total, COUNT(*)::int AS grants FROM public.justice_funding WHERE state = '${stateCode}' AND topics @> ARRAY['youth-justice'] AND amount_dollars > 0 AND recipient_name IS NOT NULL AND length(recipient_name) > 3 AND recipient_name !~ '^[0-9]+$' AND recipient_name NOT ILIKE '%Total%' AND recipient_name NOT ILIKE '%Department of%' AND recipient_name NOT ILIKE 'Youth Justice -%' AND recipient_name NOT ILIKE '%State of %' AND recipient_name NOT ILIKE '(blank)' GROUP BY 1 ORDER BY total DESC NULLS LAST LIMIT 15` })) as Promise<RecipientRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT recipient_name, COUNT(DISTINCT topic)::int AS sectors, SUM(amount_dollars)::bigint AS total FROM (SELECT recipient_name, unnest(topics) AS topic, amount_dollars FROM public.justice_funding WHERE state = '${stateCode}' AND amount_dollars > 0 AND recipient_name IS NOT NULL AND length(recipient_name) > 3 AND recipient_name !~ '^[0-9]+$' AND recipient_name NOT ILIKE '%Total%' AND recipient_name NOT ILIKE '%Department of%') t WHERE topic IN ('youth-justice','child-protection','disability','ndis','family-services','indigenous','mental-health','homelessness','aod','family-violence') GROUP BY 1 HAVING COUNT(DISTINCT topic) >= 3 ORDER BY total DESC NULLS LAST LIMIT 10` })) as Promise<CrossSectorRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT name, type, evidence_level FROM public.alma_interventions WHERE ('${stateCode}' = ANY(geography) OR EXISTS (SELECT 1 FROM unnest(geography) g WHERE g ILIKE '%${stateCode}%')) AND (topics @> ARRAY['youth-justice'] OR type ILIKE '%diversion%' OR type ILIKE '%justice%' OR type ILIKE '%wraparound%' OR type ILIKE '%community-led%') ORDER BY (CASE WHEN evidence_level ILIKE '%proven%' THEN 0 WHEN evidence_level ILIKE '%effective%' THEN 1 WHEN evidence_level ILIKE '%promising%' THEN 2 ELSE 3 END), name LIMIT 12` })) as Promise<AlmaRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT sitting_date::text, speaker_name, speaker_party, subject, substring(body_text, 1, 280) AS snippet, source_url FROM public.civic_hansard WHERE jurisdiction = '${stateCode}' AND length(body_text) > 100 AND speaker_name IS NOT NULL AND speaker_name NOT ILIKE '%Speaker%' AND speaker_name NOT ILIKE '%Hansard%' AND (body_text ~* '(youth justice|adult crime|youth detention|watchhouse|breach of bail|young offender)') ORDER BY sitting_date DESC NULLS LAST LIMIT 8` })) as Promise<HansardRow[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT published_at::text, minister_name, portfolio, headline, source_url FROM public.civic_ministerial_statements WHERE jurisdiction = '${stateCode}' AND (topics @> ARRAY['youth-justice'] OR headline ~* '(youth|detention|watch.?house|adult crime|bail|young offender)') AND published_at > NOW() - INTERVAL '24 months' ORDER BY published_at DESC LIMIT 8` })) as Promise<MinStatement[] | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT count(*)::int AS c, SUM(contract_value)::bigint AS total FROM public.austender_contracts WHERE supplier_name ILIKE ANY (ARRAY['%youth justice%','%PCYC%','%mission australia%','%lifeline%','%anglicare%','%uniting%','%save the children%']) AND contract_value > 0` })) as Promise<Array<{ c: number; total: number }> | null>,
    safe(supabase.rpc('exec_sql', { query: `SELECT count(*)::int AS c FROM public.alma_interventions WHERE ('${stateCode}' = ANY(geography) OR EXISTS (SELECT 1 FROM unnest(geography) g WHERE g ILIKE '%${stateCode}%'))` })) as Promise<Array<{ c: number }> | null>,
  ]);

  const detention = (spend ?? []).find(s => /detention/i.test(s.recipient_name))?.total || 0;
  const community = (spend ?? []).find(s => /community/i.test(s.recipient_name))?.total || 0;
  const groupConferencing = (spend ?? []).find(s => /group conferencing/i.test(s.recipient_name))?.total || 0;

  return {
    detention, community, groupConferencing,
    recipients: recipients ?? [],
    crossSector: crossSector ?? [],
    alma: alma ?? [],
    hansard: hansard ?? [],
    statements: statements ?? [],
    contractStats: contracts?.[0] || null,
    almaCount: almaQldCount?.[0]?.c ?? 0,
  };
}

export default async function StateYjSectorPage({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params;
  const meta = STATES[state];
  if (!meta) notFound();

  const hdrs = await headers();
  const isShare = (hdrs.get('x-pathname') ?? '').startsWith('/share/');
  const r = await getStateReport(meta.code);

  const total = r.detention + r.community + r.groupConferencing;
  const ratio = r.community > 0 ? (r.detention / r.community).toFixed(2) : '—';

  return (
    <div>
      {/* Mode toggle / cross-link */}
      <div className="flex flex-wrap items-center gap-0 mb-6">
        <span className="inline-block px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-black text-white">{meta.label}</span>
        <Link href="/reports/youth-justice/qld/sector" className="inline-block px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black -ml-0.5 bg-white text-bauhaus-black hover:bg-bauhaus-canvas">QLD flagship example →</Link>
      </div>

      <div className="mb-10">
        {!isShare && (
          <Link href="/reports/youth-justice" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            ← Youth Justice Reports
          </Link>
        )}
        <div className="text-xs font-black text-bauhaus-yellow mt-4 mb-1 uppercase tracking-widest">Cross-state report · Live data · Companion to the QLD flagship</div>
        <h1 className="text-3xl sm:text-5xl font-black text-bauhaus-black mb-3 uppercase tracking-tight leading-tight">
          {meta.label} Youth Justice<br />— Live data, the same shape
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Same investigative pattern as the <Link href="/reports/youth-justice/qld/sector" className="text-bauhaus-blue font-black hover:underline">QLD flagship</Link>, applied to {meta.label}. Live data only &mdash; detention-vs-community spend, top funded recipients, cross-sector providers, ALMA evidence base, and parliamentary signals. State-specific curated content (planned facilities, legislation timeline, oversight findings) is in research; <Link href="/feedback?subject=yj-state-deepdive" className="text-bauhaus-blue font-black hover:underline">tell us</Link> what to prioritise next.
        </p>
      </div>

      {/* HEADLINE STATS */}
      <section className="mb-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Detention $ (cum.)', value: money(r.detention), tone: 'red' },
          { label: 'Community $', value: money(r.community), tone: 'blue' },
          { label: 'Detention : Community', value: `${ratio}:1`, tone: 'red' },
          { label: 'ALMA programs · this state', value: fmt(r.almaCount), tone: 'black' },
        ].map((s, i) => (
          <div key={i} className="border-4 border-bauhaus-black p-3 bg-white">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{s.label}</div>
            <div className={`text-xl sm:text-2xl font-black tabular-nums leading-tight ${s.tone === 'red' ? 'text-bauhaus-red' : s.tone === 'blue' ? 'text-bauhaus-blue' : 'text-bauhaus-black'}`}>{s.value}</div>
          </div>
        ))}
      </section>

      {/* SPEND RATIO */}
      {total > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">{meta.label} youth-justice spend — detention vs community</h2>
          <p className="text-bauhaus-muted font-medium max-w-3xl mb-4">
            From state-budget Youth Justice line items in <code className="font-mono text-xs">justice_funding</code>. Ratio: <span className="font-black text-bauhaus-red">{ratio}:1 detention to community</span>.
          </p>
          <div className="border-4 border-bauhaus-black p-6 bg-white">
            <StackedBar
              total={total}
              segments={[
                { key: 'det', value: r.detention, color: 'bg-bauhaus-red', label: 'Detention services' },
                { key: 'com', value: r.community, color: 'bg-bauhaus-blue', label: 'Community-based' },
                { key: 'gc', value: r.groupConferencing, color: 'bg-bauhaus-yellow', label: 'Group conferencing' },
              ]}
            />
          </div>
        </section>
      )}

      {/* TOP RECIPIENTS */}
      {r.recipients.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Top {meta.code} recipients of YJ-tagged grants</h2>
          <p className="text-bauhaus-muted font-medium max-w-3xl mb-4">
            Top {r.recipients.length} recipients of youth-justice-tagged grants in {meta.label}, excluding state department line items.
          </p>
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Recipient</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Grants</th>
                </tr>
              </thead>
              <tbody>
                {r.recipients.map((p, i) => (
                  <tr key={p.recipient_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">{displayName(p.recipient_name)}</td>
                    <td className="p-3 text-right font-mono font-black">{money(p.total)}</td>
                    <td className="p-3 text-right font-mono">{p.grants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* CROSS-SECTOR PROVIDERS */}
      {r.crossSector.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Multi-system providers in {meta.code}</h2>
          <p className="text-bauhaus-muted font-medium max-w-3xl mb-4">
            Providers with funding across 3+ topic streams (youth-justice, child-protection, disability, NDIS, family-services, indigenous, mental-health, homelessness, AOD, family-violence). De-facto integrated service hubs, fragmented across siloed funding mechanisms.
          </p>
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bauhaus-black text-white">
                <tr>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Provider</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Sectors</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Total $</th>
                </tr>
              </thead>
              <tbody>
                {r.crossSector.map((c, i) => (
                  <tr key={c.recipient_name} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-black text-bauhaus-black">{displayName(c.recipient_name)}</td>
                    <td className="p-3 text-right font-mono">{c.sectors}</td>
                    <td className="p-3 text-right font-mono font-black">{money(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ALMA */}
      {r.alma.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">ALMA evidence-base programs · {meta.code}</h2>
          <p className="text-bauhaus-muted font-medium max-w-3xl mb-4">
            Australian Living Map of Alternatives entries with explicit {meta.label} presence. Evidence levels are self-attributed by ALMA submitters at registration time.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {r.alma.map((a, i) => {
              const level = a.evidence_level?.toLowerCase() ?? '';
              const tone = level.includes('proven') || level.includes('effective') ? 'border-bauhaus-blue' : level.includes('promising') ? 'border-bauhaus-yellow' : 'border-bauhaus-black';
              return (
                <div key={i} className={`border-4 ${tone} p-4 bg-white`}>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-1">{a.type}</div>
                  <div className="font-black text-bauhaus-black uppercase tracking-tight text-sm leading-tight mb-2">{a.name}</div>
                  <div className="text-[10px] text-bauhaus-muted font-mono">{a.evidence_level ?? '—'}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* HANSARD LIVE */}
      {r.hansard.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">{meta.label} Parliament — recent Hansard mentions</h2>
          <p className="text-bauhaus-muted font-medium max-w-3xl mb-4">
            Most-recent youth-justice mentions in {meta.label} parliament Hansard. Speaker names parsed from PDF; verify against parliament transcripts before citing.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {r.hansard.map((h, i) => {
              const partyTone =
                h.speaker_party === 'LNP' || h.speaker_party === 'Lib' || h.speaker_party === 'LP' ? 'border-bauhaus-blue' :
                h.speaker_party === 'ALP' || h.speaker_party === 'Lab' ? 'border-bauhaus-red' :
                h.speaker_party === 'GRN' ? 'border-bauhaus-black' :
                h.speaker_party === 'Nat' ? 'border-bauhaus-yellow' :
                'border-bauhaus-black';
              return (
                <div key={i} className={`border-4 ${partyTone} p-5 bg-white`}>
                  <div className="flex justify-between items-baseline mb-2 gap-3">
                    <div className="text-xs font-mono font-black text-bauhaus-muted">{h.sitting_date ? new Date(h.sitting_date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-bauhaus-canvas border border-bauhaus-black">{h.speaker_party ?? 'Independent'}</span>
                  </div>
                  <h4 className="text-base font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-2">{h.speaker_name ?? 'Unknown'}</h4>
                  <p className="text-xs text-bauhaus-black leading-relaxed italic mb-3">&ldquo;{h.snippet.replace(/\s+/g, ' ').trim()}…&rdquo;</p>
                  {h.source_url && <a href={h.source_url} target="_blank" rel="noopener" className="text-bauhaus-blue text-[10px] font-mono hover:underline">parliament source ↗</a>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* MINISTERIAL STATEMENTS */}
      {r.statements.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-2">Recent {meta.code} ministerial statements on youth justice</h2>
          <p className="text-bauhaus-muted font-medium max-w-3xl mb-4">
            Last {r.statements.length} youth-justice-tagged ministerial statements scraped from the {meta.label} government statements feed (where indexed). Direction-of-travel classifier reads the headline.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {r.statements.map((s, i) => {
              const thrust = classifyStatement(s);
              const tone =
                thrust === 'punitive' ? 'border-bauhaus-red' :
                thrust === 'preventive' ? 'border-bauhaus-blue' :
                'border-bauhaus-yellow';
              return (
                <div key={i} className={`border-4 ${tone} p-5 bg-white`}>
                  <div className="flex justify-between items-baseline mb-2 gap-3">
                    <div className="text-xs font-mono font-black text-bauhaus-muted">{new Date(s.published_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-bauhaus-canvas border border-bauhaus-black">{thrust}</span>
                  </div>
                  <h4 className="text-base font-black text-bauhaus-black uppercase tracking-tight leading-tight mb-2">{s.headline}</h4>
                  <p className="text-[10px] font-mono text-bauhaus-muted">{s.minister_name?.replace(/^The Honourable /, '') ?? '—'}{s.portfolio ? ` · ${s.portfolio}` : ''}</p>
                  <a href={s.source_url} target="_blank" rel="noopener" className="text-bauhaus-blue text-[10px] font-mono hover:underline">source ↗</a>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* CROSS-LINK TO QLD FLAGSHIP */}
      <section className="border-4 border-bauhaus-black p-8 bg-bauhaus-canvas mb-12">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">The deeper read</div>
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">QLD has the worked example</h2>
        <p className="text-bauhaus-black font-medium leading-relaxed max-w-3xl mb-4">
          The QLD flagship report is 7 volumes, 25 sections, 17 numbered findings. It includes live watchhouse data refreshed twice daily, the planned Wacol/Woodford/Cairns capacity expansion, the Making Queensland Safer Act 2024 and "adult crime, adult time" framework, ACCO funding gap, multi-system providers ($1B+ portfolios across 5 sectors), foundation landscape, director networks, royal-commission lineage, and live ministerial-statement + Hansard feeds.
          The same investigative pattern can be applied to {meta.label}; what you see above is what comes &ldquo;for free&rdquo; from the structured datasets. The state-specific curated layer (legislation, planned facilities, oversight findings) takes ~20 hours of research per state.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/reports/youth-justice/qld/sector" className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">Read the QLD flagship →</Link>
          <Link href={`/feedback?subject=yj-${state}-deepdive`} className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-yellow text-bauhaus-black border-2 border-bauhaus-black hover:bg-bauhaus-canvas">★ Request a {meta.code} deep-dive →</Link>
        </div>
      </section>

      {/* CTA */}
      <section className="border-4 border-bauhaus-black p-8 bg-bauhaus-yellow mb-12">
        <h2 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight mb-3">Was this useful?</h2>
        <p className="text-bauhaus-black font-medium leading-relaxed max-w-3xl mb-5">
          We&apos;re building CivicGraph in public. Same pipeline works for any state, sector, or peak body. Tell us what was valuable and what you&apos;d want next, anonymously if you like.
        </p>
        <Link href={`/feedback?subject=yj-${state}`} className="inline-block px-5 py-3 text-sm font-black uppercase tracking-widest bg-bauhaus-black text-white border-2 border-bauhaus-black hover:bg-bauhaus-red">★ Send feedback (~2 min) →</Link>
      </section>

      <div className="text-center mb-8">
        <div className="text-xs font-mono text-bauhaus-muted">CivicGraph state companion · {new Date().toISOString().slice(0, 10)} · Built by A Curious Tractor</div>
      </div>
    </div>
  );
}
