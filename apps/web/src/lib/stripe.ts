import Stripe from 'stripe'

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null as unknown as Stripe

// Tier configuration — single source of truth
// Cross-subsidy model: large orgs + foundations fund free community access
export const TIERS = {
  community: {
    name: 'Community',
    tagline: 'Your work matters more than your budget',
    description: 'For grassroots nonprofits, First Nations organisations, and small teams under $500K revenue',
    price: 0,
    stripePriceId: null,
    features: [
      'Grant search',
      'Foundation profiles',
      'Save & shortlist grants',
      'Basic email alerts',
      '1 team member',
    ],
  },
  professional: {
    name: 'Professional',
    tagline: 'Match. Monitor. Manage the pipeline.',
    description: 'For grant consultants, freelance writers, and solo grants or fundraising leads',
    price: 79,
    stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL,
    trialDays: 14,
    features: [
      'Everything in Community',
      'Org-fit grant matching',
      'Advanced alerts and watchlists',
      'Pipeline tracking',
      'Foundation prospect notes',
      'Weekly digest',
      '5 team members',
    ],
  },
  organisation: {
    name: 'Organisation',
    tagline: 'Shared workflow for funding teams',
    description: 'For grant teams, development teams, and advisory firms managing multiple active opportunities',
    price: 249,
    stripePriceId: process.env.STRIPE_PRICE_ORGANISATION,
    trialDays: 14,
    features: [
      'Everything in Professional',
      'Shared team workspace',
      'Org-wide pipeline dashboard',
      'Board or client export reports',
      'Calendar integration',
      'Funder shortlist collaboration',
      '25 team members',
    ],
  },
  funder: {
    name: 'Funder',
    tagline: 'Prospecting and portfolio intelligence',
    description: 'For foundations, corporate giving, philanthropic advisors, and commissioners',
    price: 499,
    stripePriceId: process.env.STRIPE_PRICE_FUNDER,
    trialDays: 14,
    features: [
      'Everything in Organisation',
      'Portfolio intelligence',
      'Gap analysis — where money isn\'t going',
      'Prospect discovery across entities',
      'Read-only API access',
      'White-label option',
      'Unlimited team members',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    tagline: 'The full platform, your way.',
    description: 'For state/federal government, large foundations, and sector-wide deployments',
    price: 1999,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE,
    trialDays: 0,
    features: [
      'Everything in Funder',
      'Full API access',
      'Custom reports & dashboards',
      'White-label deployment',
      'Dedicated support & onboarding',
      'SSO / SAML integration',
      'Unlimited everything',
    ],
  },
} as const

export type TierKey = keyof typeof TIERS

// ── Agent API Tiers ────────────────────────────────────────────────────────
// Used on /agent pricing and for agent API billing
export const AGENT_TIERS = {
  explorer: {
    name: 'Explorer',
    price: 0,
    stripePriceId: null,
    rateLimit: 20,
    features: [
      '20 requests/minute',
      'All 6 actions',
      'IP-based rate limiting',
      'Community support',
    ],
  },
  builder: {
    name: 'Builder',
    price: 0, // Free during beta
    stripePriceId: process.env.STRIPE_PRICE_AGENT_BUILDER || null,
    rateLimit: 60,
    features: [
      '60 requests/minute',
      'Usage dashboard + analytics',
      'NL→SQL queries',
      'Up to 5 API keys',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: null, // Custom pricing
    stripePriceId: process.env.STRIPE_PRICE_AGENT_ENTERPRISE || null,
    rateLimit: null, // Unlimited
    features: [
      'Unlimited requests',
      'Dedicated support',
      'Custom endpoints',
      'White-label + SSO',
    ],
  },
} as const

export type AgentTierKey = keyof typeof AGENT_TIERS
