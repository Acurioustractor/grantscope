import Link from 'next/link';
import { getServiceSupabase } from '@/lib/supabase';
import { money } from '@/lib/justice-money';
import {
  SECTORS, SINCE_YEAR, MIN_CONFIDENCE, sectorFor, labelledCount, findPeers, peerGrants, rankPrograms, regionHolders,
} from '@/lib/community-funders';

export const dynamic = 'force-dynamic';

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

export default async function FundersLikeMine({
  params, searchParams,
}: {
  params: Promise<{ abn: string }>;
  searchParams: Promise<{ sector?: string; state?: string; size?: string }>;
}) {
  const { abn } = await params;
  const q = await searchParams;
  const db = getServiceSupabase();

  const { data: charity } = await db.from('acnc_charities').select('name, state, charity_size').eq('abn', abn).maybeSingle();
  const { data: entity } = charity
    ? { data: null }
    : await db.from('gs_entities').select('canonical_name, state').eq('abn', abn).limit(1).maybeSingle();
  const name = charity?.name ?? entity?.canonical_name ?? `ABN ${abn}`;
  const jev = sectorFor(abn);
  const sector = q.sector && SECTORS[q.sector] ? q.sector : (jev.confidence ?? 0) >= MIN_CONFIDENCE ? jev.sector : null;
  const state = q.state && STATES.includes(q.state) ? q.state : charity?.state ?? entity?.state ?? null;
  const size = q.size ?? (charity?.charity_size ? charity.charity_size.toLowerCase() : 'not_large');
  const SIZES: Record<string, string> = { small: 'Small', medium: 'Medium', large: 'Large', not_large: 'Small and medium', any: 'Any size' };
  const base = `/charities/${abn}/funders`;
  const qs = (o: Record<string, string | null>) =>
    '?' + new URLSearchParams(Object.entries({ sector, state, size, ...o }).filter(([, v]) => v) as [string, string][]).toString();

  const peers = sector && state ? await findPeers(db, { abn, sector, state, size }) : [];
  const programs = peers.length ? rankPrograms(await peerGrants(db, peers)) : [];
  const peerAbns = new Set(peers.map((p) => p.abn));
  const holders = sector && state ? await regionHolders(db, { sector, state, peerAbns }) : [];
  const holderTotal = holders.reduce((s, h) => s + h.total, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Who funds organisations like mine</p>
      <h1 className="mt-2 text-3xl font-black uppercase tracking-wide">{name}</h1>

      <section className="mt-6 border-4 border-bauhaus-black bg-bauhaus-yellow p-5">
        <p className="text-sm font-black uppercase tracking-widest">Why this exists</p>
        <p className="mt-2 text-lg">
          Charities that say they serve Aboriginal and Torres Strait Islander people took in $81.5 billion in a year.
          Between one and a half and six cents in each dollar reached organisations those communities control.
          Big institutions pay people to know where the money is. This page is that knowledge, free.
        </p>
        <p className="mt-2 text-xs">Draft figure from ACNC filings 2022 to 2024, being re-checked. Not for publication yet.</p>
      </section>

      <section className="mt-8 border-4 border-bauhaus-black p-5">
        <p className="text-sm font-black uppercase tracking-widest">Organisations like you</p>
        <p className="mt-2">
          Same main work, same state, similar size.
          {sector ? (
            <>
              {' '}Main work: <b>{SECTORS[sector]}</b>
              {q.sector
                ? ' (you chose this)'
                : jev.confidence
                  ? ` (judged by Jev at ${Math.round(jev.confidence * 100)}% confidence from your ACNC description)`
                  : ''}
              .
            </>
          ) : (
            ' Pick your main work below.'
          )}
          {state ? <> State: <b>{state}</b>.</> : ' Pick your state below.'}
          {' '}Size: <b>{SIZES[size] ?? size}</b>{!charity?.charity_size && !q.size ? ' (we do not know your size, so large organisations are left out)' : ''}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {Object.entries(SECTORS).map(([k, v]) => (
            <Link
              key={k}
              href={base + qs({ sector: k })}
              className={`border-2 border-bauhaus-black px-2 py-1 uppercase ${k === sector ? 'bg-bauhaus-black text-bauhaus-canvas' : ''}`}
            >
              {v}
            </Link>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {Object.entries(SIZES).map(([k, v]) => (
            <Link
              key={k}
              href={base + qs({ size: k })}
              className={`border-2 border-bauhaus-black px-2 py-1 uppercase ${k === size ? 'bg-bauhaus-black text-bauhaus-canvas' : ''}`}
            >
              {v}
            </Link>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {STATES.map((s) => (
            <Link
              key={s}
              href={base + qs({ state: s })}
              className={`border-2 border-bauhaus-black px-2 py-1 ${s === state ? 'bg-bauhaus-black text-bauhaus-canvas' : ''}`}
            >
              {s}
            </Link>
          ))}
        </div>
      </section>

      {sector && state && (
        <section className="mt-8">
          <p className="text-2xl font-black">
            {peers.length.toLocaleString()} organisations like you. {programs.length} programs funded them since {SINCE_YEAR}.
          </p>
          {programs.length === 0 && (
            <p className="mt-3">
              None of them show up in Commonwealth grant records or justice funding since {SINCE_YEAR}. That is a finding
              too: the money for this work is either not public or not reaching organisations like you. Try a neighbouring state.
            </p>
          )}
          <ol className="mt-6 space-y-4">
            {programs.slice(0, 40).map((p) => (
              <li key={p.funder + p.program} className="border-4 border-bauhaus-black p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-black">{p.program}</p>
                  <p className="text-sm font-black uppercase tracking-widest text-bauhaus-blue">{p.peersFunded} like you funded</p>
                </div>
                <p className="text-sm">
                  {p.funder} · {p.source}
                </p>
                <p className="mt-1 text-sm">
                  {p.grants} grants · typical {p.medianGrant ? money(p.medianGrant) : 'amount not recorded'} · latest{' '}
                  {p.latestYear ?? 'unknown'}
                </p>
                <ul className="mt-2 text-xs text-bauhaus-black/70">
                  {p.examples.map((e) => (
                    <li key={e.ref}>
                      <Link href={`/charities/${e.recipientAbn}`} className="underline">
                        {e.recipient}
                      </Link>
                      , {e.year}, {e.amount ? money(e.amount) : 'no amount'} <span className="text-bauhaus-black/50">({e.ref})</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}

      {sector && state && holders.length > 0 && (
        <section className="mt-10">
          <p className="text-sm font-black uppercase tracking-widest text-bauhaus-red">Who holds the money for your region</p>
          <p className="mt-2 text-xl font-black">
            {money(holderTotal)} of Commonwealth grants for {SECTORS[sector]?.toLowerCase()} was delivered in {state} since {SINCE_YEAR}.
            It went to {holders.length} organisations.
          </p>
          <p className="mt-1 text-sm">
            Ranked by what they received. Big recipients usually deliver through others, so this is who to approach about
            partnering, subcontracting or auspicing. It does not prove any of them subcontract.
          </p>
          <ol className="mt-4 border-4 border-bauhaus-black">
            {holders.slice(0, 15).map((h, i) => (
              <li key={h.abn} className={`flex flex-wrap items-baseline justify-between gap-2 p-3 ${i ? 'border-t-2 border-bauhaus-black' : ''}`}>
                <span>
                  <Link href={`/charities/${h.abn}`} className="font-black underline">{h.name}</Link>
                  {h.isPeer ? <span className="ml-2 border-2 border-bauhaus-black px-1 text-xs uppercase">like you</span> : null}
                  <span className="block text-xs text-bauhaus-black/70">mostly {h.topAgency} · latest {h.latestYear ?? 'unknown'}</span>
                </span>
                <span className="text-right">
                  <span className="font-black">{money(h.total)}</span>
                  <span className="block text-xs text-bauhaus-black/70">{h.grants} grants</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-10 border-t-4 border-bauhaus-black pt-4 text-xs text-bauhaus-black/70">
        <p className="font-black uppercase tracking-widest">How this works</p>
        <p className="mt-1">
          Main work is judged by Jev, a decision model, from each charity&apos;s own ACNC description. Only judgements at{' '}
          {Math.round(MIN_CONFIDENCE * 100)}% confidence or higher count ({labelledCount().toLocaleString()} charities judged so
          far). Grants come from GrantConnect (Commonwealth awards) and justice funding records, grant payments only, with
          totals and placeholder rows removed. Foundation grants are not yet included. Every grant shows its source reference.
        </p>
      </section>
    </main>
  );
}
