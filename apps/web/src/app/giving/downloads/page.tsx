import { PUBLIC_DATASET_KEYS, PUBLIC_DATASETS, PUBLIC_SNAPSHOT_DATE } from '@/lib/giving-commons';
import { DownloadLinks, GivingHeader, GivingSubnav } from '../_components';

export const metadata = {
  title: 'Downloads | Australian Giving Data Commons',
  description: 'Free CSV and JSON downloads for the public Australian Giving Data Commons allowlist.',
};

export default function GivingDownloadsPage() {
  return (
    <div>
      <GivingHeader kicker="Downloads" title="CSV and JSON, no login.">
        Public-record and low/no-PII datasets only. Private workspace, CRM, saved tracker, notes, billing, contact and internal ops tables are excluded.
      </GivingHeader>
      <GivingSubnav />

      <div className="mb-4 text-xs font-black uppercase tracking-widest text-bauhaus-muted">
        Snapshot date <span className="font-mono text-bauhaus-black">{PUBLIC_SNAPSHOT_DATE}</span>
      </div>

      <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bauhaus-black text-white">
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Dataset</th>
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Source</th>
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Licence</th>
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Caveat</th>
              <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Download</th>
            </tr>
          </thead>
          <tbody>
            {PUBLIC_DATASET_KEYS.map((key, index) => {
              const dataset = PUBLIC_DATASETS[key];
              return (
                <tr key={key} className={index % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                  <td className="p-3 align-top">
                    <div className="font-black text-bauhaus-black">{dataset.label}</div>
                    <div className="font-mono text-xs text-bauhaus-muted">{key}</div>
                  </td>
                  <td className="p-3 align-top text-bauhaus-black font-medium min-w-64">{dataset.source}</td>
                  <td className="p-3 align-top text-bauhaus-muted font-medium min-w-56">{dataset.licence}</td>
                  <td className="p-3 align-top text-bauhaus-muted font-medium min-w-72">{dataset.caveats[0]}</td>
                  <td className="p-3 align-top min-w-32"><DownloadLinks type={key} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
