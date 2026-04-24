import { NextResponse } from 'next/server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://civicgraph.com.au';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

/**
 * RSS feed for CivicGraph investigations.
 *
 * Journalism distribution standard — every investigative outlet has an RSS
 * reader. Lets reporters subscribe without us hassling them. Feed updates
 * whenever a new report is published; existing readers see the new entry
 * within their next refresh.
 *
 * Standard RSS 2.0 + Atom self-link. No tracking pixels, no signup gate.
 */

type FeedItem = {
  slug: string;
  title: string;
  description: string;
  pubDate: string;
};

// Canonical list of investigations. Keep manually for now — investigations are
// flagship content with hand-written framing, so listing them explicitly keeps
// the feed authoritative rather than auto-discovering every report directory.
const INVESTIGATIONS: FeedItem[] = [
  {
    slug: 'consulting-class',
    title: 'The Consulting Class',
    description: '$9.1B in government contracts to seven firms. $10.5M in donations. 863:1 ROI on political giving. The donate → advise → implement pattern, firm by firm.',
    pubDate: '2026-03-27T00:00:00Z',
  },
  {
    slug: 'indigenous-proxy',
    title: 'The Indigenous Proxy Problem',
    description: '57% of Australian government funding tagged "Indigenous" flows to non-Indigenous-controlled organisations. Cross-system investigation of where the money actually lands.',
    pubDate: '2026-04-24T00:00:00Z',
  },
  {
    slug: 'board-interlocks',
    title: 'Board Interlocks',
    description: 'People sitting on multiple boards across funders, recipients, and contractors. Who is adjudicating whose funding.',
    pubDate: '2026-03-15T00:00:00Z',
  },
  {
    slug: 'big-philanthropy',
    title: 'Big Philanthropy',
    description: 'Foundation power, giving patterns, and concentration in the Australian philanthropic sector.',
    pubDate: '2026-03-10T00:00:00Z',
  },
  {
    slug: 'donor-contractors',
    title: 'Donor Contractors',
    description: 'Entities that both donate to political parties and hold government contracts. The revolving door, mapped at scale.',
    pubDate: '2026-03-05T00:00:00Z',
  },
  {
    slug: 'funding-deserts',
    title: 'Funding Deserts',
    description: 'LGAs ranked by disadvantage versus funding received. Where the money should be vs. where it actually is.',
    pubDate: '2026-02-28T00:00:00Z',
  },
  {
    slug: 'reallocation-atlas',
    title: 'Reallocation Atlas',
    description: 'How redirecting current funding flows could close service gaps in remote and disadvantaged regions.',
    pubDate: '2026-02-20T00:00:00Z',
  },
  {
    slug: 'civicgraph-thesis',
    title: 'CivicGraph Thesis',
    description: 'The full case for Australia&rsquo;s accountability atlas. Why this work matters and what the public graph makes possible.',
    pubDate: '2026-01-15T00:00:00Z',
  },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const items = INVESTIGATIONS
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${SITE_URL}/reports/${item.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/reports/${item.slug}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
      <author>ben@benjamink.com.au (A Curious Tractor)</author>
      <category>Investigation</category>
    </item>`,
    )
    .join('');

  const lastBuild = new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>CivicGraph Investigations</title>
    <link>${SITE_URL}/reports</link>
    <atom:link href="${SITE_URL}/reports/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Australia&apos;s accountability atlas. Cross-system investigations into government procurement, political donations, philanthropic flows, and the people connecting them. Built by A Curious Tractor.</description>
    <language>en-au</language>
    <copyright>A Curious Tractor. Republication welcome under attribution.</copyright>
    <managingEditor>ben@benjamink.com.au (Ben Knight)</managingEditor>
    <webMaster>ben@benjamink.com.au (Ben Knight)</webMaster>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <pubDate>${lastBuild}</pubDate>
    <ttl>60</ttl>
    <generator>CivicGraph (https://civicgraph.com.au)</generator>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
}
