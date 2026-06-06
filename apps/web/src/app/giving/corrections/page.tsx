import { GivingHeader, GivingSubnav } from '../_components';
import CorrectionForm from './CorrectionForm';

export const metadata = {
  title: 'Corrections | Australian Giving Data Commons',
  description: 'Correction and right-of-reply form for public CivicGraph giving data.',
};

export default async function GivingCorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ target_type?: string; target_id?: string; claim_url?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div>
      <GivingHeader kicker="Corrections and right-of-reply" title="Challenge the record.">
        Public data needs a public repair path. Submit a correction, evidence link or right-of-reply against any dataset, record, insight card or public claim.
      </GivingHeader>
      <GivingSubnav />

      <div className="grid lg:grid-cols-[1fr_0.7fr] gap-8">
        <CorrectionForm
          targetType={sp.target_type}
          targetId={sp.target_id}
          claimUrl={sp.claim_url}
        />
        <aside className="space-y-5">
          <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black mb-2">What to include</div>
            <ul className="space-y-2 text-sm font-medium text-bauhaus-black leading-relaxed">
              <li><span className="font-black mr-1">+</span>The exact claim, record ID or URL.</li>
              <li><span className="font-black mr-1">+</span>What should change.</li>
              <li><span className="font-black mr-1">+</span>Evidence URL, document title, date or page reference.</li>
              <li><span className="font-black mr-1">+</span>Whether this is a correction or a right-of-reply.</li>
            </ul>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mb-2">Privacy</div>
            <p className="text-sm font-medium text-bauhaus-muted leading-relaxed">
              Contact details are for verification and are not part of the public export. The public commons does not export CRM, workspace, saved tracker, private note, billing, contact or internal operations tables.
            </p>
          </div>
          <div className="border-4 border-bauhaus-black bg-white p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-blue mb-2">API</div>
            <code className="block text-xs font-mono text-bauhaus-black break-all">
              POST /api/data/corrections
            </code>
          </div>
        </aside>
      </div>
    </div>
  );
}
