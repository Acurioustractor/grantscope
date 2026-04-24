import type { Metadata } from 'next';
import { PublicFoundationReviewRoute } from '../public-review-route';

const IAN_POTTER_FOUNDATION_ID = 'b9e090e5-1672-48ff-815a-2a6314ebe033';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ian Potter Review Route | CivicGraph',
  description: 'Public review route for The Ian Potter Foundation with governance visibility, official grant history, and source-backed program memory.',
};

export default async function IanPotterReviewPage() {
  return (
    <PublicFoundationReviewRoute
      foundationId={IAN_POTTER_FOUNDATION_ID}
      heroTitle="Ian Potter Foundation review route"
      heroDescription="This public route shows Ian Potter as a grant-rich, source-backed review case. Governance visibility, official current program memory, and the historical Ian Potter grants database are now live together."
      compareTargets={[
        { id: 'd242967e-0e68-4367-9785-06cf0ec7485e', label: 'Compare Ian Potter with Snow' },
        { id: '4ee5baca-c898-4318-ae2b-d79b95379cc7', label: 'Compare Ian Potter with PRF' },
        { id: '8f8704be-d6e8-40f3-b561-ac6630ce5b36', label: 'Compare Ian Potter with Minderoo' },
      ]}
    />
  );
}
