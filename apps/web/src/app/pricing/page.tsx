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
      'Smart match scoring (0\u2013100)',
      'Custom alert rules',
      'Pipeline tracking',
      'Foundation relationship notes',
      '5 team members',
    ],
    cta: 'Start Free Trial',
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
    highlight: true,
  },
  {
    key: 'funder',
    name: 'FUNDER',
    tagline: 'See the whole system. Fund what works.',
    price: '$499',
    priceNote: '/month',
    description: 'For foundations, corporate giving, philanthropic advisors, and government',
    features: [
      'Everything in Organisation',
      'Portfolio view \u2014 outcomes & geography',
      'Gap analysis \u2014 where money isn\'t going',
      'Deal flow \u2014 discover aligned orgs',
      'Foundation scorecard & benchmarking',
      'Data API access',
      'White-label option',
      'Unlimited team members',
    ],
    cta: 'Talk to Us',
    ctaHref: 'mailto:hello@grantscope.au?subject=Funder%20tier%20enquiry',
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

      {/* ===== HERO: THE PROBLEM ===== */}
      <section className="bg-bauhaus-black text-white py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-sm text-white/40 uppercase tracking-[0.3em] font-black mb-8">
            Australia&apos;s $18.9 billion philanthropic sector
          </p>
          <h1 className="text-5xl md:text-8xl font-black tracking-tight mb-8">
            94% OF DONATIONS GO TO 10% OF ORGANISATIONS.
          </h1>
          <p className="text-xl md:text-2xl font-medium text-white/60 max-w-3xl mx-auto mb-4">
            First Nations communities receive 0.5% of funding despite being 3.8% of the population.
            Women and girls get 12% despite being half.
            The 16,000 smallest charities collectively lost $144 million last year.
          </p>
          <p className="text-lg text-white/40 mt-8">
            The system isn&apos;t broken by accident. It&apos;s broken by design.
          </p>
        </div>
      </section>

      {/* ===== THE INVISIBLE MADE VISIBLE ===== */}
      <section className="py-16 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-5xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
            WE BUILT THE X-RAY
          </h2>
          <p className="text-bauhaus-muted max-w-2xl mx-auto">
            GrantScope maps every dollar flowing through Australia&apos;s philanthropic system.
            From extraction to foundation to community. For the first time, anyone can see where
            the money goes — and where it doesn&apos;t.
          </p>
        </div>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { stat: '$222B', label: 'Charity sector revenue mapped', sub: '7 years of ACNC data' },
            { stat: '359,678', label: 'Financial records analysed', sub: 'Every registered charity' },
            { stat: '14,119', label: 'Grant opportunities indexed', sub: '100% AI-embedded for search' },
            { stat: '9,874', label: 'Foundations profiled', sub: '1,627 AI-enriched' },
          ].map((item) => (
            <div key={item.label} className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
              <p className="text-3xl md:text-4xl font-black">{item.stat}</p>
              <p className="text-sm font-bold mt-2">{item.label}</p>
              <p className="text-xs text-bauhaus-muted mt-1">{item.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== THE TWO SIDES ===== */}
      <section className="py-16 px-6 border-b-4 border-bauhaus-black">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight text-center mb-12">
            TWO SIDES OF THE SAME BROKEN TABLE
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border-4 border-bauhaus-black p-8 bg-white bauhaus-shadow">
              <h3 className="text-xl font-black mb-2">IF YOU&apos;RE A CHARITY</h3>
              <p className="text-sm text-bauhaus-muted mb-4">You already know this:</p>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> You spend 40% of your time chasing grants instead of doing the work</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> You apply to 30 grants, win 3, and can&apos;t tell why</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> AI tools write generic applications that funders can smell from a mile away</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> You have no idea what other funders exist for your work</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> The orgs with the biggest grant teams win, not the best programs</li>
              </ul>
            </div>
            <div className="border-4 border-bauhaus-black p-8 bg-white bauhaus-shadow">
              <h3 className="text-xl font-black mb-2">IF YOU&apos;RE A FUNDER</h3>
              <p className="text-sm text-bauhaus-muted mb-4">You probably know this too:</p>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> You get 500 applications per round and fund 12</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> The best community orgs never apply — they don&apos;t know you exist</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> You can&apos;t see where your funding overlaps with other foundations</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> Your grant process selects for grant-writing skill, not impact</li>
                <li className="flex gap-3"><span className="text-bauhaus-red font-black">✕</span> You have no benchmark for your giving ratio, executive pay, or impact</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-4 border-money bg-money/5 p-8">
            <h3 className="text-xl font-black text-money mb-4 text-center">GRANTSCOPE PUTS YOU ON THE SAME SIDE</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><span className="text-money font-black">✓</span> <strong>Charities:</strong> AI matches grants to your mission with a 0\u2013100 score. Stop guessing.</li>
                <li className="flex gap-3"><span className="text-money font-black">✓</span> <strong>Charities:</strong> AI writes in YOUR voice, tailored to THEIR language and priorities.</li>
                <li className="flex gap-3"><span className="text-money font-black">✓</span> <strong>Charities:</strong> Track every foundation relationship. Know your history before they do.</li>
              </ul>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3"><span className="text-money font-black">✓</span> <strong>Funders:</strong> Search 64,000+ charities by alignment, geography, and track record.</li>
                <li className="flex gap-3"><span className="text-money font-black">✓</span> <strong>Funders:</strong> See your giving ratio, executive pay benchmarks, and portfolio gaps.</li>
                <li className="flex gap-3"><span className="text-money font-black">✓</span> <strong>Funders:</strong> Find the orgs doing the work — don&apos;t wait for them to find you.</li>
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
            We&apos;ve analysed 7 years of ACNC financial records, cross-referenced with ATO data,
            corporate filings, and public grant disclosures. This is what we found.
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
            <h3 className="font-black text-bauhaus-yellow mb-4">THE FOUNDATION SCORECARD</h3>
            <p className="text-sm text-white/60 mb-6">
              Every foundation on GrantScope gets a transparency score. Giving ratio, executive
              compensation, asset growth, grant distribution, geographic reach. Real accountability.
              Here&apos;s what that looks like:
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
              Real foundation data from ACNC filings. Names available to Funder tier subscribers.
            </p>
          </div>
        </div>
      </section>

      {/* ===== WHAT CHANGES ===== */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-center mb-4">
            WHAT CHANGES WHEN EVERYONE CAN SEE
          </h2>
          <p className="text-center text-bauhaus-muted mb-12 max-w-2xl mx-auto">
            Transparency isn&apos;t punishment. It&apos;s infrastructure for trust.
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                before: 'Charities apply blindly to hundreds of grants',
                after: 'AI scores every grant against your mission. Apply to the ones you\'ll win.',
                icon: '🎯',
              },
              {
                before: 'Funders advertise and wait for applications',
                after: 'Search 64,000+ charities. Find the orgs already doing the work you want to fund.',
                icon: '🔍',
              },
              {
                before: 'Nobody knows where the money actually goes',
                after: 'Every dollar tracked from source through foundation to community. Gaps visible.',
                icon: '📊',
              },
              {
                before: 'Grant writing is a professional sport for the privileged',
                after: 'AI writes in your voice. Community orgs compete on impact, not prose.',
                icon: '✍️',
              },
              {
                before: 'Relationships are transactional — submit, wait, reject',
                after: 'Track every conversation, every application, every outcome. Build trust over years.',
                icon: '🤝',
              },
              {
                before: 'Small orgs can\'t afford the tools that big orgs take for granted',
                after: 'Cross-subsidy: funders pay, community access is free. The way it should be.',
                icon: '⚖️',
              },
            ].map((item) => (
              <div key={item.before} className="border-4 border-bauhaus-black bg-white p-6">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-sm text-bauhaus-red line-through mt-3 mb-2">{item.before}</p>
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
            CHOOSE YOUR ROLE IN THE SYSTEM
          </h2>
          <p className="text-bauhaus-muted max-w-2xl mx-auto">
            Large organisations and foundations pay. Community orgs use it free.
            That&apos;s not a business model — it&apos;s a belief about how the world should work.
          </p>
        </div>
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

                <div className="px-6 pt-4">
                  <p className="text-xs text-bauhaus-muted">{tier.description}</p>
                </div>

                <div className="p-6 flex-1">
                  <ul className="space-y-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-2 text-sm">
                        <span className="text-money font-black text-xs mt-0.5">{'\u25CF'}</span>
                        {feature}
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
            say about yourself — it&apos;s what the data says. GrantScope surfaces that data.
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
                GrantScope lets you find them by what they do, not by how well they write.
                Search by mission alignment, geography, community served, and track record.
                Then reach out directly.
              </p>
            </div>
            <div className="border-4 border-white/20 p-8">
              <h3 className="font-black text-bauhaus-yellow mb-4 text-lg">BENCHMARK YOURSELF</h3>
              <p className="text-sm text-white/70 mb-4">
                What&apos;s your giving ratio? How does your executive compensation compare to
                your grant distribution? What percentage of your funding reaches First Nations
                communities? Regional areas? Women-led organisations?
              </p>
              <p className="text-sm text-white/70">
                Every foundation can now see how they compare. Not to shame — to improve.
                The foundations with the best scores will wear them proudly.
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
              href="mailto:hello@grantscope.au?subject=Funder%20tier%20enquiry"
              className="inline-block py-4 px-10 font-black text-sm uppercase tracking-widest border-4 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Talk to Us About Funder Access
            </a>
          </div>
        </div>
      </section>

      {/* ===== THE MONEY TRAIL ===== */}
      <section className="py-16 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight text-center mb-4">
            FOLLOW THE MONEY
          </h2>
          <p className="text-center text-bauhaus-muted mb-12 max-w-2xl mx-auto">
            For the first time in Australia, you can trace funding from its source —
            through foundations — to community impact. No other platform does this.
          </p>

          <div className="flex flex-col md:flex-row items-stretch gap-0">
            {[
              { label: 'SOURCE', desc: 'Mining, finance, property, family wealth', color: 'bg-bauhaus-black text-white' },
              { label: 'FOUNDATION', desc: 'Endowments, trusts, corporate giving programs', color: 'bg-bauhaus-yellow' },
              { label: 'GRANT', desc: 'Programs, rounds, partnerships, sponsorships', color: 'bg-bauhaus-blue text-white' },
              { label: 'COMMUNITY', desc: 'The organisations and people doing the work', color: 'bg-money text-white' },
            ].map((step, i) => (
              <div key={step.label} className="flex-1 flex flex-col">
                <div className={`${step.color} p-6 border-4 border-bauhaus-black flex-1`}>
                  <p className="text-xs font-black uppercase tracking-widest mb-2">{step.label}</p>
                  <p className="text-xs opacity-70">{step.desc}</p>
                </div>
                {i < 3 && (
                  <div className="flex justify-center py-2 md:hidden">
                    <span className="text-xl font-black">↓</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
            <p className="text-sm text-center">
              <strong>$1.1 billion</strong> of corporate giving comes from mining, gambling,
              and fossil fuel companies. Communities have a right to know where their funding originates.
              GrantScope makes it visible.
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
            AUSTRALIA HAS NO 360GIVING.
            <br />
            <span className="text-bauhaus-yellow">WE&apos;RE BUILDING IT.</span>
          </h2>
          <p className="text-white/50 text-lg mb-6">
            The UK has 360Giving — open data on every grant made by every foundation.
            The US has Candid. Australia has nothing.
          </p>
          <p className="text-white/50 text-lg mb-6">
            We&apos;re not waiting for government to build it. We&apos;re not waiting for
            the sector to agree on a standard. We&apos;re building the infrastructure now,
            with the data that already exists, and making it free for the people who need it most.
          </p>
          <p className="text-white/70 text-xl font-bold mt-8">
            This isn&apos;t a grant search engine.
            <br />
            It&apos;s the operating system for a fairer funding landscape.
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
              a: 'Most platforms help you search. GrantScope helps you win AND helps you see. We have 7 years of ACNC financial data, AI-enriched foundation profiles, giving ratio scorecards, and the only money-trail mapping in Australia. Plus the cross-subsidy model means the best orgs aren\'t priced out.',
            },
            {
              q: 'Can funders search for charities proactively?',
              a: 'Yes. The Funder tier lets foundations and corporates search by mission alignment, geography, community served, and track record — then reach out directly. No more "advertise and wait." Find the orgs already doing the work.',
            },
            {
              q: 'Where does your data come from?',
              a: 'ACNC public registers (359,678 financial records), state and federal grant portals (14,119 grants), ATO DGR data, foundation websites (AI-enriched), and ASIC corporate filings. All public data, aggregated and analysed for the first time.',
            },
            {
              q: 'Do you sell our data?',
              a: 'No. Your application data, relationship notes, and pipeline are private. The only shared data is what\'s already public — ACNC records, published grant opportunities, and foundation profiles.',
            },
            {
              q: 'Why should our foundation pay when the data is public?',
              a: 'The data is public. The intelligence isn\'t. We\'ve spent thousands of hours aggregating, cleaning, enriching, and cross-referencing data that exists in dozens of disconnected registries. And your subscription funds free access for community orgs — that\'s part of the value.',
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
            THE SYSTEM CHANGES
            <br />
            WHEN EVERYONE CAN SEE IT.
          </h2>
          <p className="text-white/70 text-lg mb-10">
            Whether you&apos;re a community org looking for funding, a foundation looking for impact,
            or a researcher looking for truth — GrantScope is built for you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="inline-block py-4 px-10 font-black text-sm uppercase tracking-widest border-4 border-white bg-white text-bauhaus-red bauhaus-shadow-sm transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
            >
              Get Started Free
            </Link>
            <a
              href="mailto:hello@grantscope.au?subject=Funder%20tier%20enquiry"
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
