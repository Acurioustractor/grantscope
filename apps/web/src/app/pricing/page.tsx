'use client'

import { useState } from 'react'
import Link from 'next/link'

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
    tagline: 'Find funding. Track applications.',
    price: 0,
    priceNote: 'forever',
    description: 'For grassroots NFPs, First Nations orgs, and CLCs under $500K revenue',
    features: [
      { label: 'Full grant search' },
      { label: 'Foundation profiles' },
      { label: 'Save & track grants' },
      { label: 'Basic email alerts' },
      { label: '1 team member' },
    ],
    cta: 'Get Started',
    ctaHref: '/auth/signup',
    highlight: false,
  },
  {
    key: 'professional',
    name: 'PROFESSIONAL',
    tagline: 'AI-scored matching. Pipeline tracking.',
    price: 79,
    priceNote: '/month',
    description: 'For established NFPs and social enterprises',
    features: [
      { label: 'Everything in Community' },
      { label: 'AI grant match scoring (0–100)' },
      { label: 'Custom alert rules & keywords' },
      { label: 'Pipeline tracking with Kanban' },
      { label: 'Foundation relationship tracker' },
      { label: 'CSV export' },
      { label: 'PDF export', status: 'comingSoon' },
      { label: '5 team members' },
    ],
    cta: 'Start Free Trial',
    highlight: false,
  },
  {
    key: 'organisation',
    name: 'ORGANISATION',
    tagline: 'Procurement + allocation intelligence.',
    price: 249,
    priceNote: '/month',
    description: 'For larger NFPs, peak bodies, procurement teams, and multi-program orgs',
    features: [
      { label: 'Everything in Professional' },
      { label: 'Tender Intelligence — supplier discovery' },
      { label: 'Compliance scoring inside intelligence packs' },
      { label: 'Intelligence pack generation' },
      { label: 'Place-based funding analysis' },
      { label: 'Board-ready export reports', status: 'comingSoon' },
      { label: '25 team members' },
    ],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    key: 'funder',
    name: 'FUNDER',
    tagline: 'Portfolio intelligence. Gap analysis.',
    price: 499,
    priceNote: '/month',
    description: 'For foundations, corporate giving, philanthropic advisors, and commissioners',
    features: [
      { label: 'Everything in Organisation' },
      { label: 'Portfolio view — saved foundations & summary' },
      { label: 'Gap analysis — where money isn\'t going' },
      { label: 'Commissioning intelligence by place' },
      { label: 'Foundation scorecard & benchmarking', status: 'comingSoon' },
      { label: 'Read-only API access' },
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
    tagline: 'Managed deployment for teams with governance requirements.',
    price: 1999,
    priceNote: '/month',
    description: 'For state/federal government, large foundations, and sector-wide deployments',
    features: [
      { label: 'Everything in Funder' },
      { label: 'Expanded API access', status: 'custom' },
      { label: 'Custom procurement dashboards', status: 'custom' },
      { label: 'Governed proof layer', status: 'comingSoon' },
      { label: 'White-label deployment', status: 'custom' },
      { label: 'SSO / SAML integration', status: 'custom' },
      { label: 'Dedicated onboarding & support' },
    ],
    cta: 'Contact Us',
    ctaHref: 'mailto:hello@civicgraph.au?subject=Enterprise%20enquiry',
    highlight: false,
  },
]

const ANNUAL_DISCOUNT = 0.17

function formatPrice(price: number, annual: boolean): string {
  if (price === 0) return 'Free'
  const effective = annual ? Math.round(price * (1 - ANNUAL_DISCOUNT)) : price
  return `$${effective}`
}

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [annual, setAnnual] = useState(false)

  const handleSubscribe = async (tier: string) => {
    setLoading(tier)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, billing: annual ? 'annual' : 'monthly' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.error) {
        if (res.status === 401) {
          window.location.href = '/auth/signup?plan=' + tier
        }
      }
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-bauhaus-canvas">

      {/* ===== HERO: THE DECISION PROBLEM ===== */}
      <section className="bg-bauhaus-black text-white py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm text-white/40 uppercase tracking-[0.3em] font-black mb-8">
            Decision Infrastructure for Public Spending
          </p>
          <h1 className="text-5xl md:text-8xl font-black tracking-tight mb-8">
            BETTER DATA.<br />BETTER DECISIONS.<br />BETTER OUTCOMES.
          </h1>
          <p className="text-xl md:text-2xl font-medium text-white/60 max-w-3xl mx-auto mb-4">
            Procurement intelligence. Place-based allocation analysis. External evidence links.
            CivicGraph brings public spending, market, and funding data into a working research
            and triage layer for government, funders, and community organisations.
          </p>
          <p className="text-lg text-white/40 mt-8">
            From finding the right supplier to pressure-testing where money should go next.
          </p>
        </div>
      </section>

      {/* ===== THREE PRODUCT FAMILIES ===== */}
      <section className="py-16 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
            THREE PRODUCTS. ONE DECISION LAYER.
          </h2>
          <p className="text-bauhaus-muted max-w-2xl mx-auto">
            Procurement intelligence to find the right suppliers. Allocation intelligence
            to decide where money should go. Governed proof is rolling out carefully.
          </p>
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Procurement Intelligence', sub: 'Supplier discovery, compliance scoring, intelligence packs', stat: 'National contract history', color: 'bg-bauhaus-blue text-white' },
            { label: 'Allocation Intelligence', sub: 'Place packs, gap analysis, commissioning data', stat: '2,900 postcodes', color: 'bg-bauhaus-black text-white' },
            { label: 'Governed Proof', sub: 'Outcome evidence, community voice, renewal defence', stat: 'Coming soon', color: 'bg-bauhaus-red/10 text-bauhaus-black' },
          ].map((item) => (
            <div key={item.label} className={`border-4 border-bauhaus-black p-6 ${item.color}`}>
              <p className="text-2xl md:text-3xl font-black">{item.stat}</p>
              <p className="text-sm font-bold mt-2">{item.label}</p>
              <p className="text-xs mt-1 opacity-70">{item.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== WHO IS THIS FOR ===== */}
      <section className="py-16 px-6 border-b-4 border-bauhaus-black">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight text-center mb-12">
            WHO MAKES ALLOCATION DECISIONS?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="border-4 border-bauhaus-black p-8 bg-white bauhaus-shadow">
              <h3 className="text-lg font-black mb-2">PROCUREMENT OFFICERS</h3>
              <p className="text-sm text-bauhaus-muted mb-4">You need to find suppliers fast and defend your choices:</p>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> Supplier discovery across the national entity graph</li>
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> Compliance scoring from connected public registries</li>
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> Bid-ready intelligence packs in seconds</li>
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> Indigenous procurement targets with verified data</li>
              </ul>
            </div>
            <div className="border-4 border-bauhaus-black p-8 bg-white bauhaus-shadow">
              <h3 className="text-lg font-black mb-2">COMMISSIONERS &amp; FUNDERS</h3>
              <p className="text-sm text-bauhaus-muted mb-4">You need to know where money should go next:</p>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> Place-based funding analysis by postcode</li>
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> Gap scoring — where need exceeds provision</li>
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> Portfolio view across saved foundations</li>
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> Benchmarking workflows in research preview</li>
              </ul>
            </div>
            <div className="border-4 border-bauhaus-black p-8 bg-white bauhaus-shadow">
              <h3 className="text-lg font-black mb-2">COMMUNITY ORGANISATIONS</h3>
              <p className="text-sm text-bauhaus-muted mb-4">You need to find funding and win it:</p>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> AI-scored grant matching (0&ndash;100)</li>
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> Pipeline tracking across all applications</li>
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> Foundation relationship CRM</li>
                <li className="flex gap-3"><span className="text-money font-black">&#10003;</span> Free forever for orgs under $500K</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WHY FUNDERS SHOULD CARE: THE ACCOUNTABILITY DATA ===== */}
      <section className="py-16 px-6 bg-bauhaus-black text-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-4">
            DATA NOBODY ELSE HAS
          </h2>
          <p className="text-center text-white/50 mb-12 max-w-3xl mx-auto">
            We&apos;ve connected ACNC financial records, AusTender procurement data, AEC political
            donations, ATO tax transparency, and ASIC corporate filings. This is what we found.
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="border-4 border-white/20 p-6">
              <p className="text-4xl font-black text-bauhaus-yellow">$2.5B</p>
              <p className="text-sm font-bold mt-2">Annual Tax Subsidy</p>
              <p className="text-xs text-white/50 mt-2">
                That&apos;s what taxpayers contribute to the philanthropic sector through DGR
                deductions. 82% goes to the top 10% of organisations.
              </p>
            </div>
            <div className="border-4 border-white/20 p-6">
              <p className="text-4xl font-black text-bauhaus-red">89%</p>
              <p className="text-sm font-bold mt-2">Executive Pay &gt; Grants</p>
              <p className="text-xs text-white/50 mt-2">
                89% of foundations pay their executives more than they distribute in grants.
                We show exactly who.
              </p>
            </div>
            <div className="border-4 border-white/20 p-6">
              <p className="text-4xl font-black text-bauhaus-blue">$494B</p>
              <p className="text-sm font-bold mt-2">In Foundation Assets</p>
              <p className="text-xs text-white/50 mt-2">
                Sitting in endowments. The average giving ratio across large foundations
                is just 5%. Some are below 1%. We track every one.
              </p>
            </div>
          </div>

          <div className="border-4 border-white/20 p-8">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-black text-bauhaus-yellow">FOUNDATION SCORECARD PREVIEW</h3>
              <span className="text-[10px] font-black px-2 py-0.5 border border-bauhaus-yellow/40 bg-bauhaus-yellow/10 text-bauhaus-yellow uppercase tracking-widest">
                Research Preview
              </span>
            </div>
            <p className="text-sm text-white/60 mb-6">
              We are prototyping scorecards from ACNC filings and foundation profile data. Giving
              ratio, executive compensation, asset growth, grant distribution, and geographic reach
              are visible in the research layer today. Self-serve benchmarking is still rolling out.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border-2 border-white/10 p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-bold">Foundation A</span>
                  <span className="bg-money text-white text-xs font-black px-2 py-1">A+</span>
                </div>
                <p className="text-xs text-white/50">176% giving ratio. Drawing down endowment to fund impact. Walking the talk.</p>
              </div>
              <div className="border-2 border-white/10 p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-bold">Foundation B</span>
                  <span className="bg-bauhaus-yellow text-bauhaus-black text-xs font-black px-2 py-1">D</span>
                </div>
                <p className="text-xs text-white/50">$7.6B assets. 3.1% giving ratio. $3.4M executive pay. Room for improvement.</p>
              </div>
              <div className="border-2 border-white/10 p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-bold">Foundation C</span>
                  <span className="bg-bauhaus-red text-white text-xs font-black px-2 py-1">F</span>
                </div>
                <p className="text-xs text-white/50">$76M assets. 0% giving ratio. $1.5M executive pay. The data speaks for itself.</p>
              </div>
            </div>
            <p className="text-xs text-white/30 mt-4">
              Illustrative scoring preview based on ACNC filings. Named subscriber benchmarking is still being tightened before wider rollout.
            </p>
          </div>
        </div>
      </section>

      {/* ===== WHAT CHANGES ===== */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-4">
            WHAT CHANGES WITH BETTER DECISION DATA
          </h2>
          <p className="text-center text-bauhaus-muted mb-12 max-w-2xl mx-auto">
            From spreadsheets to decision infrastructure.
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                before: 'Procurement officers build supplier lists from memory and Google',
                after: 'Discovery engine across the national entity graph with compliance scoring and contract history.',
              },
              {
                before: 'Commissioners allocate funding without seeing where money already flows',
                after: 'Place packs show funding, providers, gaps, and disadvantage by postcode.',
              },
              {
                before: 'Community orgs apply blindly to hundreds of grants',
                after: 'AI scores every grant against your mission. Apply to the ones you\'ll win.',
              },
              {
                before: 'Nobody can prove procurement created community value',
                after: 'Pilot governed proof workflows connect contracts to outcomes. Wider rollout is coming soon.',
              },
              {
                before: 'Indigenous procurement targets are met on paper, not in practice',
                after: 'Verified Indigenous entity data from ORIC, Supply Nation, and community classification.',
              },
              {
                before: 'Small orgs can\'t afford the intelligence tools that primes take for granted',
                after: 'Cross-subsidy: enterprise pays, community access is free. Better data for everyone.',
              },
            ].map((item) => (
              <div key={item.before} className="border-4 border-bauhaus-black bg-white p-6">
                <p className="text-sm text-bauhaus-red line-through mb-2">{item.before}</p>
                <p className="text-sm font-bold">{item.after}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TIERS ===== */}
      <section className="py-16 px-6 bg-bauhaus-canvas border-y-4 border-bauhaus-black">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
            CHOOSE YOUR LEVEL OF INTELLIGENCE
          </h2>
          <p className="text-bauhaus-muted max-w-2xl mx-auto mb-8">
            Community organisations access core features free. Procurement intelligence,
            allocation analysis, and carefully staged evidence workflows unlock at higher tiers.
          </p>
          <div className="border-4 border-bauhaus-black bg-white p-4 max-w-3xl mx-auto text-left mb-8">
            <p className="text-[11px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">
              Feature availability
            </p>
            <p className="text-sm text-bauhaus-black font-medium leading-relaxed">
              Unmarked features are usable in the product today. <span className="font-black">Coming soon</span> means
              in active rollout. <span className="font-black">Custom deployment</span> means available through managed or
              enterprise delivery, not a self-serve workflow.
            </p>
          </div>

          {/* Annual/Monthly Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={`text-sm font-black uppercase tracking-widest ${!annual ? 'text-bauhaus-black' : 'text-bauhaus-muted'}`}>
              Monthly
            </span>
            <button
              onClick={() => setAnnual(!annual)}
              className={`relative w-14 h-7 rounded-full border-2 border-bauhaus-black transition-colors ${
                annual ? 'bg-money' : 'bg-white'
              }`}
              aria-label="Toggle annual billing"
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-bauhaus-black transition-transform ${
                  annual ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-black uppercase tracking-widest ${annual ? 'text-bauhaus-black' : 'text-bauhaus-muted'}`}>
              Annual
            </span>
            {annual && (
              <span className="text-xs font-black text-money bg-money/10 px-2 py-1 border-2 border-money">
                2 MONTHS FREE
              </span>
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {tiers.map((tier) => (
              <div
                key={tier.key}
                className={`border-4 border-bauhaus-black bg-white flex flex-col ${
                  tier.highlight ? 'bauhaus-shadow relative' : ''
                }`}
              >
                {tier.highlight && (
                  <div className="bg-bauhaus-red text-white text-center py-2 text-xs font-black uppercase tracking-widest">
                    Most Popular
                  </div>
                )}

                <div className={`p-6 border-b-4 border-bauhaus-black ${
                  tier.key === 'community' ? 'bg-bauhaus-black text-white' :
                  tier.key === 'funder' ? 'bg-bauhaus-yellow' :
                  tier.key === 'enterprise' ? 'bg-bauhaus-blue text-white' : 'bg-white'
                }`}>
                  <h3 className="text-lg font-black tracking-widest">{tier.name}</h3>
                  <p className={`text-xs mt-1 ${
                    tier.key === 'community' || tier.key === 'enterprise' ? 'text-white/60' : 'text-bauhaus-muted'
                  }`}>
                    {tier.tagline}
                  </p>
                  <div className="mt-4">
                    <span className="text-4xl font-black">{formatPrice(tier.price, annual)}</span>
                    <span className={`text-sm ml-1 ${
                      tier.key === 'community' || tier.key === 'enterprise' ? 'text-white/60' : 'text-bauhaus-muted'
                    }`}>
                      {tier.price === 0 ? 'forever' : annual ? '/mo (billed annually)' : '/month'}
                    </span>
                  </div>
                </div>

                <div className="px-6 pt-4">
                  <p className="text-xs text-bauhaus-muted">{tier.description}</p>
                </div>

                <div className="p-6 flex-1">
                  <ul className="space-y-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature.label} className="flex gap-2 text-sm">
                        <span className="text-money font-black text-xs mt-0.5">{'\u25CF'}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{feature.label}</span>
                          {feature.status && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 uppercase tracking-widest border ${
                              feature.status === 'comingSoon'
                                ? 'border-bauhaus-yellow bg-warning-light text-bauhaus-black'
                                : 'border-bauhaus-blue bg-link-light text-bauhaus-blue'
                            }`}>
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
                      className={`block w-full py-3 text-center font-black text-sm uppercase tracking-widest border-4 border-bauhaus-black transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none ${
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
                      className={`block w-full py-3 text-center font-black text-sm uppercase tracking-widest border-4 border-bauhaus-black transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-50 ${
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

      {/* ===== FOR FOUNDATIONS: THE REAL PITCH ===== */}
      <section className="py-20 px-6 bg-bauhaus-black text-white">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-white/40 uppercase tracking-[0.3em] font-black text-center mb-4">
            For Foundations, Corporate Giving & Philanthropic Advisors
          </p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-center mb-6">
            YOUR BRAND IS YOUR GIVING RATIO.
          </h2>
          <p className="text-center text-white/50 mb-16 max-w-2xl mx-auto">
            In a world where every ACNC filing is public, your reputation isn&apos;t what you
            say about yourself — it&apos;s what the data says. CivicGraph surfaces that data.
            Be on the right side of it.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="border-4 border-white/20 p-8">
              <h3 className="font-black text-bauhaus-yellow mb-4 text-lg">FIND WHO OTHERS MISS</h3>
              <p className="text-sm text-white/70 mb-4">
                The best community organisations don&apos;t have grant writers. They have
                Elders, youth workers, and practitioners who are too busy doing the work
                to fill in your 47-page application form.
              </p>
              <p className="text-sm text-white/70">
                CivicGraph lets you find them by what they do, not by how well they write.
                Search by mission alignment, geography, community served, and track record.
                Then reach out directly.
              </p>
            </div>
            <div className="border-4 border-white/20 p-8">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="font-black text-bauhaus-yellow text-lg">BENCHMARK YOURSELF</h3>
                <span className="text-[10px] font-black px-2 py-0.5 border border-bauhaus-yellow/40 bg-bauhaus-yellow/10 text-bauhaus-yellow uppercase tracking-widest">
                  Preview
                </span>
              </div>
              <p className="text-sm text-white/70 mb-4">
                What&apos;s your giving ratio? How does your executive compensation compare to
                your grant distribution? What percentage of your funding reaches First Nations
                communities? Regional areas? Women-led organisations?
              </p>
              <p className="text-sm text-white/70">
                We&apos;re tightening this workflow before broader release. Early partners can pressure-test
                where they sit and what data still needs verification.
              </p>
            </div>
            <div className="border-4 border-white/20 p-8">
              <h3 className="font-black text-bauhaus-yellow mb-4 text-lg">SEE THE WHOLE SYSTEM</h3>
              <p className="text-sm text-white/70 mb-4">
                Where is money flowing in your sector? Which communities are over-funded?
                Which are invisible? Where do you overlap with other foundations — and
                where is nobody funding at all?
              </p>
              <p className="text-sm text-white/70">
                Portfolio-level intelligence that turns isolated giving into coordinated impact.
              </p>
            </div>
            <div className="border-4 border-white/20 p-8">
              <h3 className="font-black text-bauhaus-yellow mb-4 text-lg">FUND THE INFRASTRUCTURE</h3>
              <p className="text-sm text-white/70 mb-4">
                Your $499/month doesn&apos;t just buy you tools. It funds free access for every
                grassroots organisation on the platform. The more funders who join, the more
                community orgs can participate.
              </p>
              <p className="text-sm text-white/70">
                That&apos;s not CSR. That&apos;s building the commons. And it&apos;s good for you too —
                more orgs on the platform means better discovery, better data, better outcomes.
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <a
              href="mailto:hello@civicgraph.au?subject=Funder%20tier%20enquiry"
              className="inline-block py-4 px-10 font-black text-sm uppercase tracking-widest border-4 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Talk to Us About Funder Access
            </a>
          </div>
        </div>
      </section>

      {/* ===== THE DECISION STACK ===== */}
      <section className="py-16 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight text-center mb-4">
            THE DECISION STACK
          </h2>
          <p className="text-center text-bauhaus-muted mb-12 max-w-2xl mx-auto">
            Each layer makes the next more powerful. Start with procurement.
            Expand into allocation. Add proof as the workflow matures.
          </p>

          <div className="flex flex-col md:flex-row items-stretch gap-0">
            {[
              { label: '1. PROCUREMENT', desc: 'Find suppliers. Check compliance. Generate packs.', color: 'bg-bauhaus-blue text-white' },
              { label: '2. ALLOCATION', desc: 'Place analysis. Gap scoring. Commissioning data.', color: 'bg-bauhaus-black text-white' },
              { label: '3. PROOF', desc: 'Outcome evidence workflows (pilot). Renewal defence. Policy justification.', color: 'bg-bauhaus-red text-white' },
              { label: 'RESULT', desc: 'Defensible decisions at every stage.', color: 'bg-money text-white' },
            ].map((step, i) => (
              <div key={step.label} className="flex-1 flex flex-col">
                <div className={`${step.color} p-6 border-4 border-bauhaus-black flex-1`}>
                  <p className="text-xs font-black uppercase tracking-widest mb-2">{step.label}</p>
                  <p className="text-xs opacity-70">{step.desc}</p>
                </div>
                {i < 3 && (
                  <div className="flex justify-center py-2 md:hidden">
                    <span className="text-xl font-black">&darr;</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
            <p className="text-sm text-center">
              <strong>Every product decision passes one filter:</strong> does this help become default
              infrastructure for procurement or allocation decisions? That&apos;s what we build.
            </p>
          </div>
        </div>
      </section>

      {/* ===== CROSS-SUBSIDY ===== */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black tracking-tight mb-4">
            HOW CROSS-SUBSIDY WORKS
          </h2>
          <p className="text-bauhaus-muted mb-8 max-w-2xl mx-auto">
            The organisations doing the hardest work in the hardest places shouldn&apos;t also
            have to pay for the tools to find funding.
          </p>
          <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow max-w-2xl mx-auto">
            <div className="grid grid-cols-3 gap-4 mb-6 items-center">
              <div>
                <p className="text-4xl font-black text-bauhaus-blue">$499</p>
                <p className="text-xs text-bauhaus-muted uppercase tracking-widest mt-1">1 Funder pays</p>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-3xl font-black">=</span>
              </div>
              <div>
                <p className="text-4xl font-black text-money">$0</p>
                <p className="text-xs text-bauhaus-muted uppercase tracking-widest mt-1">Dozens use free</p>
              </div>
            </div>
            <p className="text-sm text-bauhaus-muted">
              Foundations and corporates already have the budgets. And they get a better
              product because more orgs on the platform means better data, better discovery,
              and better outcomes. Everyone wins.
            </p>
          </div>
        </div>
      </section>

      {/* ===== THE BIG WHY ===== */}
      <section className="py-20 px-6 bg-bauhaus-black text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-8">
            OWN THE LAYER WHERE
            <br />
            <span className="text-bauhaus-yellow">INSTITUTIONS DECIDE.</span>
          </h2>
          <p className="text-white/50 text-lg mb-6">
            Who gets funded. Who gets contracted. Where services go. How allocations
            are justified. These are the decisions that shape communities — and they&apos;re
            currently made with incomplete data from disconnected systems.
          </p>
          <p className="text-white/50 text-lg mb-6">
            CivicGraph connects AusTender contracts, ACNC finances, AEC donations,
            ATO tax data, and ASIC filings into a single decision layer.
            National entity graph. Connected relationship data. Public-source evidence for market decisions.
          </p>
          <p className="text-white/70 text-xl font-bold mt-8">
            Lead with the budget problem.
            <br />
            Add the proof layer after you own the decision.
          </p>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight text-center mb-12">FAQ</h2>
          {[
            {
              q: 'Is the Community tier really free?',
              a: 'Yes, forever. Community organisations under $500K revenue get full search, save, and alert features at no cost. Funded by paying subscribers who believe in equitable access.',
            },
            {
              q: 'What does the AI grant writing assistant do?',
              a: 'It reads the grant criteria and your organisation\'s profile — mission, past projects, geographic focus — then drafts an application in your voice, tailored to the funder\'s language and priorities. Not a generic template. A real draft that sounds like you, optimised for them.',
            },
            {
              q: 'How is this different from other grant platforms?',
              a: 'Most platforms help you search grants. CivicGraph connects grants, contracts, donations, and procurement across the national entity graph. Three layers: raw financial data, entity relationships, and community evidence. Plus the cross-subsidy model means the best orgs aren\'t priced out.',
            },
            {
              q: 'Can funders search for charities proactively?',
              a: 'Yes. The Funder tier lets foundations and corporates search by mission alignment, geography, community served, and track record — then reach out directly. No more "advertise and wait." Find the orgs already doing the work.',
            },
            {
              q: 'Where does your data come from?',
              a: 'ACNC registers, AusTender, AEC political donations, ATO tax transparency, ASIC corporate filings, ORIC Indigenous corporations, state grant portals, and AI-enriched foundation profiles. Coverage varies by workflow, and the platform surfaces connected public sources rather than pretending every dataset is equally complete.',
            },
            {
              q: 'Do you sell our data?',
              a: 'No. Your application data, relationship notes, and pipeline are private. The only shared data is what\'s already public — ACNC records, published grant opportunities, and foundation profiles.',
            },
            {
              q: 'Why should our foundation pay when the data is public?',
              a: 'The data is public. The intelligence isn\'t. We\'ve spent thousands of hours aggregating, cleaning, enriching, and cross-referencing data that exists in dozens of disconnected registries. And your subscription funds free access for community orgs — that\'s part of the value.',
            },
            {
              q: 'Is there an annual discount?',
              a: 'Yes — pay annually and get 2 months free (17% off). Toggle the billing switch above the pricing cards to see annual prices.',
            },
          ].map((faq) => (
            <div key={faq.q} className="border-b-2 border-bauhaus-black/10 py-6">
              <h3 className="font-black text-sm uppercase tracking-widest mb-2">{faq.q}</h3>
              <p className="text-sm text-bauhaus-muted">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-20 px-6 bg-bauhaus-red text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6">
            BETTER DECISIONS START
            <br />
            WITH BETTER DATA.
          </h2>
          <p className="text-white/70 text-lg mb-10">
            Procurement officers, commissioners, funders, and community organisations
            — CivicGraph gives you the decision intelligence to allocate resources
            where they&apos;ll create the most value.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-block py-4 px-10 font-black text-sm uppercase tracking-widest border-4 border-white bg-white text-bauhaus-red bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Get Started Free
            </Link>
            <a
              href="mailto:hello@civicgraph.au?subject=Funder%20tier%20enquiry"
              className="inline-block py-4 px-10 font-black text-sm uppercase tracking-widest border-4 border-white text-white transition-all hover:bg-white hover:text-bauhaus-red"
            >
              Talk to Us
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
