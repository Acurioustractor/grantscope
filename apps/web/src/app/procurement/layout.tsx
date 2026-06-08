import type { Metadata } from 'next';

// /procurement is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: 'Procurement Compliance Dashboard — CivicGraph',
  description:
    'Upload your supplier ledger to instantly see IPP and SME compliance, gap calculations, supplier recommendations and black-cladding risk — powered by 143K entities and 754K contracts.',
};

export default function ProcurementLayout({ children }: { children: React.ReactNode }) {
  return children;
}
