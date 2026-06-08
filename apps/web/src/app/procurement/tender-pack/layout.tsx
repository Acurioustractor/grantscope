import type { Metadata } from 'next';

// /procurement/tender-pack is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: 'Tender Intelligence Pack — CivicGraph',
  description:
    'Turn a shortlist of social and Indigenous enterprises into a tender-ready intelligence pack — verified supplier evidence, IPP/SME compliance forecast, gap analysis and policy citations.',
};

export default function TenderPackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
