import type { Metadata } from 'next';
import { PublicFoundationReviewRoute } from '../public-review-route';

const RIO_TINTO_FOUNDATION_ID = '85f0de43-d004-4122-83a6-287eeecc4da9';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rio Tinto Review Route | CivicGraph',
  description: 'Public review route for Rio Tinto Foundation with governance visibility, verified grants, and source-backed year-memory.',
};

export default async function RioTintoReviewPage() {
  return (
    <PublicFoundationReviewRoute
      foundationId={RIO_TINTO_FOUNDATION_ID}
      heroTitle="Rio Tinto Foundation review route"
      heroDescription="This public route shows Rio Tinto as a corporate-foundation review case with named board visibility, a first verified grant layer, and source-backed current program memory across community, Indigenous, and partnership surfaces."
      compareTargets={[
        { id: 'd242967e-0e68-4367-9785-06cf0ec7485e', label: 'Compare Rio Tinto with Snow' },
        { id: '4ee5baca-c898-4318-ae2b-d79b95379cc7', label: 'Compare Rio Tinto with PRF' },
        { id: '8f8704be-d6e8-40f3-b561-ac6630ce5b36', label: 'Compare Rio Tinto with Minderoo' },
        { id: 'b9e090e5-1672-48ff-815a-2a6314ebe033', label: 'Compare Rio Tinto with Ian Potter' },
        { id: '25b80b63-416e-4aaa-b470-2f8dc6fa835f', label: 'Compare Rio Tinto with ECSTRA' },
      ]}
    />
  );
}
