import type { Metadata } from 'next';
import { PublicFoundationReviewRoute } from '../public-review-route';

const ECSTRA_FOUNDATION_ID = '25b80b63-416e-4aaa-b470-2f8dc6fa835f';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ECSTRA Review Route | CivicGraph',
  description: 'Public review route for ECSTRA Foundation with governance visibility, verified grants, and source-backed year-memory.',
};

export default async function EcstraReviewPage() {
  return (
    <PublicFoundationReviewRoute
      foundationId={ECSTRA_FOUNDATION_ID}
      heroTitle="ECSTRA Foundation review route"
      heroDescription="This public route shows ECSTRA as a financial capability review case with governance visibility, verified grants, and official current program memory now live together."
      compareTargets={[
        { id: 'd242967e-0e68-4367-9785-06cf0ec7485e', label: 'Compare ECSTRA with Snow' },
        { id: '4ee5baca-c898-4318-ae2b-d79b95379cc7', label: 'Compare ECSTRA with PRF' },
        { id: '8f8704be-d6e8-40f3-b561-ac6630ce5b36', label: 'Compare ECSTRA with Minderoo' },
        { id: 'b9e090e5-1672-48ff-815a-2a6314ebe033', label: 'Compare ECSTRA with Ian Potter' },
      ]}
    />
  );
}
