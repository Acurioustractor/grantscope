import Dashboard from '../../reports/youth-justice/qld/sector/page';

export const metadata = {
  title: 'QLD Youth Justice — Sector Deep Dive · CivicGraph',
  description: "Live watchhouse data, $1.88B detention spend, the detention-vs-community ratio, and where the money actually flows in Queensland's youth-justice system.",
  openGraph: {
    title: "QLD Youth Justice — Where the Money, the Children, and the Evidence Go",
    description: "$1.88B detention vs $1.49B community. 91% of children in custody are First Nations. AI-assisted investigative report by CivicGraph.",
    type: 'article',
  },
};

export const dynamic = 'force-dynamic';

/**
 * Share-mode landing for the QLD Youth Justice sector deep-dive.
 * Same component as /reports/youth-justice/qld/sector — share-mode detection
 * via headers().get('x-pathname') auto-rewires toggles + breadcrumb to /share/*.
 */
export default function ShareQldYj() {
  return <Dashboard />;
}
