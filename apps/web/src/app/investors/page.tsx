'use client'

import { useState, useEffect } from 'react'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

// ─── Password Gate ───────────────────────────────────────────────
function PasswordGate({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/investors/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        onSuccess()
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bauhaus-black flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="border-4 border-white/20 bg-bauhaus-black p-8">
          <h1 className="text-2xl font-black text-white tracking-tight mb-2">GRANTSCOPE</h1>
          <p className="text-sm text-white/40 mb-8">Investor access</p>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 bg-white/5 border-2 border-white/20 text-white placeholder-white/30 font-mono text-sm focus:outline-none focus:border-bauhaus-yellow"
              autoFocus
            />
            {error && (
              <p className="text-bauhaus-red text-xs font-black mt-2">Invalid password</p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full mt-4 py-3 bg-bauhaus-yellow text-bauhaus-black font-black text-sm uppercase tracking-widest border-4 border-bauhaus-yellow disabled:opacity-50 transition-all hover:bg-bauhaus-yellow/90"
            >
              {loading ? 'Checking...' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Revenue Model Table ─────────────────────────────────────────
const revenueModel = [
  { tier: 'Community', price: '$0', year1: '500+', year2: '2,000+', year3: '5,000+', revenue: '$0' },
  { tier: 'Professional', price: '$79/mo', year1: '30', year2: '100', year3: '250', revenue: '$2,370\u2013$19,750/mo' },
  { tier: 'Organisation', price: '$249/mo', year1: '15', year2: '50', year3: '120', revenue: '$3,735\u2013$29,880/mo' },
  { tier: 'Funder', price: '$499/mo', year1: '10', year2: '40', year3: '80', revenue: '$4,990\u2013$39,920/mo' },
  { tier: 'Enterprise', price: '$1,999/mo', year1: '2', year2: '8', year3: '20', revenue: '$3,998\u2013$39,980/mo' },
]

// ─── TAM Segments ────────────────────────────────────────────────
const tamSegments = [
  { segment: 'Registered charities (ACNC)', total: '59,000+', addressable: '~15,000', notes: 'Revenue > $250K, active programs' },
  { segment: 'Philanthropic foundations', total: '9,874', addressable: '~2,000', notes: 'Assets > $5M or active grantmaking' },
  { segment: 'Corporate giving programs', total: '~500', addressable: '~200', notes: 'ASX200 + major private companies' },
  { segment: 'Government grant managers', total: '~1,000', addressable: '~100', notes: 'State + federal departments' },
  { segment: 'Philanthropic advisors', total: '~300', addressable: '~150', notes: 'Law firms, wealth managers, consultants' },
  { segment: 'Peak bodies & intermediaries', total: '~400', addressable: '~200', notes: 'Sector peak bodies, backbone orgs' },
]

// ─── Competitive Landscape ───────────────────────────────────────
const competitors = [
  { name: 'Instrumentl (US)', price: '$199/mo', focus: 'US grant search', data: 'US only', openData: 'No', crossSubsidy: 'No' },
  { name: 'Candid/Foundation Directory (US)', price: '$199\u2013$999/mo', focus: 'US foundation data', data: 'US only', openData: 'Partial', crossSubsidy: 'No' },
  { name: '360Giving (UK)', price: 'Free (gov funded)', focus: 'UK grant data', data: 'UK only', openData: 'Yes', crossSubsidy: 'N/A' },
  { name: 'GrantScope (AU)', price: '$0\u2013$1,999/mo', focus: 'AU grants + foundations + charities', data: 'Australia', openData: 'Yes', crossSubsidy: 'Yes' },
]

// ─── Investor Deck ───────────────────────────────────────────────
function InvestorDeck() {
  return (
    <div className="min-h-screen bg-bauhaus-canvas">

      {/* HERO */}
      <section className="bg-bauhaus-black text-white py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-white/30 uppercase tracking-[0.3em] font-black mb-6">Confidential</p>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6">
            GRANTSCOPE
          </h1>
          <p className="text-xl md:text-2xl text-white/60 mb-4">
            Australia&apos;s Open Grants Infrastructure
          </p>
          <p className="text-sm text-white/30 mt-8">
            A product of ACT Ventures Pty Ltd &middot; ABN 21 591 780 066
          </p>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="py-16 px-6 border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight mb-8">THE PROBLEM</h2>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="border-4 border-bauhaus-black p-6">
              <p className="text-4xl font-black text-bauhaus-red">$222B</p>
              <p className="text-sm font-bold mt-2">Charity sector revenue</p>
              <p className="text-xs text-bauhaus-muted mt-1">Zero transparency infrastructure</p>
            </div>
            <div className="border-4 border-bauhaus-black p-6">
              <p className="text-4xl font-black text-bauhaus-red">94%</p>
              <p className="text-sm font-bold mt-2">Funding concentration</p>
              <p className="text-xs text-bauhaus-muted mt-1">Goes to 10% of organisations</p>
            </div>
            <div className="border-4 border-bauhaus-black p-6">
              <p className="text-4xl font-black text-bauhaus-red">0</p>
              <p className="text-sm font-bold mt-2">Open data platforms</p>
              <p className="text-xs text-bauhaus-muted mt-1">No 360Giving, no Candid equivalent</p>
            </div>
          </div>
          <p className="text-sm text-bauhaus-muted">
            Australia&apos;s $18.9B philanthropic sector has no transparency infrastructure.
            First Nations communities receive 0.5% of funding. The 16,000 smallest charities
            collectively lost $144M last year. The system selects for grant-writing skill,
            not impact. We&apos;re building the infrastructure to change that.
          </p>
        </div>
      </section>

      {/* THE PLATFORM */}
      <section className="py-16 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight mb-8">THE PLATFORM</h2>
          <p className="text-sm text-bauhaus-muted mb-8">
            GrantScope is live today with real data. Not a prototype — a working product
            with the largest aggregated grants dataset in Australia.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
              <p className="text-3xl font-black">59,000+</p>
              <p className="text-xs font-bold mt-2">Registered charities</p>
            </div>
            <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
              <p className="text-3xl font-black">9,874</p>
              <p className="text-xs font-bold mt-2">Foundations profiled</p>
            </div>
            <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
              <p className="text-3xl font-black">14,119</p>
              <p className="text-xs font-bold mt-2">Grants indexed</p>
            </div>
            <div className="border-4 border-bauhaus-black p-6 bg-bauhaus-canvas">
              <p className="text-3xl font-black">359,678</p>
              <p className="text-xs font-bold mt-2">Financial records</p>
            </div>
          </div>
          <p className="text-xs text-bauhaus-muted mt-4">
            100% AI-embedded for semantic search. 1,627 foundations AI-enriched with giving strategies,
            focus areas, and application guidance. 7 years of ACNC financial data cross-referenced.
          </p>
        </div>
      </section>

      {/* REVENUE MODEL */}
      <section className="py-16 px-6 border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight mb-4">REVENUE MODEL</h2>
          <p className="text-sm text-bauhaus-muted mb-8">
            Cross-subsidy SaaS: larger organisations and foundations pay, community orgs use it free.
            Annual billing available at 17% discount (2 months free).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-4 border-bauhaus-black text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black text-xs uppercase tracking-widest">Tier</th>
                  <th className="text-left p-3 font-black text-xs uppercase tracking-widest">Price</th>
                  <th className="text-center p-3 font-black text-xs uppercase tracking-widest">Y1</th>
                  <th className="text-center p-3 font-black text-xs uppercase tracking-widest">Y2</th>
                  <th className="text-center p-3 font-black text-xs uppercase tracking-widest">Y3</th>
                  <th className="text-right p-3 font-black text-xs uppercase tracking-widest">MRR Range</th>
                </tr>
              </thead>
              <tbody>
                {revenueModel.map((row, i) => (
                  <tr key={row.tier} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-bold">{row.tier}</td>
                    <td className="p-3">{row.price}</td>
                    <td className="p-3 text-center">{row.year1}</td>
                    <td className="p-3 text-center">{row.year2}</td>
                    <td className="p-3 text-center">{row.year3}</td>
                    <td className="p-3 text-right font-mono text-xs">{row.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TAM */}
      <section className="py-16 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight mb-4">TOTAL ADDRESSABLE MARKET</h2>
          <p className="text-sm text-bauhaus-muted mb-8">
            Australia alone. International expansion (NZ, Canada, UK, US) not included in these numbers.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-4 border-bauhaus-black text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black text-xs uppercase tracking-widest">Segment</th>
                  <th className="text-center p-3 font-black text-xs uppercase tracking-widest">Total</th>
                  <th className="text-center p-3 font-black text-xs uppercase tracking-widest">Addressable</th>
                  <th className="text-left p-3 font-black text-xs uppercase tracking-widest">Notes</th>
                </tr>
              </thead>
              <tbody>
                {tamSegments.map((row, i) => (
                  <tr key={row.segment} className={i % 2 === 0 ? 'bg-white' : 'bg-bauhaus-canvas'}>
                    <td className="p-3 font-bold">{row.segment}</td>
                    <td className="p-3 text-center">{row.total}</td>
                    <td className="p-3 text-center font-bold">{row.addressable}</td>
                    <td className="p-3 text-xs text-bauhaus-muted">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* PATH TO REVENUE */}
      <section className="py-16 px-6 border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight mb-8">PATH TO REVENUE</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border-4 border-bauhaus-black p-8 bg-white">
              <h3 className="font-black text-lg mb-2">$100K ARR</h3>
              <p className="text-xs text-bauhaus-muted mb-4">~60 paying customers</p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2"><span className="text-money font-black">{'\u25CF'}</span> 20 Professional ($79 &times; 12 = $18,960)</li>
                <li className="flex gap-2"><span className="text-money font-black">{'\u25CF'}</span> 15 Organisation ($249 &times; 12 = $44,820)</li>
                <li className="flex gap-2"><span className="text-money font-black">{'\u25CF'}</span> 5 Funder ($499 &times; 12 = $29,940)</li>
                <li className="flex gap-2"><span className="text-money font-black">{'\u25CF'}</span> 1 Enterprise ($1,999 &times; 12 = $23,988)</li>
              </ul>
              <p className="text-xs text-bauhaus-muted mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                <strong>Total: $117,708 ARR</strong> from 41 paid + 500+ free community users
              </p>
            </div>
            <div className="border-4 border-bauhaus-black p-8 bg-white">
              <h3 className="font-black text-lg mb-2">$500K ARR</h3>
              <p className="text-xs text-bauhaus-muted mb-4">~225 paying customers</p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2"><span className="text-money font-black">{'\u25CF'}</span> 80 Professional ($79 &times; 12 = $75,840)</li>
                <li className="flex gap-2"><span className="text-money font-black">{'\u25CF'}</span> 60 Organisation ($249 &times; 12 = $179,280)</li>
                <li className="flex gap-2"><span className="text-money font-black">{'\u25CF'}</span> 25 Funder ($499 &times; 12 = $149,700)</li>
                <li className="flex gap-2"><span className="text-money font-black">{'\u25CF'}</span> 5 Enterprise ($1,999 &times; 12 = $119,940)</li>
              </ul>
              <p className="text-xs text-bauhaus-muted mt-4 border-t-2 border-bauhaus-black/10 pt-4">
                <strong>Total: $524,760 ARR</strong> from 170 paid + 2,000+ free community users
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* COMPETITIVE LANDSCAPE */}
      <section className="py-16 px-6 bg-bauhaus-black text-white border-b-4 border-white/10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight mb-8">COMPETITIVE LANDSCAPE</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-4 border-white/20 text-sm">
              <thead>
                <tr className="border-b-2 border-white/20">
                  <th className="text-left p-3 font-black text-xs uppercase tracking-widest text-bauhaus-yellow">Platform</th>
                  <th className="text-left p-3 font-black text-xs uppercase tracking-widest text-bauhaus-yellow">Price</th>
                  <th className="text-left p-3 font-black text-xs uppercase tracking-widest text-bauhaus-yellow">Market</th>
                  <th className="text-center p-3 font-black text-xs uppercase tracking-widest text-bauhaus-yellow">Open Data</th>
                  <th className="text-center p-3 font-black text-xs uppercase tracking-widest text-bauhaus-yellow">Cross-Subsidy</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((row) => (
                  <tr key={row.name} className={`border-b border-white/10 ${row.name.includes('GrantScope') ? 'bg-white/5' : ''}`}>
                    <td className={`p-3 ${row.name.includes('GrantScope') ? 'font-black text-bauhaus-yellow' : 'text-white/80'}`}>{row.name}</td>
                    <td className="p-3 text-white/60">{row.price}</td>
                    <td className="p-3 text-white/60">{row.data}</td>
                    <td className="p-3 text-center text-white/60">{row.openData}</td>
                    <td className="p-3 text-center text-white/60">{row.crossSubsidy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-white/30 mt-6">
            Key differentiator: GrantScope is the only platform combining grant search, foundation intelligence,
            charity discovery, and money-trail mapping in a single product — with a cross-subsidy model that
            ensures community access.
          </p>
        </div>
      </section>

      {/* INTERNATIONAL EXPANSION */}
      <section className="py-16 px-6 border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight mb-8">INTERNATIONAL EXPANSION</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { flag: 'NZ', label: 'New Zealand', timeline: 'Year 2', notes: 'Similar regulatory framework (Charities Services), shared language' },
              { flag: 'CA', label: 'Canada', timeline: 'Year 2\u20133', notes: 'CRA T3010 data, bilingual (EN/FR), $19B charitable sector' },
              { flag: 'UK', label: 'United Kingdom', timeline: 'Year 3', notes: 'Complement 360Giving with AI layer, Charity Commission data' },
              { flag: 'US', label: 'United States', timeline: 'Year 3\u20134', notes: 'IRS 990 data, $500B+ market, compete with Instrumentl/Candid' },
            ].map((market) => (
              <div key={market.flag} className="border-4 border-bauhaus-black p-6 bg-white">
                <p className="text-2xl font-black mb-1">{market.flag}</p>
                <p className="text-sm font-bold">{market.label}</p>
                <p className="text-xs text-bauhaus-muted mt-1">{market.timeline}</p>
                <p className="text-xs text-bauhaus-muted mt-2">{market.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXIT POTENTIAL */}
      <section className="py-16 px-6 bg-white border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight mb-8">EXIT POTENTIAL</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border-4 border-bauhaus-black p-8">
              <h3 className="font-black text-lg mb-4">SaaS Multiples</h3>
              <ul className="space-y-3 text-sm">
                <li><strong>Vertical SaaS:</strong> 8&ndash;15x ARR (mission-critical, high switching costs)</li>
                <li><strong>Data/Intelligence platforms:</strong> 10&ndash;20x ARR (proprietary dataset)</li>
                <li><strong>At $500K ARR:</strong> $4M&ndash;$10M valuation range</li>
                <li><strong>At $2M ARR:</strong> $16M&ndash;$40M valuation range</li>
              </ul>
            </div>
            <div className="border-4 border-bauhaus-black p-8">
              <h3 className="font-black text-lg mb-4">Comparable: Bonterra</h3>
              <p className="text-sm text-bauhaus-muted mb-4">
                Apax Partners acquired social-good tech companies (EveryAction, Social Solutions,
                CyberGrants) and merged them into Bonterra — valued at $1.8B.
              </p>
              <p className="text-sm text-bauhaus-muted">
                GrantScope occupies a similar space (grants + foundations + nonprofits) but with
                open data and a cross-subsidy model that builds network effects faster.
              </p>
            </div>
          </div>
          <div className="mt-8 border-4 border-money bg-money/5 p-6">
            <p className="text-sm font-bold text-center">
              ACT Ventures is mission-locked: 40% of profits are shared with community partners.
              Any exit or liquidity event maintains this commitment.
            </p>
          </div>
        </div>
      </section>

      {/* THE TEAM */}
      <section className="py-16 px-6 border-b-4 border-bauhaus-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight mb-8">THE TEAM</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border-4 border-bauhaus-black p-8 bg-white">
              <h3 className="font-black text-lg mb-1">Benjamin Knight</h3>
              <p className="text-xs text-bauhaus-muted uppercase tracking-widest mb-4">Co-Founder &middot; Systems Designer</p>
              <p className="text-sm text-bauhaus-muted">
                Full-stack engineer and systems thinker. Built GrantScope&apos;s entire data pipeline,
                AI enrichment system, and multi-interface platform. Background in enterprise SaaS,
                data engineering, and community-led design.
              </p>
            </div>
            <div className="border-4 border-bauhaus-black p-8 bg-white">
              <h3 className="font-black text-lg mb-1">Nicholas Marchesi OAM</h3>
              <p className="text-xs text-bauhaus-muted uppercase tracking-widest mb-4">Co-Founder &middot; Impact & Partnerships</p>
              <p className="text-sm text-bauhaus-muted">
                Co-founder of Orange Sky (Australia&apos;s first free mobile laundry service).
                2016 Young Australian of the Year. Deep relationships across the philanthropic
                and government sectors. Knows what community organisations actually need.
              </p>
            </div>
          </div>
          <p className="text-sm text-bauhaus-muted mt-6 text-center">
            GrantScope is built by{' '}
            <a href="https://act.place" className="text-bauhaus-blue font-bold hover:underline" target="_blank" rel="noopener noreferrer">
              ACT (A Curious Tractor)
            </a>
            {' '}&mdash; a regenerative innovation ecosystem partnering with marginalised communities
            to build the infrastructure they need to own their narratives, land, and economic futures.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-bauhaus-black text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-6">
            LET&apos;S TALK.
          </h2>
          <p className="text-white/50 text-lg mb-10">
            We&apos;re building Australia&apos;s grants infrastructure. If you want to be part of it,
            we&apos;d love to hear from you.
          </p>
          <a
            href="mailto:benjamin@act.place?subject=GrantScope%20%E2%80%94%20Investor%20Enquiry"
            className="inline-block py-4 px-12 font-black text-sm uppercase tracking-widest border-4 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black transition-all hover:bg-bauhaus-yellow/90"
          >
            benjamin@act.place
          </a>
        </div>
      </section>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────
export default function InvestorsPage() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const cookie = getCookie('investors_auth')
    if (cookie === 'true') {
      setAuthed(true)
    }
    setChecking(false)
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen bg-bauhaus-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!authed) {
    return <PasswordGate onSuccess={() => setAuthed(true)} />
  }

  return <InvestorDeck />
}
