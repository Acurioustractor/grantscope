import { PUBLIC_DATASET_KEYS, PUBLIC_DATASETS } from '@/lib/giving-commons';
import { GivingHeader, GivingSubnav } from '../_components';

export const metadata = {
  title: 'API | Australian Giving Data Commons',
  description: 'Read-only public API documentation for Australian giving data.',
};

const examples = [
  ['/api/data?type=grants&limit=2', 'Read two grant records with source and caveat metadata.'],
  ['/api/data?type=foundations&focus=indigenous&limit=10', 'Find foundations tagged to a focus area.'],
  ['/api/data?type=places&state=QLD&limit=10', 'Read postcode-level place funding aggregates.'],
  ['/api/data/export?type=grants&format=csv&limit=1000', 'Download public grant records as CSV.'],
  ['/api/data/export?type=contracts&format=json&limit=100', 'Download public AusTender contract records as JSON.'],
  ['/api/data/standard', 'Read the v0.1 data dictionary.'],
  ['/api/data/sources', 'Read source, licence and provenance metadata.'],
];

export default function GivingApiPage() {
  return (
    <div>
      <GivingHeader kicker="Read-only API" title="Use the commons in your own tools.">
        The public API is free, rate-limited and read-only. Each response includes schema version, source, generation time, licence, caveats and correction URL.
      </GivingHeader>
      <GivingSubnav />

      <section className="grid lg:grid-cols-[1fr_0.8fr] gap-6 mb-10">
        <div className="border-4 border-bauhaus-black bg-white p-6">
          <h2 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black mb-4">Response envelope</h2>
          <pre className="overflow-x-auto border-4 border-bauhaus-black bg-bauhaus-black text-bauhaus-yellow p-4 text-xs leading-relaxed">
{`{
  "schema_version": "agdc-0.1",
  "source": "CivicGraph public data API",
  "generated_at": "2026-06-01T00:00:00.000Z",
  "licence": "Mixed public-source licences...",
  "caveats": ["Read source-specific caveats..."],
  "correction_url": "https://.../giving/corrections",
  "type": "grants",
  "limit": 2,
  "offset": 0,
  "data": []
}`}
          </pre>
        </div>
        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-6">
          <h2 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black mb-3">Rate limits</h2>
          <p className="text-sm font-medium text-bauhaus-black leading-relaxed">
            Anonymous reads use the public limits already enforced by the CivicGraph API. Public exports are limited separately so downloads stay usable for everyone.
          </p>
          <p className="text-sm font-medium text-bauhaus-black leading-relaxed mt-3">
            Anything outside the public allowlist remains behind the existing authenticated research export path.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black mb-4">Examples</h2>
        <div className="border-4 border-bauhaus-black bg-white divide-y-4 divide-bauhaus-black/10">
          {examples.map(([href, description]) => (
            <a key={href} href={href} className="block p-4 hover:bg-bauhaus-canvas">
              <code className="block text-sm font-mono text-bauhaus-blue break-all">{href}</code>
              <p className="text-sm font-medium text-bauhaus-muted mt-1">{description}</p>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black mb-4">Public types</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {PUBLIC_DATASET_KEYS.map((key) => (
            <div key={key} className="border-4 border-bauhaus-black bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">{PUBLIC_DATASETS[key].domain}</div>
              <div className="text-lg font-black text-bauhaus-black">{key}</div>
              <p className="text-xs font-medium text-bauhaus-muted leading-relaxed mt-2">{PUBLIC_DATASETS[key].description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
