import type { Metadata } from 'next';
import { PublicFoundationReviewRoute } from '../public-review-route';

const MINDEROO_FOUNDATION_ID = '8f8704be-d6e8-40f3-b561-ac6630ce5b36';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Minderoo Review Route | CivicGraph',
  description: 'Public review route for Minderoo Foundation with governance visibility, verified grants, and source-backed year-memory.',
};

export default async function MinderooReviewPage() {
  return (
    <PublicFoundationReviewRoute
      foundationId={MINDEROO_FOUNDATION_ID}
      heroTitle="Minderoo Foundation review route"
      heroDescription="This public route shows Minderoo as a source-backed review case with governance visibility, annual-report-backed grant evidence, and current year-memory now live on the same public surface."
      compareTargets={[
        { id: 'd242967e-0e68-4367-9785-06cf0ec7485e', label: 'Compare Minderoo with Snow' },
        { id: '4ee5baca-c898-4318-ae2b-d79b95379cc7', label: 'Compare Minderoo with PRF' },
        { id: 'b9e090e5-1672-48ff-815a-2a6314ebe033', label: 'Compare Minderoo with Ian Potter' },
      ]}
    />
  );
}
