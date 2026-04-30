import Dashboard from '../../reports/multicultural-sector/fecca-eccv/page';

export const metadata = {
  title: "FECCA & ECCV — Dashboard · CivicGraph",
  description: "Investigative dashboard on Australia's two anchor multicultural peak bodies. 11 sections of charts, board portfolios, contracts, grants — sourced and citation-grade.",
  openGraph: {
    title: "FECCA & ECCV — The Federation's Money Map",
    description: "Two policy bodies, two single-funder dependencies. AI-assisted investigative report by CivicGraph.",
    type: 'article',
  },
};

export const dynamic = 'force-dynamic';

/**
 * Share-mode dashboard for FECCA + ECCV.
 *
 * Same Server Component as /reports/multicultural-sector/fecca-eccv but
 * detects share-mode via headers().get('x-pathname') and:
 *   - Hides the "back to Multicultural Sector" breadcrumb
 *   - Repoints the dashboard ⇄ long-read toggle at /share/* paths
 *   - Renders org/director/recipient names as plain text instead of <Link>
 *     so visitors can't drill into /org/* pages they haven't paid for
 */
export default function ShareFeccaEccvDashboard() {
  return <Dashboard />;
}
