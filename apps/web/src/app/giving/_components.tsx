import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  COMMONS_INSIGHTS,
  COMMONS_NAV,
  PUBLIC_DATASETS,
  PUBLIC_SNAPSHOT_DATE,
  type PublicDatasetKey,
} from '@/lib/giving-commons';

export function GivingHeader({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-8">
      <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">CivicGraph</Link>
      <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">{kicker}</div>
      <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-4 uppercase tracking-tight leading-tight">
        {title}
      </h1>
      <div className="text-lg sm:text-xl text-bauhaus-muted leading-tight font-medium max-w-4xl">
        {children}
      </div>
    </div>
  );
}

export function GivingSubnav() {
  return (
    <nav className="mb-10 border-4 border-bauhaus-black bg-white overflow-x-auto" aria-label="Giving data commons">
      <div className="flex min-w-max">
        {COMMONS_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-4 py-3 border-r-4 last:border-r-0 border-bauhaus-black text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-yellow"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function DownloadLinks({ type }: { type: PublicDatasetKey }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`/api/data/export?type=${type}&format=csv&limit=10000`}
        className="px-3 py-2 border-2 border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-white"
      >
        CSV
      </a>
      <a
        href={`/api/data/export?type=${type}&format=json&limit=10000`}
        className="px-3 py-2 border-2 border-bauhaus-black bg-white text-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-yellow"
      >
        JSON
      </a>
    </div>
  );
}

export function InsightCard({ insight }: { insight: (typeof COMMONS_INSIGHTS)[number] }) {
  const dataset = PUBLIC_DATASETS[insight.datasetType];
  return (
    <article className="border-4 border-bauhaus-black bg-white flex flex-col">
      <div className="bg-bauhaus-black text-white border-b-4 border-bauhaus-black p-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-2">{insight.kicker}</div>
        <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">{insight.title}</h3>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <p className="text-sm font-medium text-bauhaus-black leading-relaxed mb-5">{insight.summary}</p>
        <dl className="grid gap-3 text-xs mt-auto">
          <div>
            <dt className="font-black uppercase tracking-widest text-bauhaus-muted">Source</dt>
            <dd className="font-mono text-bauhaus-black break-words">{insight.source}</dd>
          </div>
          <div>
            <dt className="font-black uppercase tracking-widest text-bauhaus-muted">Run date</dt>
            <dd className="font-mono text-bauhaus-black">{PUBLIC_SNAPSHOT_DATE}</dd>
          </div>
          <div>
            <dt className="font-black uppercase tracking-widest text-bauhaus-muted">Caveat</dt>
            <dd className="text-bauhaus-black font-medium leading-relaxed">{insight.caveat}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={`/api/data/export?type=${insight.datasetType}&format=csv&limit=10000`}
            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest bg-bauhaus-red text-white border-2 border-bauhaus-black hover:bg-bauhaus-black"
          >
            Download {dataset.label}
          </a>
          <Link
            href={`/giving/corrections?target_type=insight&target_id=${insight.id}`}
            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest bg-white text-bauhaus-black border-2 border-bauhaus-black hover:bg-bauhaus-yellow"
          >
            Correct or reply
          </Link>
        </div>
      </div>
    </article>
  );
}

export function MethodBand({ children }: { children: ReactNode }) {
  return (
    <section className="border-4 border-bauhaus-black bg-bauhaus-canvas p-6 sm:p-8 mb-10">
      {children}
    </section>
  );
}
