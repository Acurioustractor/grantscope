import Dashboard from '../../reports/multicultural-sector/page';

export const metadata = {
  title: "Multicultural Settlement Sector · CivicGraph",
  description: "22 ethnic communities councils, $X revenue, single-funder dependency. Director interlocks and procurement footprint mapped end-to-end.",
  openGraph: {
    title: "The Multicultural Settlement Sector — Federation, Funded by One Wallet",
    description: "22 organisations. 99%+ government revenue. AI-assisted investigative report by CivicGraph.",
    type: 'article',
  },
};

export const dynamic = 'force-dynamic';

/**
 * Share-mode landing for the Multicultural Settlement Sector cluster report.
 * Same Server Component as /reports/multicultural-sector — share-mode detection
 * via headers().get('x-pathname') hides the breadcrumb and renders org names
 * as plain text instead of <Link> so visitors can't drill into /org/* pages.
 */
export default function ShareMulticulturalSector() {
  return <Dashboard />;
}
