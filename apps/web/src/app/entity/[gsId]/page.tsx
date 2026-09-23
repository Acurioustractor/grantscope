import { permanentRedirect } from 'next/navigation';

/**
 * /entities/[gsId] is the one profile page (decided 2026-09-23, after comparing both against
 * OpenSecrets, USAspending, LittleSis and ProPublica's Nonprofit Explorer). This page duplicated it
 * in an off-system style while search results and report links pointed here. Its power profile,
 * revolving-door flag and ATO tax table moved to /entities; the rest of it (impact reports,
 * outcome metrics, policy events, charity ranking, ANAO compliance, jurisdiction context) is in
 * git history at the commit before this one.
 *
 * Sub-pages under /entity/[gsId]/ (investigate, print, funding-flow) are unchanged.
 */
export default async function EntityRedirect({ params }: { params: Promise<{ gsId: string }> }) {
  const { gsId } = await params;
  permanentRedirect(`/entities/${gsId}`);
}
