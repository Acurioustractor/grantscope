import Stripe from 'stripe'

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null as unknown as Stripe

// Annual discount: 2 months free = ~17% off
export const ANNUAL_DISCOUNT = 0.17

// Tier configuration — single source of truth
// Cross-subsidy model: large orgs + foundations fund free community access
export const TIERS = {
  community: {
    name: 'Community',
    tagline: 'Your work matters more than your budget',
    description: 'For grassroots NFPs, First Nations orgs, and CLCs under $500K revenue',
    price: 0,
    stripePriceId: null,
    features: [
      'Full grant search (14,000+ opportunities)',
      'Foundation profiles (9,800+)',
      'Save & track grants',
      'Basic email alerts',
      '1 team member',
    ],
  },
  professional: {
    name: 'Professional',
    tagline: 'Stop guessing, start winning',
    description: 'For established NFPs and social enterprises',
    price: 79,
    stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL,
    features: [
      'Everything in Community',
      'AI grant writing assistant',
      'Smart match scoring (0-100)',
      'Custom alert rules',
      'Pipeline tracking',
      'Foundation relationship notes',
      '5 team members',
    ],
  },
  organisation: {
    name: 'Organisation',
    tagline: 'Your whole funding operation in one place',
    description: 'For larger NFPs, peak bodies, and multi-program orgs',
    price: 249,
    stripePriceId: process.env.STRIPE_PRICE_ORGANISATION,
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
  },
  funder: {
    name: 'Funder',
    tagline: 'See the whole system. Fund what works.',
    description: 'For foundations, corporate giving, philanthropic advisors, and government',
    price: 499,
    stripePriceId: process.env.STRIPE_PRICE_FUNDER,
    features: [
      'Everything in Organisation',
      'Portfolio view — who you fund, outcomes, geography',
      'Gap analysis — where money isn\'t going',
      'Deal flow — discover aligned orgs',
      'Data API access',
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
