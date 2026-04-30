import LongRead from '../../../reports/multicultural-sector/fecca-eccv/long-read/page';

export const metadata = {
  title: "FECCA & ECCV — The Federation's Money Map · CivicGraph",
  description: "An investigative deep-dive on Australia's two anchor multicultural peak bodies. Audited financials, federal procurement, state grants, board interlocks. Sourced and citation-grade.",
  openGraph: {
    title: "FECCA & ECCV — The Federation's Money Map",
    description: "Two policy bodies, two single-funder dependencies. $1B of federal multicultural procurement they don't see. AI-assisted investigative report by CivicGraph.",
    type: 'article',
  },
};

export const dynamic = 'force-dynamic';

/**
 * Share landing for the FECCA + ECCV deep-dive.
 *
 * Renders the same long-read content that lives at
 * /reports/multicultural-sector/fecca-eccv/long-read but under /share/* so:
 *   1. The root layout strips the global NavBar and dense footer
 *   2. The /share/layout.tsx wraps it in a minimal "How it works · First 5
 *      Free · Get a Report" bar that routes only to the conversion funnel
 *   3. The recipient never sees /graph, /tracker, /reports nav, etc.
 *
 * Use this URL when you want to send a report to a non-customer (LinkedIn,
 * email, partner intro). Use the /reports/... URL internally.
 */
export default function ShareFeccaEccv() {
  return <LongRead mode="share" />;
}
