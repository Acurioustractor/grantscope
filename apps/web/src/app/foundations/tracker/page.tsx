import { FoundationTrackerClient } from './tracker-client';

export const dynamic = 'force-dynamic';

export interface SavedFoundationRow {
  id: string;
  foundation_id: string;
  stars: number;
  stage: string;
  notes: string | null;
  last_contact_date: string | null;
  updated_at: string;
  foundation: {
    id: string;
    name: string;
    type: string | null;
    total_giving_annual: number | null;
    thematic_focus: string[];
    geographic_focus: string[];
    profile_confidence: string;
    enriched_at: string | null;
  };
}

export default function FoundationTrackerPage() {
  return <FoundationTrackerClient />;
}
