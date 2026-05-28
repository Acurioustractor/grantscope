import Link from 'next/link';

export const metadata = {
  title: 'Public API — CivicGraph',
  description: 'Free public API for Australian funding-flow and influence-network data. Rate-limited, CC-BY licensed.',
};

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/atlas" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; Atlas
        </Link>

        <header className="mt-4 mb-10 border-b-4 border-bauhaus-black pb-6">
          <div className="inline-block bg-bauhaus-blue text-white px-3 py-1 text-xs font-black uppercase tracking-widest mb-3">
            Public API · v1
          </div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-tight text-bauhaus-black leading-none">
            CivicGraph<br />Public API
          </h1>
          <p className="mt-4 text-base font-medium text-bauhaus-black max-w-2xl">
            Free, rate-limited (60 req/min per IP), CC-BY 4.0 licensed. No API key required for the
            public endpoints. Higher tiers available for journalists and researchers — get in touch.
          </p>
        </header>

        <Section heading="Endpoints">
          <Endpoint
            method="GET"
            path="/api/v1/public/funding-deserts"
            description="LGA-level disadvantage vs funding-flow score. Filter by state, remoteness, decile."
          />
          <Endpoint
            method="GET"
            path="/api/v1/public/revolving-door"
            description="Entities active across 2+ influence vectors (lobbying, donations, contracts, funding)."
          />
          <Endpoint
            method="GET"
            path="/api/v1/public/entity/{abn}"
            description="Entity profile by ABN — registry data + revolving-door + power-index summary."
          />
          <Endpoint
            method="GET"
            path="/api/v1/public/grants"
            description="Open grant opportunities. Filter by category, amount, DGR-requirement."
          />
          <Endpoint
            method="GET"
            path="/api/v1/public/openapi.json"
            description="Full OpenAPI 3.0 specification."
          />
        </Section>

        <Section heading="curl examples">
          <CodeBlock>{`# Top 10 worst funding deserts in NT
curl 'https://civicgraph.au/api/v1/public/funding-deserts?state=NT&limit=10'

# Top 25 revolving-door entities in NSW
curl 'https://civicgraph.au/api/v1/public/revolving-door?state=NSW&limit=25'

# Entity profile by ABN
curl 'https://civicgraph.au/api/v1/public/entity/12345678901'

# Open grants requiring DGR status, max amount $500K+
curl 'https://civicgraph.au/api/v1/public/grants?dgr_required=true&min_amount=500000'`}</CodeBlock>
        </Section>

        <Section heading="Python notebook (pandas)">
          <CodeBlock>{`import requests
import pandas as pd

# Pull the top 100 funding deserts as a DataFrame
r = requests.get('https://civicgraph.au/api/v1/public/funding-deserts',
                 params={'limit': 100, 'sort': 'desert_score'})
r.raise_for_status()
payload = r.json()

df = pd.DataFrame(payload['data'])
print(f"Source: {payload['meta']['source']}")
print(f"Generated: {payload['meta']['generated_at']}")
print(df[['lga_name', 'state', 'desert_score', 'total_funding', 'indexed_entities']].head(20))

# Methodology link
print(payload['meta']['methodology'])`}</CodeBlock>
        </Section>

        <Section heading="Rate limits + headers">
          <p className="text-sm font-medium text-bauhaus-black leading-relaxed mb-3">
            Default: 60 requests per minute per IP. Each response carries the standard rate-limit
            headers:
          </p>
          <CodeBlock>{`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1748179200`}</CodeBlock>
          <p className="text-sm font-medium text-bauhaus-black leading-relaxed mt-3">
            A 429 response includes <code className="font-mono text-bauhaus-red">{`{"error":"rate_limited"}`}</code>.
            Back off and retry after the reset timestamp.
          </p>
        </Section>

        <Section heading="License + citation">
          <p className="text-sm font-medium text-bauhaus-black leading-relaxed">
            All public-API data is licensed{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" className="text-bauhaus-blue underline">
              CC-BY 4.0
            </a>. You may use it commercially with attribution.
          </p>
          <p className="text-sm font-medium text-bauhaus-black leading-relaxed mt-3">
            Suggested citation: <em>CivicGraph (2026). Public API. Retrieved from
            https://civicgraph.au/api/v1/public/.</em>
          </p>
        </Section>

        <Section heading="Get in touch">
          <p className="text-sm font-medium text-bauhaus-black leading-relaxed">
            Need higher rate limits, bulk dumps, or a partnership? Write to{' '}
            <a href="mailto:feedback@civicgraph.au" className="text-bauhaus-blue underline">
              feedback@civicgraph.au
            </a>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-black uppercase tracking-widest border-b-2 border-bauhaus-black pb-2 mb-4">
        {heading}
      </h2>
      {children}
    </section>
  );
}

function Endpoint({ method, path, description }: { method: string; path: string; description: string }) {
  return (
    <div className="bg-white border-2 border-bauhaus-black p-4 mb-3">
      <div className="flex items-center gap-3 mb-1">
        <span className="inline-block px-2 py-0.5 text-[11px] font-black uppercase tracking-widest bg-bauhaus-blue text-white">
          {method}
        </span>
        <code className="font-mono text-sm font-bold">{path}</code>
      </div>
      <p className="text-sm font-medium text-bauhaus-muted leading-relaxed">{description}</p>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-bauhaus-black text-white border-2 border-bauhaus-black p-4 text-xs font-mono overflow-x-auto leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}
