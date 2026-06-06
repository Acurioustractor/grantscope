import { GIVING_STANDARD, PUBLIC_DATASET_KEYS, PUBLIC_DATASETS } from '@/lib/giving-commons';
import { GivingHeader, GivingSubnav } from '../_components';

export const metadata = {
  title: 'Standard | Australian Giving Data Commons',
  description: 'Australian Giving Data Standard v0.1 data dictionary and publishing shape.',
};

export default function GivingStandardPage() {
  return (
    <div>
      <GivingHeader kicker="Data standard" title="Australian Giving Data Standard v0.1">
        A practical publishing shape for Australian giving data: source, licence, caveat and correction path travel with the record.
      </GivingHeader>
      <GivingSubnav />

      <section className="grid lg:grid-cols-[0.8fr_1fr] gap-6 mb-10">
        <div className="border-4 border-bauhaus-black bg-bauhaus-black text-white p-6">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-yellow mb-2">Purpose</div>
          <p className="text-lg font-medium leading-relaxed">{GIVING_STANDARD.purpose}</p>
          <div className="mt-5 text-xs font-mono text-white/70">schema_version: {GIVING_STANDARD.schema_version}</div>
        </div>
        <div className="border-4 border-bauhaus-black bg-white p-6">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-3">Principles</div>
          <ul className="grid sm:grid-cols-2 gap-3">
            {GIVING_STANDARD.principles.map((principle) => (
              <li key={principle} className="border-2 border-bauhaus-black bg-bauhaus-canvas p-3 text-sm font-black text-bauhaus-black">
                {principle}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black mb-4">Required record metadata</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {GIVING_STANDARD.required_dataset_fields.map((field) => (
            <div key={field} className="border-4 border-bauhaus-black bg-white p-4 font-mono text-sm text-bauhaus-black">
              {field}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black mb-4">Record types</h2>
        <div className="border-4 border-bauhaus-black bg-white divide-y-4 divide-bauhaus-black/10">
          {GIVING_STANDARD.record_types.map((record) => (
            <div key={record.type} className="p-4">
              <div className="text-lg font-black text-bauhaus-black">{record.type}</div>
              <p className="text-sm font-medium text-bauhaus-muted leading-relaxed">{record.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black mb-4">Dataset fields</h2>
        <div className="grid gap-4">
          {PUBLIC_DATASET_KEYS.map((key) => (
            <details key={key} className="border-4 border-bauhaus-black bg-white p-4">
              <summary className="cursor-pointer text-lg font-black text-bauhaus-black uppercase tracking-tight">
                {PUBLIC_DATASETS[key].label}
              </summary>
              <div className="mt-4 flex flex-wrap gap-2">
                {PUBLIC_DATASETS[key].select.split(',').map((field) => (
                  <span key={field.trim()} className="px-2 py-1 border-2 border-bauhaus-black bg-bauhaus-canvas text-xs font-mono text-bauhaus-black">
                    {field.trim()}
                  </span>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
