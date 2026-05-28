import Link from 'next/link';

export const metadata = {
  title: 'CivicGraph Atlas — Public-good intelligence on Australian funding flows',
  description: 'Open atlases of Australian funding distribution and influence networks. Free, cited, and downloadable.',
};

export default function AtlasIndexPage() {
  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
          &larr; CivicGraph
        </Link>

        <header className="mt-4 mb-12 border-b-4 border-bauhaus-black pb-8">
          <div className="inline-block bg-bauhaus-red text-white px-3 py-1 text-xs font-black uppercase tracking-widest mb-4">
            Atlas
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight text-bauhaus-black leading-none">
            Public<br />intelligence
          </h1>
          <p className="mt-6 text-lg font-medium text-bauhaus-black max-w-3xl leading-relaxed">
            Open atlases built from public registries — ACNC, AusTender, AEC, ATO Tax Transparency,
            SEIFA — to surface where Australian funding goes and who holds influence across systems.
            Free, cited, downloadable as JSON.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <AtlasCard
            href="/atlas/funding-deserts"
            badge="Flagship"
            badgeColor="#D02020"
            title="Funding Deserts"
            subtitle="Where need is high and money isn't"
            description="LGA-level mismatch between SEIFA disadvantage and the public-sector funding flowing in. 1,400+ LGAs ranked by desert score."
          />
          <AtlasCard
            href="/atlas/revolving-door"
            badge="New"
            badgeColor="#1040C0"
            title="Revolving Door"
            subtitle="Who plays in multiple games"
            description="Entities active across two or more of: lobbying, political donations, government contracts, government funding. 4,700+ entities scored."
          />
        </div>

        <section className="mt-16 bg-white border-4 border-bauhaus-black p-8">
          <h2 className="text-sm font-black uppercase tracking-widest mb-3">Use the API</h2>
          <p className="text-sm font-medium text-bauhaus-black leading-relaxed mb-4 max-w-3xl">
            Every atlas dataset is also available as JSON via the CivicGraph Public API. Free,
            rate-limited (60 req/min unauthenticated). Higher tiers available for journalists and
            researchers — get in touch.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/docs/api"
              className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              API docs
            </Link>
            <a
              href="/api/v1/public/openapi.json"
              className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue hover:text-white"
            >
              OpenAPI spec
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

function AtlasCard({
  href,
  badge,
  badgeColor,
  title,
  subtitle,
  description,
}: {
  href: string;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block bg-white border-4 border-bauhaus-black p-8 shadow-[8px_8px_0_0_#121212] hover:shadow-[12px_12px_0_0_#121212] hover:-translate-x-1 hover:-translate-y-1 transition-all"
    >
      <div
        className="inline-block px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white mb-4"
        style={{ backgroundColor: badgeColor }}
      >
        {badge}
      </div>
      <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight leading-none mb-2">
        {title}
      </h2>
      <p className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4">{subtitle}</p>
      <p className="text-sm font-medium text-bauhaus-black leading-relaxed">{description}</p>
      <div className="mt-6 inline-flex items-center text-xs font-black uppercase tracking-widest text-bauhaus-red group-hover:text-bauhaus-black">
        Open atlas &rarr;
      </div>
    </Link>
  );
}
