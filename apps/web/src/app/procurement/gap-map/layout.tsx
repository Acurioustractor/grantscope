import type { Metadata } from 'next';

// /procurement/gap-map is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: 'Supply Chain Gap Map — CivicGraph',
  description:
    'See exactly which LGAs your supply chain has no Indigenous or social-enterprise suppliers in, ranked against SEIFA disadvantage — to target supplier development and evidence your IPP/SME targets.',
};

export default function GapMapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
