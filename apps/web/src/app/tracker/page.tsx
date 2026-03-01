import { TrackerClient } from './tracker-client';

export const dynamic = 'force-dynamic';

export interface SavedGrantRow {
  id: string;
  grant_id: string;
  stars: number;
  color: string | null;
  stage: string;
  notes: string | null;
  ghl_opportunity_id: string | null;
  updated_at: string;
  grant: {
    id: string;
    name: string;
    provider: string;
    amount_min: number | null;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[];
    url: string | null;
    status: string;
  };
}

export default function TrackerPage() {
  return <TrackerClient />;
}
