import type { Metadata } from 'next';
import { getRemoteCouncils } from '@/lib/services/council-place-report';
import AtlasClient, { type CouncilPageLink } from './atlas-client';

export const metadata: Metadata = {
  title: 'The Atlas — CivicGraph',
  description:
    'One full-screen map of the place data CivicGraph holds. Every layer carries a ' +
    'plain-words account of what its number contains, the geography it is honest at, ' +
    'and what we cannot yet say.',
};

// The council-page list moves slowly; rebuild it hourly rather than per view.
export const revalidate = 3600;

export default async function AtlasPage() {
  // The remote councils that have a full /place/council/[slug] prose page —
  // the Atlas is the door, those pages stay the depth. If the lookup fails
  // the Atlas still renders; the rail just loses its deep links.
  let councilPages: CouncilPageLink[] = [];
  try {
    councilPages = (await getRemoteCouncils()).map(c => ({
      slug: c.slug,
      lgaName: c.lgaName,
      state: c.state,
    }));
  } catch {
    // Map without deep links beats no map.
  }
  return <AtlasClient councilPages={councilPages} />;
}
