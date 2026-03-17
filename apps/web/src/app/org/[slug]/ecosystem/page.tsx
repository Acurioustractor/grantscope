import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getOrgProfileBySlug,
  getOrgEntity,
  getOrgLocalEcosystem,
} from '@/lib/services/org-dashboard-service';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getOrgProfileBySlug(slug);
  if (!profile) return { title: 'Not Found' };
  return { title: `Local Ecosystem — ${profile.name} — CivicGraph` };
}

const TH = 'text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
const TD = 'py-3 pr-4';
const THEAD = 'border-b-2 border-gray-200 bg-gray-50/50 sticky top-0 z-10';
const ROW = (i: number) =>
  `border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`;

export default async function EcosystemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await getOrgProfileBySlug(slug);
  if (!profile || !profile.abn) notFound();

  const entity = await getOrgEntity(profile.abn);
  if (!entity) notFound();

  const result = await getOrgLocalEcosystem(profile.abn, entity.postcode, entity.lga_name, 1000);
  const entities = result?.entities ?? [];
  const total = result?.total ?? 0;

  // Group by entity_type for summary
  const typeCounts: Record<string, number> = {};
  for (const e of entities) {
    typeCounts[e.entity_type] = (typeCounts[e.entity_type] ?? 0) + 1;
  }
  const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Link href={`/org/${slug}`} className="text-xs text-gray-400 hover:text-white uppercase tracking-wider">
            &larr; Back to {profile.name}
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-wider mt-2">
            Local Ecosystem — {entity.lga_name || entity.postcode}
          </h1>
          <p className="mt-1 text-gray-400">
            {total.toLocaleString()} entities in the same area as {profile.name}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Type summary chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {typeEntries.map(([type, count]) => (
            <span key={type} className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-sm shadow-sm">
              <span className="font-bold">{count}</span>
              <span className="text-gray-400 ml-1.5">{type}</span>
            </span>
          ))}
        </div>

        {/* Full table */}
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className={THEAD}>
                <tr>
                  <th className={`${TH} pl-4 w-[5%]`}>#</th>
                  <th className={`${TH} w-[40%]`}>Entity</th>
                  <th className={`${TH} w-[15%]`}>Type</th>
                  <th className={`${TH} w-[25%]`}>Sector</th>
                  <th className={`${TH} w-[15%]`}>ABN</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((e, i) => (
                  <tr key={i} className={ROW(i)}>
                    <td className={`${TD} pl-4 text-gray-300 text-xs`}>{i + 1}</td>
                    <td className={`${TD} font-medium`}>
                      <Link href={`/entity/${encodeURIComponent(e.gs_id)}`} className="text-bauhaus-blue hover:underline">
                        {e.canonical_name}
                      </Link>
                    </td>
                    <td className={TD}>
                      <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-sm border border-gray-200">
                        {e.entity_type}
                      </span>
                    </td>
                    <td className={`${TD} text-gray-500 text-xs`}>{e.sector || '—'}</td>
                    <td className={`${TD} text-gray-400 font-mono text-xs`}>
                      <Link href={`/entity/${encodeURIComponent(e.gs_id)}`} className="hover:text-bauhaus-blue hover:underline">
                        {e.abn?.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4') || '—'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 text-xs text-gray-400">
            Showing {entities.length} of {total.toLocaleString()} entities
          </div>
        </div>
      </div>
    </main>
  );
}
