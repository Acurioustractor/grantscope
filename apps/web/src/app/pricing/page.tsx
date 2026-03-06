'use client'

import { useState } from 'react'
import Link from 'next/link'

const tiers = [
  {
    key: 'community',
    name: 'COMMUNITY',
    tagline: 'Your work matters more than your budget',
    price: 'Free',
    priceNote: 'forever',
    description: 'For grassroots NFPs, First Nations orgs, and CLCs under $500K revenue',
    features: [
      'Full grant search (14,000+ opportunities)',
      'Foundation profiles (9,800+)',
      'Save & track grants',
      'Basic email alerts',
      '1 team member',
    ],
    cta: 'Get Started',
    ctaHref: '/auth/signup',
    accent: 'bauhaus-black',
    highlight: false,
  },
  {
    key: 'professional',
    name: 'PROFESSIONAL',
    tagline: 'Stop guessing, start winning',
    price: '$49',
    priceNote: '/month',
    description: 'For established NFPs and social enterprises',
    features: [
      'Everything in Community',
      'AI grant writing assistant',
      'Smart match scoring (0–100)',
      'Custom alert rules',
      'Pipeline tracking',
      'Foundation relationship notes',
      '5 team members',
    ],
    cta: 'Start Free Trial',
    accent: 'bauhaus-blue',
    highlight: false,
  },
  {
    key: 'organisation',
    name: 'ORGANISATION',
    tagline: 'Your whole funding operation',
    price: '$199',
    priceNote: '/month',
    description: 'For larger NFPs, peak bodies, and multi-program orgs',
    features: [
      'Everything in Professional',
      'Org-wide pipeline dashboard',
      'Bulk application tracking',
      'Corporate & philanthropy CRM',
      'Auto-match new grants to your mission',
      'Calendar integration',
      'Board-ready export reports',
      '25 team members',
    ],
    cta: 'Start Free Trial',
    accent: 'bauhaus-red',
    highlight: true,
  },
  {
    key: 'funder',
    name: 'FUNDER',
    tagline: 'See the whole system',
    price: '$499',
    priceNote: '/month',
    description: 'For foundations, corporate giving, philanthropic advisors, and government',
    features: [
      'Everything in Organisation',
      'Portfolio view — outcomes & geography',
      'Gap analysis — where money isn\'t going',
      'Deal flow — discover aligned orgs',
      'Data API access',
      'White-label option',
      'Unlimited team members',
    ],
    cta: 'Talk to Us',
    ctaHref: 'mailto:hello@grantscope.au?subject=Funder%20tier%20enquiry',
    accent: 'bauhaus-yellow',
    highlight: false,
  },
]

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  const handleSubscribe = async (tier: string) => {
    setLoading(tier)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.error) {
        // If not logged in, redirect to signup
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
      {/* Hero */}
      <section className="bg-bauhaus-black text-white py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6">
            PRICING
          </h1>
          <p className="text-xl md:text-2xl font-medium text-white/70 max-w-3xl mx-auto mb-4">
            Large organisations and foundations pay. Community orgs use it free.
            That&apos;s how it should work.
          </p>
          <p className="text-sm text-white/40 uppercase tracking-widest font-black">
            The grant system is broken. We&apos;re building something better.
          </p>
        </div>
      </section>

      {/* The Problem / The Fix */}
      <section className="py-16 px-6 border-b-4 border-bauhaus-black">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border-4 border-bauhaus-black p-8 bg-white bauhaus-shadow">
              <h2 className="text-2xl font-black mb-4 text-bauhaus-red">THE OLD WAY</h2>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> Charities guess which grants to apply for</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> Funders get 500 applications, fund 12</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> AI writes generic applications nobody reads</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> No visibility into who funds what, where</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> Relationships are transactional, adversarial</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> Small orgs doing the best work can&apos;t afford tools</li>
              </ul>
            </div>
            <div className="border-4 border-bauhaus-black p-8 bg-white bauhaus-shadow">
              <h2 className="text-2xl font-black mb-4 text-money">GRANTSCOPE</h2>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><span className="text-money font-black">✓</span> AI matches grants to your mission (0–100 score)</li>
                <li className="flex gap-3"><span className="text-money font-black">✓</span> Funders discover orgs already doing the work</li>
                <li className="flex gap-3"><span className="text-money font-black">✓</span> AI writes in YOUR voice, tailored to THEIR language</li>
                <li className="flex gap-3"><span className="text-money font-black">✓</span> Full system visibility — every dollar, every gap</li>
                <li className="flex gap-3"><span className="text-money font-black">✓</span> Relationship-based — track history, build trust</li>
                <li className="flex gap-3"><span className="text-money font-black">✓</span> Community orgs free forever. Funded by those who can pay.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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

                {/* Header */}
                <div className={`p-6 border-b-4 border-bauhaus-black ${
                  tier.key === 'community' ? 'bg-bauhaus-black text-white' :
                  tier.key === 'funder' ? 'bg-bauhaus-yellow' : 'bg-white'
                }`}>
                  <h3 className="text-lg font-black tracking-widest">{tier.name}</h3>
                  <p className={`text-xs mt-1 ${
                    tier.key === 'community' ? 'text-white/60' : 'text-bauhaus-muted'
                  }`}>
                    {tier.tagline}
                  </p>
                  <div className="mt-4">
                    <span className="text-4xl font-black">{tier.price}</span>
                    <span className={`text-sm ml-1 ${
                      tier.key === 'community' ? 'text-white/60' : 'text-bauhaus-muted'
                    }`}>
                      {tier.priceNote}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="px-6 pt-4">
                  <p className="text-xs text-bauhaus-muted">{tier.description}</p>
                </div>

                {/* Features */}
                <div className="p-6 flex-1">
                  <ul className="space-y-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-2 text-sm">
                        <span className="text-money font-black text-xs mt-0.5">●</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="p-6 pt-0">
                  {tier.ctaHref ? (
                    <Link
                      href={tier.ctaHref}
                      className={`block w-full py-3 text-center font-black text-sm uppercase tracking-widest border-4 border-bauhaus-black transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none ${
                        tier.key === 'community'
                          ? 'bg-bauhaus-black text-white hover:bg-bauhaus-black/90'
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

      {/* For Funders — why they should pay */}
      <section className="py-16 px-6 bg-bauhaus-black text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-4">
            FOR FOUNDATIONS & CORPORATE GIVING
          </h2>
          <p className="text-center text-white/60 mb-12 max-w-2xl mx-auto">
            You spend millions on grant programs. Are you finding the right people?
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="border-4 border-white/20 p-6">
              <h3 className="font-black text-bauhaus-yellow mb-3">DISCOVER, DON&apos;T ADVERTISE</h3>
              <p className="text-sm text-white/70">
                Stop waiting for applications. Search 64,000+ charities by mission alignment,
                geography, size, and track record. Find the orgs already doing the work you
                want to fund — before they even apply.
              </p>
            </div>
            <div className="border-4 border-white/20 p-6">
              <h3 className="font-black text-bauhaus-yellow mb-3">SEE YOUR PORTFOLIO</h3>
              <p className="text-sm text-white/70">
                Every dollar you&apos;ve granted, mapped by geography, theme, and outcome.
                Where are the gaps? Who are you missing? What&apos;s the overlap with other funders?
                Data you can&apos;t get anywhere else.
              </p>
            </div>
            <div className="border-4 border-white/20 p-6">
              <h3 className="font-black text-bauhaus-yellow mb-3">CUT THROUGH THE NOISE</h3>
              <p className="text-sm text-white/70">
                The grant process wastes everyone&apos;s time. Relationship-based funding works better.
                GrantScope replaces the adversarial application loop with mutual discovery —
                funders and charities find each other based on real alignment.
              </p>
            </div>
            <div className="border-4 border-white/20 p-6">
              <h3 className="font-black text-bauhaus-yellow mb-3">FUND THE COMMONS</h3>
              <p className="text-sm text-white/70">
                Your subscription funds free access for community organisations. Every dollar you
                pay removes a barrier for a grassroots org that can&apos;t afford grant-writing software.
                That&apos;s not charity — that&apos;s infrastructure.
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <a
              href="mailto:hello@grantscope.au?subject=Funder%20tier%20enquiry"
              className="inline-block py-3 px-8 font-black text-sm uppercase tracking-widest border-4 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Talk to Us About Funder Access
            </a>
          </div>
        </div>
      </section>

      {/* Cross-subsidy explainer */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-black tracking-tight mb-6">
            HOW CROSS-SUBSIDY WORKS
          </h2>
          <div className="border-4 border-bauhaus-black bg-white p-8 bauhaus-shadow">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <p className="text-3xl font-black text-bauhaus-blue">$499</p>
                <p className="text-xs text-bauhaus-muted uppercase tracking-widest mt-1">Funder pays</p>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-2xl">→</span>
              </div>
              <div>
                <p className="text-3xl font-black text-money">$0</p>
                <p className="text-xs text-bauhaus-muted uppercase tracking-widest mt-1">Community org pays</p>
              </div>
            </div>
            <p className="text-sm text-bauhaus-muted">
              One Funder subscription funds free access for dozens of community organisations.
              The organisations doing the hardest work in the hardest places shouldn&apos;t also have
              to pay for the tools to find funding. Foundations and corporates already have the budgets —
              and they get a better product because more orgs on the platform means better data,
              better discovery, and better outcomes.
            </p>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-bauhaus-black text-white py-8 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-3xl font-black">14,000+</p>
            <p className="text-xs text-white/50 uppercase tracking-widest mt-1">Grants</p>
          </div>
          <div>
            <p className="text-3xl font-black">9,800+</p>
            <p className="text-xs text-white/50 uppercase tracking-widest mt-1">Foundations</p>
          </div>
          <div>
            <p className="text-3xl font-black">64,000+</p>
            <p className="text-xs text-white/50 uppercase tracking-widest mt-1">Charities</p>
          </div>
          <div>
            <p className="text-3xl font-black">$18.9B</p>
            <p className="text-xs text-white/50 uppercase tracking-widest mt-1">Sector Size</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
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
              a: 'It reads the grant criteria and your organisation profile, then drafts an application in your voice — tailored to the funder\'s language and priorities. You review, edit, and submit. It learns from your past applications to get better over time.',
            },
            {
              q: 'How is this different from other grant platforms?',
              a: 'Most platforms help you search. GrantScope helps you win. AI matching scores every grant against your mission. Relationship tracking builds trust with funders over time. And the cross-subsidy model means the best orgs aren\'t priced out.',
            },
            {
              q: 'Can funders search for charities to fund proactively?',
              a: 'Yes. The Funder tier gives foundations and corporates tools to discover aligned organisations, view their track record, and initiate funding conversations — replacing the broken "advertise and wait" model.',
            },
            {
              q: 'Do you sell our data?',
              a: 'No. Your application data, relationship notes, and pipeline are private. The only shared data is what\'s already public — ACNC records, published grant opportunities, and foundation profiles.',
            },
          ].map((faq) => (
            <div key={faq.q} className="border-b-2 border-bauhaus-black/10 py-6">
              <h3 className="font-black text-sm uppercase tracking-widest mb-2">{faq.q}</h3>
              <p className="text-sm text-bauhaus-muted">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-6 bg-bauhaus-red text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
            THE GRANT SYSTEM IS BROKEN.
            <br />
            HELP US BUILD SOMETHING BETTER.
          </h2>
          <p className="text-white/70 mb-8">
            Whether you&apos;re a community org looking for funding or a foundation looking for impact,
            GrantScope puts you on the same side of the table.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block py-3 px-8 font-black text-sm uppercase tracking-widest border-4 border-white bg-white text-bauhaus-red bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  )
}
