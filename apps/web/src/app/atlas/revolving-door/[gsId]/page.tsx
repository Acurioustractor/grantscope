import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRevolvingDoorByGsId } from '@/lib/atlas/revolving-door';
import { money, moneyFull, num } from '@/lib/atlas/format';

export const revalidate = 3600;

type Params = { gsId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { gsId } = await params;
  const row = await getRevolvingDoorByGsId(gsId);
  if (!row) return { title: 'Entity not found — CivicGraph Atlas' };
  return {
    title: `${row.canonical_name} — Revolving Door Profile — CivicGraph`,
    description: `${row.influence_vectors} influence vectors · Score ${row.revolving_door_score} · ${money(row.total_donated + row.total_contracts + row.total_funded)} total footprint`,
  };
}

export default async function RevolvingDoorEntityPage({ params }: { params: Promise<Params> }) {
  const { gsId } = await params;
  const row = await getRevolvingDoorByGsId(gsId);
  if (!row) notFound();

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/atlas/revolving-door" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Revolving Door
        </Link>

        <header className="mt-4 mb-10 border-b-4 border-bauhaus-black pb-8">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">
            {row.entity_type ?? 'Entity'} · {row.state ?? '—'}{row.lga_name ? ` · ${row.lga_name}` : ''}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-bauhaus-black leading-none">
            {row.canonical_name}
          </h1>
          <div className="mt-3 text-sm font-mono text-bauhaus-muted">
            ABN {row.abn ?? '—'} · GS-ID {row.gs_id}
          </div>
          <div className="mt-4 inline-flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-widest">Score</span>
            <span className="inline-block px-3 py-1 font-black text-white text-2xl bg-bauhaus-red">
              {row.revolving_door_score}
            </span>
            <span className="text-xs font-medium text-bauhaus-muted">{row.influence_vectors} of 4 vectors active</span>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <VectorCard active={row.lobbies} label="Lobbying" detail="Federal register" />
          <VectorCard active={row.donates} label="Donations" detail={`${num(row.donation_count)} records · ${money(row.total_donated)}`} />
          <VectorCard active={row.contracts} label="Contracts" detail={`${num(row.contract_count)} contracts · ${num(row.distinct_buyers)} buyers · ${money(row.total_contracts)}`} />
          <VectorCard active={row.receives_funding} label="Funding" detail={`${num(row.funding_count)} records · ${money(row.total_funded)}`} />
        </section>

        {row.donates && (
          <section className="mb-10 bg-white border-4 border-bauhaus-black p-6 shadow-[8px_8px_0_0_#121212]">
            <h2 className="text-sm font-black uppercase tracking-widest mb-4">Political donations</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div><dt className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Total donated</dt><dd className="text-xl font-black mt-1">{moneyFull(row.total_donated)}</dd></div>
              <div><dt className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Records</dt><dd className="text-xl font-black mt-1">{num(row.donation_count)}</dd></div>
              <div><dt className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Parties funded</dt><dd className="text-sm font-medium mt-1">{row.parties_funded.length > 0 ? row.parties_funded.join(', ') : '—'}</dd></div>
            </dl>
            <div className="mt-4 text-xs font-medium text-bauhaus-muted">
              Source: AEC Annual Returns. <Link href="/entity/{row.gs_id}" className="text-bauhaus-blue hover:underline">Open full entity record &rarr;</Link>
            </div>
          </section>
        )}

        {row.contracts && (
          <section className="mb-10 bg-white border-4 border-bauhaus-black p-6 shadow-[8px_8px_0_0_#121212]">
            <h2 className="text-sm font-black uppercase tracking-widest mb-4">Government contracts</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div><dt className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Total value</dt><dd className="text-xl font-black mt-1">{moneyFull(row.total_contracts)}</dd></div>
              <div><dt className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Contracts</dt><dd className="text-xl font-black mt-1">{num(row.contract_count)}</dd></div>
              <div><dt className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Distinct buyers</dt><dd className="text-xl font-black mt-1">{num(row.distinct_buyers)}</dd></div>
            </dl>
            <div className="mt-4 text-xs font-medium text-bauhaus-muted">Source: AusTender. Updated nightly.</div>
          </section>
        )}

        {row.receives_funding && (
          <section className="mb-10 bg-white border-4 border-bauhaus-black p-6 shadow-[8px_8px_0_0_#121212]">
            <h2 className="text-sm font-black uppercase tracking-widest mb-4">Government funding received</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div><dt className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Total received</dt><dd className="text-xl font-black mt-1">{moneyFull(row.total_funded)}</dd></div>
              <div><dt className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">Records</dt><dd className="text-xl font-black mt-1">{num(row.funding_count)}</dd></div>
            </dl>
            <div className="mt-4 text-xs font-medium text-bauhaus-muted">Source: justice_funding + linked grant streams.</div>
          </section>
        )}

        <section className="mt-10 bg-white border-4 border-bauhaus-black p-6">
          <h2 className="text-sm font-black uppercase tracking-widest mb-3">Cite + download</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <a
              href={`/api/v1/public/entity/${row.abn ?? ''}`}
              className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue hover:text-white"
            >
              JSON
            </a>
            <Link
              href="/atlas/revolving-door/methodology"
              className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Methodology
            </Link>
          </div>
          <p className="text-xs font-medium text-bauhaus-muted leading-relaxed">
            CivicGraph (2026). {row.canonical_name} — Revolving Door Profile. Retrieved from
            https://civicgraph.au/atlas/revolving-door/{row.gs_id}
          </p>
        </section>
      </div>
    </div>
  );
}

function VectorCard({ active, label, detail }: { active: boolean; label: string; detail: string }) {
  return (
    <div className={`border-4 p-5 shadow-[8px_8px_0_0_#121212] ${active ? 'bg-bauhaus-red text-white border-bauhaus-red' : 'bg-white text-bauhaus-muted border-bauhaus-black'}`}>
      <div className="text-[11px] font-black uppercase tracking-widest">{label}</div>
      <div className={`mt-2 text-2xl font-black ${active ? 'text-white' : 'text-bauhaus-muted/30'}`}>
        {active ? 'YES' : 'NO'}
      </div>
      <div className="mt-2 text-xs font-medium leading-snug">{detail}</div>
    </div>
  );
}
