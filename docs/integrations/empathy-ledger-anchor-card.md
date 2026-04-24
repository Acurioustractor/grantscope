# Empathy Ledger → CivicGraph Anchor Card

How to anchor Empathy Ledger stories to a CivicGraph entity so every story
is connected to the system it sits inside.

## Why this exists

Every EL story has a human at the centre, but the human is usually acting
inside an org, a program, or a system. Anchoring the story to a CivicGraph
entity gives the reader two levers:

1. The story (EL — the why)
2. The system (CivicGraph — the how and who)

Together they are journalism. Apart they are not.

## Two ways to integrate

### Option A — Iframe embed (zero code, fastest)

Drop this into any EL story page at the bottom:

```html
<iframe
  src="https://civicgraph.com.au/embed/entity/12345678901"
  width="100%"
  height="280"
  style="border: 0; max-width: 100%;"
  title="CivicGraph entity card"
  loading="lazy"
></iframe>
```

Replace the number with the featured org's ABN (11 digits) or a CivicGraph
`gs_id` (e.g. `GS-ORG-...`). That's it. The card renders chrome-free, with
its own styling, linking out to the full dossier.

### Option B — JSON API (render in EL's own React / Svelte / whatever)

Fetch the data, render in EL's design system:

```ts
const r = await fetch(
  `https://civicgraph.com.au/api/data/entity/${abn}`,
  { next: { revalidate: 300 } } // if using Next.js; otherwise cache for 5min
);
if (r.ok) {
  const { entity, summary, url } = await r.json();
  // render however EL likes
}
```

Response shape:

```json
{
  "entity": {
    "gs_id": "GS-ORG-...",
    "canonical_name": "Sample Community Org",
    "abn": "12345678901",
    "entity_type": "charity",
    "sector": "community",
    "state": "NT",
    "lga_name": "Alice Springs",
    "is_community_controlled": true,
    "website": "https://...",
    "description": "..."
  },
  "summary": {
    "total_government_funding": 2100000,
    "contract_count": 8,
    "donation_count": 0,
    "grant_count": 3,
    "alma_intervention_count": 1,
    "year_range": { "first": 2022, "last": 2025 }
  },
  "url": "https://civicgraph.com.au/entities/GS-ORG-...",
  "embed_url": "https://civicgraph.com.au/embed/entity/12345678901"
}
```

## What EL needs to do story-side

Add an optional field to every story:

- `civicgraph_identifier` (string) — can be an ABN or a gs_id

If set, render the card (iframe or JSON+render). If unset, render nothing.
No breaking change to existing stories.

### Where to find identifiers

If the story features an org with an ABN, use the ABN. It's the most stable
identifier and EL editors can look it up on the ACNC register.

If the story features a program or project that isn't a standalone legal
entity, use the parent org's ABN. The card intentionally surfaces the org
context, not the program context.

## Constraints and rate limits

- **Rate limit:** 60 requests/minute per IP on the JSON API. The iframe
  embed is CDN-cached so doesn't hit the limit meaningfully.
- **CORS:** open (`Access-Control-Allow-Origin: *`). Public data only.
- **Cache:** 5min CDN + stale-while-revalidate 10min. Data updates daily
  from the CivicGraph pipeline, so there is no freshness concern at the
  card level.
- **Missing entity:** returns HTTP 404. The iframe renders the Next.js
  404 page (which looks out of place). Check the JSON API first if you
  want to conditionally hide the card for unknown identifiers.

## Reverse direction (CivicGraph → EL)

When CivicGraph entity pages want to show "Stories on Empathy Ledger", EL
should expose an equivalent endpoint:

```
GET https://empathyledger.{domain}/api/stories/by-entity/{identifier}
```

Returns an array of `{ title, slug, published_at, excerpt, cover_image_url }`
for stories tagged with that identifier. Implementation on the EL side is
the blocker for the reverse link — the CivicGraph side is ready to consume.

## Testing

Once deployed, verify with any real org ABN. Example test ABN (Oonchiumpa):

```
https://civicgraph.com.au/api/data/entity/53658668627
https://civicgraph.com.au/embed/entity/53658668627
```

If both return sensible data, integration is live.
