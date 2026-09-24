import type { ReactNode } from 'react';

/** A titled box in a 4px black frame: identity, focus areas, financials. DESIGN.md "Cards". */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-4 border-bauhaus-black bg-white p-4">
      <h3 className="mb-3 border-b-4 border-bauhaus-black pb-2 text-sm font-black uppercase tracking-widest text-bauhaus-black">
        {title}
      </h3>
      {children}
    </div>
  );
}

export interface Fact {
  label: string;
  value: ReactNode;
  /** Identifiers (GS ID, ABN, ACN) read better in the code face. */
  mono?: boolean;
}

/** Label/value pairs. Rows with an empty value are skipped, so callers can pass optional fields as they are. */
export function FactList({ facts }: { facts: Fact[] }) {
  const shown = facts.filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
  return (
    <dl className="space-y-2">
      {shown.map((f) => (
        <div key={f.label}>
          <dt className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">{f.label}</dt>
          <dd className={`text-sm font-bold text-bauhaus-black ${f.mono ? 'font-mono' : ''}`}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
