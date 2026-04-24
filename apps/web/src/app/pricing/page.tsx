'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { trackProductEvent } from '@/lib/product-events-client'
import { startCheckoutForTier } from '@/lib/start-checkout'

type FeatureStatus = 'comingSoon' | 'custom'

interface TierFeature {
  label: string
  status?: FeatureStatus
}

interface Tier {
  key: string
  name: string
  tagline: string
  price: number
  priceNote: string
  description: string
  features: TierFeature[]
  cta: string
  ctaHref?: string
  highlight: boolean
}

const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  comingSoon: 'Coming soon',
  custom: 'Custom deployment',
}

const tiers: Tier[] = [
  {
    key: 'community',
    name: 'COMMUNITY',
    tagline: 'Search grants. Watch funders.',
    price: 0,
    priceNote: 'forever',
    description: 'For grassroots nonprofits, First Nations organisations, and small teams under $500K revenue.',
    features: [
      { label: 'Search grant opportunities' },
      { label: 'View foundation profiles' },
      { label: 'Save & shortlist opportunities' },
      { label: 'Basic alerts' },
      { label: '1 team member' },
    ],
    cta: 'Get Started',
    ctaHref: '/register',
    highlight: false,
  },
  {
    key: 'professional',
    name: 'PROFESSIONAL',
    tagline: 'Match. Monitor. Manage the pipeline.',
    price: 79,
    priceNote: '/month',
    description: 'For grant consultants, freelance writers, and solo grants or fundraising leads.',
    features: [
      { label: 'Everything in Community' },
      { label: 'Org-fit match scoring' },
      { label: 'Advanced alerts and watchlists' },
      { label: 'Pipeline tracking' },
      { label: 'Foundation prospect notes' },
      { label: 'Weekly digest' },
      { label: 'CSV export' },
      { label: '5 team members' },
    ],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    key: 'organisation',
    name: 'ORGANISATION',
    tagline: 'Shared workflow for funding teams.',
    price: 249,
    priceNote: '/month',
    description: 'For grant teams, development teams, and advisory firms managing multiple active opportunities.',
    features: [
      { label: 'Everything in Professional' },
      { label: 'Shared team workspace' },
      { label: 'Org-wide pipeline dashboard' },
      { label: 'Board or client export reports' },
      { label: 'Calendar integration' },
      { label: 'Funder shortlist collaboration' },
      { label: 'Priority support' },
      { label: '25 team members' },
    ],
    cta: 'Start Free Trial',
    highlight: false,
  },
  {
    key: 'funder',
    name: 'FUNDER',
    tagline: 'Prospecting and portfolio intelligence.',
    price: 499,
    priceNote: '/month',
    description: 'For foundations, philanthropic advisors, and commissioning teams that need a wider market view.',
    features: [
      { label: 'Everything in Organisation' },
      { label: 'Portfolio intelligence' },
      { label: 'Gap analysis and market scanning' },
      { label: 'Prospect discovery across entities' },
      { label: 'Read-only API access' },
      { label: 'Benchmarking workflows', status: 'comingSoon' },
      { label: 'White-label option', status: 'custom' },
      { label: 'Unlimited team members' },
    ],
    cta: 'Talk to Us',
    ctaHref: 'mailto:hello@civicgraph.au?subject=Funder%20tier%20enquiry',
    highlight: false,
  },
  {
    key: 'enterprise',
    name: 'ENTERPRISE',
    tagline: 'Custom deployment for governed teams.',
    price: 1999,
    priceNote: '/month',
    description: 'For large networks, government teams, and deployments with integration or governance requirements.',
    features: [
      { label: 'Everything in Funder' },
      { label: 'Expanded API access', status: 'custom' },
      { label: 'Custom dashboards', status: 'custom' },
      { label: 'SSO / SAML integration', status: 'custom' },
      { label: 'White-label deployment', status: 'custom' },
      { label: 'Dedicated onboarding & support' },
      { label: 'Unlimited everything' },
    ],
    cta: 'Contact Us',
    ctaHref: 'mailto:hello@civicgraph.au?subject=Enterprise%20enquiry',
    highlight: false,
  },
]

function formatPrice(price: number): string {
  if (price === 0) return 'Free'
  return `$${price}`
}

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const billingSource = searchParams.get('billing_source')?.trim().slice(0, 80) || null
  const checkoutSource = billingSource || 'pricing_page'

  useEffect(() => {
    void trackProductEvent('upgrade_prompt_viewed', {
      source: checkoutSource,
      metadata: billingSource ? { origin: 'billing_reminder' } : {},
      onceKey: `${checkoutSource}:viewed`,
    })
  }, [billingSource, checkoutSource])

  const handleSubscribe = async (tier: string) => {
    setLoading(tier)
    try {
      const result = await startCheckoutForTier(tier as Parameters<typeof startCheckoutForTier>[0], checkoutSource)
      if (!result.ok) {
        console.error('Checkout error:', result.error)
      }
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-bauhaus-canvas">
      <section className="border-b-4 border-bauhaus-black bg-bauhaus-black px-6 py-24 text-white">
        <div className="mx-auto max-w-5xl text-center">
          <p className="mb-8 text-sm font-black uppercase tracking-[0.3em] text-bauhaus-yellow">
            Pricing For Funding Teams
          </p>
          <h1 className="text-5xl font-black tracking-tight md:text-8xl">
            BUILD A BETTER
            <br />
            FUNDING PIPELINE.
          </h1>
          <p className="mx-auto mt-8 max-w-3xl text-xl font-medium text-white/65 md:text-2xl">
            CivicGraph helps nonprofits and grant consultants find the right opportunities, monitor
            the right funders, and run a live pipeline instead of rebuilding research from scratch every week.
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base font-bold text-white/45">
            Start free. Upgrade when you need better matching, better monitoring, and a shared workflow.
          </p>
        </div>
      </section>

      <section className="border-b-4 border-bauhaus-black bg-white px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">WHAT YOU ARE BUYING</h2>
            <p className="mx-auto mt-4 max-w-2xl text-bauhaus-muted">
              Not just access to a list of grants. A system for finding, prioritising, and managing the funding work that matters.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            {[
              ['Find', 'Surface better-fit grants and foundation programs.'],
              ['Monitor', 'Catch new rounds, deadline moves, and changed program pages.'],
              ['Prospect', 'Track likely-fit funders before a round is obvious.'],
              ['Track', 'Keep your shortlist, notes, and next actions in one place.'],
            ].map(([title, copy], index) => (
              <div
                key={title}
                className={`border-4 border-bauhaus-black p-6 ${index === 1 ? 'bg-bauhaus-blue text-white' : index === 2 ? 'bg-bauhaus-red text-white' : 'bg-bauhaus-canvas text-bauhaus-black'}`}
              >
                <p className="text-xl font-black">{title}</p>
                <p className={`mt-3 text-sm font-medium leading-relaxed ${index === 1 || index === 2 ? 'text-white/75' : 'text-bauhaus-muted'}`}>
                  {copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b-4 border-bauhaus-black px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-black tracking-tight md:text-4xl">
            WHO THIS FITS BEST
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow">
              <h3 className="text-lg font-black">GRANT CONSULTANTS</h3>
              <p className="mt-3 text-sm text-bauhaus-muted">
                Best if you manage multiple client pipelines and need a faster way to spot, track, and explain the next best opportunities.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow">
              <h3 className="text-lg font-black">GRANTS MANAGERS</h3>
              <p className="mt-3 text-sm text-bauhaus-muted">
                Best if you own fundraising or grants inside one organisation and need a better monitoring and prospecting stack.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow">
              <h3 className="text-lg font-black">FUNDING TEAMS</h3>
              <p className="mt-3 text-sm text-bauhaus-muted">
                Best if you need a shared workflow for multiple people, board reporting, and a more disciplined way to manage the pipeline.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b-4 border-bauhaus-black bg-bauhaus-canvas px-6 py-16">
        <div className="mx-auto mb-12 max-w-5xl text-center">
          <h2 className="mb-4 text-3xl font-black tracking-tight md:text-4xl">
            CHOOSE THE PIPELINE YOU NEED
          </h2>
          <p className="mx-auto max-w-2xl text-bauhaus-muted">
            Start with search and alerts. Upgrade when you want stronger matching, a cleaner prospecting workflow, and team coordination.
          </p>

          <div className="mx-auto mt-8 mb-8 max-w-3xl border-4 border-bauhaus-black bg-white p-4 text-left">
            <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">
              Feature availability
            </p>
            <p className="text-sm font-medium text-bauhaus-black">
              Unmarked features are available now. <span className="font-black">Coming soon</span> means rolling out.
              <span className="font-black"> Custom deployment</span> means available through managed or enterprise delivery.
            </p>
          </div>

          <div className="mb-8 inline-flex items-center justify-center border-4 border-bauhaus-black bg-white px-4 py-3 text-left">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-bauhaus-muted">
                Billing note
              </p>
              <p className="mt-1 text-sm font-medium text-bauhaus-black">
                Self-serve pricing is monthly today. Annual billing is not yet available in checkout.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            {tiers.map((tier) => (
              <div
                key={tier.key}
                className={`flex flex-col border-4 border-bauhaus-black bg-white ${
                  tier.highlight ? 'relative bauhaus-shadow' : ''
                }`}
              >
                {tier.highlight && (
                  <div className="bg-bauhaus-red py-2 text-center text-xs font-black uppercase tracking-widest text-white">
                    Best First Paid Plan
                  </div>
                )}

                <div
                  className={`border-b-4 border-bauhaus-black p-6 ${
                    tier.key === 'community'
                      ? 'bg-bauhaus-black text-white'
                      : tier.key === 'funder'
                        ? 'bg-bauhaus-yellow'
                        : tier.key === 'enterprise'
                          ? 'bg-bauhaus-blue text-white'
                          : 'bg-white'
                  }`}
                >
                  <h3 className="text-lg font-black tracking-widest">{tier.name}</h3>
                  <p
                    className={`mt-1 text-xs ${
                      tier.key === 'community' || tier.key === 'enterprise'
                        ? 'text-white/65'
                        : 'text-bauhaus-muted'
                    }`}
                  >
                    {tier.tagline}
                  </p>
                  <div className="mt-4">
                    <span className="text-4xl font-black">{formatPrice(tier.price)}</span>
                    <span
                      className={`ml-1 text-sm ${
                        tier.key === 'community' || tier.key === 'enterprise'
                          ? 'text-white/65'
                          : 'text-bauhaus-muted'
                      }`}
                    >
                      {tier.price === 0 ? 'forever' : '/month'}
                    </span>
                  </div>
                  {(tier.key === 'professional' || tier.key === 'organisation') && (
                    <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
                      14-day free trial
                    </p>
                  )}
                </div>

                <div className="px-6 pt-4">
                  <p className="text-xs text-bauhaus-muted">{tier.description}</p>
                </div>

                <div className="flex-1 p-6">
                  <ul className="space-y-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature.label} className="flex gap-2 text-sm">
                        <span className="mt-0.5 text-xs font-black text-money">{'\u25CF'}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{feature.label}</span>
                          {feature.status && (
                            <span
                              className={`border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                                feature.status === 'comingSoon'
                                  ? 'border-bauhaus-yellow bg-warning-light text-bauhaus-black'
                                  : 'border-bauhaus-blue bg-link-light text-bauhaus-blue'
                              }`}
                            >
                              {FEATURE_STATUS_LABELS[feature.status]}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-6 pt-0">
                  {tier.ctaHref ? (
                    <Link
                      href={tier.ctaHref}
                      className={`block w-full border-4 border-bauhaus-black py-3 text-center text-sm font-black uppercase tracking-widest transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none ${
                        tier.key === 'community'
                          ? 'bg-bauhaus-black text-white hover:bg-bauhaus-black/90'
                          : tier.key === 'enterprise'
                            ? 'bg-bauhaus-blue text-white bauhaus-shadow-sm'
                            : tier.key === 'funder'
                              ? 'bg-bauhaus-yellow text-bauhaus-black bauhaus-shadow-sm'
                              : 'bg-white text-bauhaus-black bauhaus-shadow-sm'
                      }`}
                    >
                      {tier.cta}
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(tier.key)}
                      disabled={loading === tier.key}
                      className={`block w-full border-4 border-bauhaus-black py-3 text-center text-sm font-black uppercase tracking-widest transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-50 ${
                        tier.highlight
                          ? 'bg-bauhaus-red text-white bauhaus-shadow-sm'
                          : 'bg-white text-bauhaus-black bauhaus-shadow-sm'
                      }`}
                    >
                      {loading === tier.key ? 'Loading...' : tier.cta}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b-4 border-bauhaus-black bg-white px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">
              THE FASTEST WAY TO GET VALUE
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-bauhaus-muted">
              The best first use case is simple: set up your organisation, review matched opportunities,
              save a shortlist, and start receiving better alerts.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {[
              ['1', 'Create your org profile'],
              ['2', 'Review matched grants and funders'],
              ['3', 'Shortlist your active pipeline'],
              ['4', 'Get weekly updates and next actions'],
            ].map(([step, copy], index) => (
              <div
                key={step}
                className={`border-4 border-bauhaus-black p-6 ${
                  index === 1 ? 'bg-bauhaus-blue text-white' : index === 2 ? 'bg-bauhaus-red text-white' : 'bg-bauhaus-canvas'
                }`}
              >
                <p className="text-4xl font-black">{step}</p>
                <p className={`mt-4 text-sm font-bold ${index === 1 || index === 2 ? 'text-white/80' : 'text-bauhaus-black'}`}>
                  {copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b-4 border-bauhaus-black px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-12 text-center text-3xl font-black tracking-tight">FAQ</h2>
          {[
            {
              q: 'Is the Community tier really free?',
              a: 'Yes. Community organisations under $500K revenue can search, save, and set up basic alerts at no cost.',
            },
            {
              q: 'Who should buy Professional first?',
              a: 'Professional is the best first paid plan for consultants and solo grants managers who need better fit scoring, watchlists, and a cleaner working pipeline.',
            },
            {
              q: 'What makes Organisation different?',
              a: 'Organisation adds the shared workflow: more team members, a broader pipeline dashboard, collaboration, and reporting.',
            },
            {
              q: 'Is this only for open grants?',
              a: 'No. The stronger value is prospecting: foundation programs, prior grantee signals, and monitoring likely-fit funders before a round is obvious.',
            },
            {
              q: 'How is this different from other grant platforms?',
              a: 'Most tools stop at listings. CivicGraph is building a live pipeline and prospect intelligence layer backed by connected public-source data.',
            },
            {
              q: 'Is there an annual discount?',
              a: 'Not in self-serve checkout yet. Pricing currently runs monthly while annual billing is being wired properly.',
            },
          ].map((faq) => (
            <div key={faq.q} className="border-b-2 border-bauhaus-black/10 py-6">
              <h3 className="mb-2 text-sm font-black uppercase tracking-widest">{faq.q}</h3>
              <p className="text-sm text-bauhaus-muted">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-bauhaus-red px-6 py-20 text-center text-white">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            STOP REBUILDING
            <br />
            YOUR GRANT RESEARCH STACK.
          </h2>
          <p className="mt-6 text-lg text-white/75">
            Start with search and alerts. Upgrade when you need a stronger funding pipeline.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-block border-4 border-white bg-white px-10 py-4 text-sm font-black uppercase tracking-widest text-bauhaus-red bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Get Started Free
            </Link>
            <a
              href="mailto:hello@civicgraph.au?subject=CivicGraph%20pricing%20enquiry"
              className="inline-block border-4 border-white px-10 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-white hover:text-bauhaus-red"
            >
              Talk To Us
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
