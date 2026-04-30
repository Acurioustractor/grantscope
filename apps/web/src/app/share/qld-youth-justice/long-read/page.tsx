import LongRead from '../../../reports/youth-justice/qld/sector/long-read/page';

export const metadata = {
  title: "QLD Youth Justice — The Federation Doesn't Want You To Read This · CivicGraph",
  description: "Live watchhouse data, $1.88B in detention spend, 91% First Nations children — what Queensland's youth-justice system actually looks like, sourced and citation-grade.",
  openGraph: {
    title: "QLD Youth Justice — Where the Money, the Children, and the Evidence Go",
    description: "$1.88B detention vs $1.49B community. 91% of children in custody are First Nations. CivicGraph long-form report.",
    type: 'article',
  },
};

export const dynamic = 'force-dynamic';

export default function ShareQldYjLongRead() {
  return <LongRead mode="share" />;
}
