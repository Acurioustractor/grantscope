import { PUBLIC_DATASET_KEYS, PUBLIC_DATASETS } from '@/lib/giving-commons';
import { GivingHeader, GivingSubnav } from '../_components';

export const metadata = {
  title: 'Sources | Australian Giving Data Commons',
  description: 'Source, licence and provenance table for the public Australian Giving Data Commons.',
};

export default function GivingSourcesPage() {
  return (
    <div>
      <GivingHeader kicker="Sources and licences" title="Know where every dataset came from.">
        This is the public provenance table: source owner, source URL, collection method, cadence, licence posture and caveats.
      </GivingHeader>
      <GivingSubnav />

      <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bauhaus-black text-white">
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Dataset</th>
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Source owner</th>
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Collection</th>
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Cadence</th>
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Licence</th>
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Caveats</th>
            </tr>
          </thead>
          <tbody>
            {PUBLIC_DATASET_KEYS.map((key, index) => {
              const dataset = PUBLIC_DATASETS[key];
              return (
                <tr key={key} className={index % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                  <td className="p-3 align-top min-w-56">
                    <div className="font-black text-bauhaus-black">{dataset.label}</div>
                    <a href={dataset.sourceUrl} className="font-mono text-xs text-bauhaus-blue hover:text-bauhaus-red break-all">
                      {dataset.sourceUrl}
                    </a>
                  </td>
                  <td className="p-3 align-top min-w-56 text-bauhaus-black font-medium">{dataset.sourceOwner}</td>
                  <td className="p-3 align-top min-w-72 text-bauhaus-muted font-medium">{dataset.collectionMethod}</td>
                  <td className="p-3 align-top min-w-44 text-bauhaus-muted font-medium">{dataset.updateCadence}</td>
                  <td className="p-3 align-top min-w-64 text-bauhaus-muted font-medium">{dataset.licence}</td>
                  <td className="p-3 align-top min-w-80">
                    <ul className="space-y-2">
                      {dataset.caveats.map((caveat) => (
                        <li key={caveat} className="text-bauhaus-muted font-medium leading-relaxed">
                          <span className="font-black text-bauhaus-red mr-1">+</span>{caveat}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
