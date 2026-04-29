import { getServiceSupabase } from '@/lib/report-supabase';

export const dynamic = 'force-dynamic';

interface QualityRow {
  dataset: string;
  total_records: number;
  pct_name: number | null;
  pct_description: number | null;
  pct_website: number | null;
  pct_abn: number | null;
  pct_amount: number | null;
  pct_geo: number | null;
}

interface CrossrefRow {
  link_type: string;
  total: number;
  linked: number;
  pct_linked: number;
}

const DATASET_LABELS: Record<string, string> = {
  foundations: 'Foundations',
  grant_opportunities: 'Grants',
  acnc_charities: 'ACNC Charities',
  oric_corporations: 'ORIC Corporations',
  political_donations: 'Political Donations',
  austender_contracts: 'AusTender Contracts',
};

const LINK_LABELS: Record<string, string> = {
  'grant→foundation': 'Grant → Foundation',
  'donation→entity_match': 'Donor → Entity (ABN)',
  'donation→contract': 'Donor → Govt Contract',
  'oric→acnc': 'ORIC → ACNC Charity',
};

function pctColor(pct: number | null): string {
  if (pct === null) return 'text-bauhaus-muted/40';
  if (pct >= 90) return 'text-green-600';
  if (pct >= 60) return 'text-bauhaus-blue';
  if (pct >= 30) return 'text-bauhaus-yellow font-black';
  return 'text-bauhaus-red font-black';
}

function pctDisplay(pct: number | null): string {
  if (pct === null) return '—';
  return `${pct}%`;
}

function fmt(n: number) { return n.toLocaleString(); }

async function getData() {
  const supabase = getServiceSupabase();
  const [{ data: quality }, { data: crossref }] = await Promise.all([
    supabase.from('mv_data_quality').select('*'),
    supabase.from('mv_crossref_quality').select('*'),
  ]);
  return {
    quality: (quality || []) as QualityRow[],
    crossref: (crossref || []) as CrossrefRow[],
  };
}

export default async function DataQualityPage() {
  const { quality, crossref } = await getData();

  // Calculate overall score (average of non-null percentages across all datasets)
  const allPcts = quality.flatMap(q => [q.pct_name, q.pct_description, q.pct_website, q.pct_abn, q.pct_amount, q.pct_geo].filter(p => p !== null)) as number[];
  const overallScore = allPcts.length > 0 ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : 0;

  const totalRecords = quality.reduce((sum, q) => sum + q.total_records, 0);

  return (
    <div>
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-blue mt-4 mb-1 uppercase tracking-widest">Transparency</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          Data Quality Scorecard
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
          Live metrics on completeness and cross-referencing across {fmt(totalRecords)} records
          in {quality.length} datasets. Updated in real-time.
        </p>
      </div>

      {/* Overall Score */}
      <section className="mb-10">
        <div className="border-4 border-bauhaus-black p-8 bg-bauhaus-black text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-bauhaus-yellow uppercase tracking-widest mb-2">Overall Completeness</h2>
            <p className="text-white/70 text-sm max-w-lg">
              Average field completeness across all datasets. Measures how many records
              have the key fields populated (name, description, ABN, amounts, geography).
            </p>
          </div>
          <div className="text-6xl font-black text-bauhaus-yellow">{overallScore}%</div>
        </div>
      </section>

      {/* Dataset Quality Table */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-4 uppercase tracking-widest">Field Completeness by Dataset</h2>
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Dataset</th>
                <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Records</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Name</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Description</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Website</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">ABN</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Amount</th>
                <th className="text-center p-3 font-black uppercase tracking-widest text-xs">Geography</th>
              </tr>
            </thead>
            <tbody>
              {quality.map((q, i) => (
                <tr key={q.dataset} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-bold text-bauhaus-black">{DATASET_LABELS[q.dataset] || q.dataset}</td>
                  <td className="p-3 text-right font-mono">{fmt(q.total_records)}</td>
                  <td className={`p-3 text-center font-mono ${pctColor(q.pct_name)}`}>{pctDisplay(q.pct_name)}</td>
                  <td className={`p-3 text-center font-mono ${pctColor(q.pct_description)}`}>{pctDisplay(q.pct_description)}</td>
                  <td className={`p-3 text-center font-mono ${pctColor(q.pct_website)}`}>{pctDisplay(q.pct_website)}</td>
                  <td className={`p-3 text-center font-mono ${pctColor(q.pct_abn)}`}>{pctDisplay(q.pct_abn)}</td>
                  <td className={`p-3 text-center font-mono ${pctColor(q.pct_amount)}`}>{pctDisplay(q.pct_amount)}</td>
                  <td className={`p-3 text-center font-mono ${pctColor(q.pct_geo)}`}>{pctDisplay(q.pct_geo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-bauhaus-muted mt-2">
          Colour key: <span className="text-green-600 font-bold">90%+</span> |{' '}
          <span className="text-bauhaus-blue font-bold">60-89%</span> |{' '}
          <span className="text-bauhaus-yellow font-bold">30-59%</span> |{' '}
          <span className="text-bauhaus-red font-bold">&lt;30%</span> |{' '}
          <span className="text-bauhaus-muted/40">— not applicable</span>
        </p>
      </section>

      {/* Cross-Reference Quality */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-4 uppercase tracking-widest">Cross-Reference Linkage</h2>
        <p className="text-sm text-bauhaus-muted mb-4 max-w-2xl">
          The power of open data comes from connecting datasets. These metrics show how well
          we link records across sources using ABN matching and entity resolution.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
          {crossref.map((c, i) => (
            <div key={c.link_type} className={`border-4 border-bauhaus-black p-6 bg-white ${i % 2 === 1 ? 'sm:border-l-0' : ''} ${i >= 2 ? 'border-t-0' : ''}`}>
              <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
                {LINK_LABELS[c.link_type] || c.link_type}
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                <span className={`text-3xl font-black ${Number(c.pct_linked) >= 30 ? 'text-bauhaus-blue' : 'text-bauhaus-red'}`}>
                  {Number(c.pct_linked)}%
                </span>
                <span className="text-sm text-bauhaus-muted">
                  {fmt(c.linked)} of {fmt(c.total)} linked
                </span>
              </div>
              <div className="w-full bg-gray-100 h-2">
                <div
                  className={`h-2 ${Number(c.pct_linked) >= 30 ? 'bg-bauhaus-blue' : 'bg-bauhaus-red'}`}
                  style={{ width: `${Math.min(Number(c.pct_linked), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-8">
        <div className="border-4 border-bauhaus-black p-8 bg-white">
          <h2 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest">Methodology</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-bauhaus-muted">
            <div>
              <h3 className="font-black text-bauhaus-black mb-2">Field Completeness</h3>
              <p className="leading-relaxed mb-2">
                Each cell shows the percentage of records with a non-null, non-empty value
                for that field. Cells marked &ldquo;—&rdquo; indicate fields that don&apos;t apply
                to that dataset (e.g., charities don&apos;t have &ldquo;amount&rdquo;).
              </p>
              <p className="leading-relaxed">
                Computed from materialized views refreshed on data updates.
                No sampling — every record is counted.
              </p>
            </div>
            <div>
              <h3 className="font-black text-bauhaus-black mb-2">Cross-Reference Linkage</h3>
              <p className="leading-relaxed mb-2">
                Entity resolution uses normalised name matching against the ASIC company register
                (2.1M entities) and ACNC charity register (64K entities). Names are normalised by
                stripping PTY/LTD/CORPORATION/trustee suffixes, case-folding, and removing punctuation.
              </p>
              <p className="leading-relaxed">
                The Australian Business Number (ABN) serves as the universal join key
                across all government datasets.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
