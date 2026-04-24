'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { startCheckoutForTier } from '@/lib/start-checkout';
import { resolveSubscriptionTier, TIER_LABELS } from '@/lib/subscription';

interface TeamMember {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  email: string | null;
  role: string;
  invited_at: string | null;
  accepted_at: string | null;
}

interface ClaimedCharity {
  id: string;
  abn: string;
  status: string;
  organisation_name: string | null;
  created_at: string;
}

const DOMAIN_OPTIONS = [
  'indigenous', 'youth', 'education', 'environment', 'health',
  'disability', 'housing', 'arts', 'community', 'justice',
  'agriculture', 'technology', 'social enterprise', 'women',
  'mental health', 'aged care', 'sport', 'multicultural',
];

const GEO_OPTIONS = [
  'national', 'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt',
  'rural', 'remote', 'urban', 'regional',
];

const ORG_TYPES = [
  { value: '', label: "I don't know yet" },
  { value: 'charity', label: 'Registered Charity' },
  { value: 'nfp', label: 'Not-for-Profit' },
  { value: 'social_enterprise', label: 'Social Enterprise' },
  { value: 'cooperative', label: 'Cooperative' },
  { value: 'indigenous_corp', label: 'Indigenous Corporation (CATSI)' },
  { value: 'startup', label: 'Startup' },
  { value: 'government', label: 'Government' },
  { value: 'university', label: 'University / Research' },
  { value: 'collective', label: 'Unincorporated Collective' },
];

const ORG_STATUSES = [
  { value: 'exploring', label: 'Exploring', description: "We're figuring out what we want to be" },
  { value: 'pre_formation', label: 'Pre-formation', description: 'We know what we want to be, working towards it' },
  { value: 'auspiced', label: 'Auspiced', description: "Operating under another organisation's ABN" },
  { value: 'incorporated', label: 'Incorporated', description: 'We have our own ABN and legal structure' },
];

interface Recommendation {
  type: string;
  description: string;
  benefit: string;
  requirement: string;
  url: string;
}

function getFormationRecommendations(profile: OrgProfile): Recommendation[] {
  const recs: Recommendation[] = [];
  const domains = profile.domains || [];
  const revenue = parseFloat(profile.annual_revenue) || 0;
  const orgType = profile.org_type;

  if (domains.includes('indigenous')) {
    recs.push({
      type: 'Indigenous Corporation (CATSI)',
      description: 'A corporation governed by Aboriginal and Torres Strait Islander people, registered under the CATSI Act.',
      benefit: 'Self-determined governance, access to Indigenous-specific funding, cultural authority recognised',
      requirement: 'Must have minimum 5 Indigenous members, register with ORIC',
      url: 'https://www.oric.gov.au/start-corporation',
    });
  }

  if (revenue > 0 || orgType === 'social_enterprise') {
    recs.push({
      type: 'Social Enterprise',
      description: 'A business that trades to intentionally tackle social problems, improve communities, or protect the environment.',
      benefit: 'Can generate own revenue, access impact investment, eligible for social enterprise grants',
      requirement: 'No specific registration — can be a company limited by guarantee or cooperative',
      url: 'https://www.socialtraders.com.au/about-social-enterprise/',
    });
  }

  if (orgType === 'cooperative') {
    recs.push({
      type: 'Cooperative',
      description: 'A member-owned organisation where members share decision-making and benefits equally.',
      benefit: 'Democratic governance, shared resources, member loyalty',
      requirement: 'Register under state/territory co-operatives legislation, minimum 5 members',
      url: 'https://bfrsa.org.au/cooperatives/',
    });
  }

  if (domains.includes('community') || domains.includes('health') || domains.includes('education')) {
    recs.push({
      type: 'Registered Charity (ACNC)',
      description: 'A not-for-profit with charitable purposes, registered with the Australian Charities and Not-for-profits Commission.',
      benefit: 'Tax concessions, DGR eligibility (tax-deductible donations), public trust',
      requirement: 'Must register with ACNC, meet governance standards, report annually',
      url: 'https://www.acnc.gov.au/for-charities/start-charity',
    });
  }

  if (recs.length === 0 || (!domains.includes('indigenous') && revenue === 0)) {
    recs.push({
      type: 'Incorporated Association',
      description: 'The simplest legal structure for a not-for-profit — registered at state level, run by members.',
      benefit: 'Cheapest to set up ($50-200), limited liability for members, can open bank accounts and sign leases',
      requirement: 'Register with your state fair trading office, need a constitution and minimum 5 members',
      url: 'https://www.nfplaw.org.au/free-resources/setting-up-an-nfp/incorporated-associations',
    });
  }

  return recs;
}

interface Project {
  name: string;
  description: string;
  status: string;
}

interface OrgProfile {
  id?: string;
  name: string;
  mission: string;
  description: string;
  abn: string;
  website: string;
  domains: string[];
  geographic_focus: string[];
  org_type: string;
  annual_revenue: string;
  team_size: string;
  projects: Project[];
  notify_email: boolean;
  notify_threshold: number;
  org_status: string;
  auspice_org_name: string;
  stripe_customer_id?: string | null;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_trial_end?: string | null;
  subscription_current_period_end?: string | null;
  subscription_cancel_at_period_end?: boolean;
}

const EMPTY_PROFILE: OrgProfile = {
  name: '',
  mission: '',
  description: '',
  abn: '',
  website: '',
  domains: [],
  geographic_focus: [],
  org_type: '',
  annual_revenue: '',
  team_size: '',
  projects: [],
  notify_email: true,
  notify_threshold: 0.75,
  org_status: 'exploring',
  auspice_org_name: '',
  stripe_customer_id: null,
  subscription_plan: 'community',
  subscription_status: null,
  subscription_trial_end: null,
  subscription_current_period_end: null,
  subscription_cancel_at_period_end: false,
};

interface MatchedGrant {
  id: string;
  name: string;
  provider: string;
  description: string;
  amount_max: number | null;
  closes_at: string | null;
  categories: string[];
  url: string | null;
  grant_type: string;
  fit_score: number;
}

function getIsImpersonating(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('cg_impersonate_org='));
}

function getSafeRedirect(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

function getBillingSource(value: string | null): string {
  if (!value) return 'profile_billing_panel';
  const normalized = value.trim().slice(0, 80);
  return normalized.length > 0 ? normalized : 'profile_billing_panel';
}

function formatBillingDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getBillingStatusDetails(profile: OrgProfile) {
  const tier = resolveSubscriptionTier(profile.subscription_plan);
  const planLabel = TIER_LABELS[tier];
  const status = (profile.subscription_status || '').toLowerCase();
  const trialEnd = formatBillingDate(profile.subscription_trial_end);
  const periodEnd = formatBillingDate(profile.subscription_current_period_end);

  if (profile.subscription_cancel_at_period_end && periodEnd) {
    return {
      planLabel,
      statusLabel: 'Ending',
      toneClass: 'bg-bauhaus-red text-white',
      summary: `${planLabel} stays active until ${periodEnd}.`,
      detail: 'Billing is set to cancel at the end of the current period.',
      nextLabel: 'Ends',
      nextValue: periodEnd,
    };
  }

  switch (status) {
    case 'trialing':
      return {
        planLabel,
        statusLabel: 'Trialing',
        toneClass: 'bg-bauhaus-yellow text-bauhaus-black',
        summary: `${planLabel} trial is live.`,
        detail: trialEnd
          ? `Your free trial ends on ${trialEnd}.`
          : 'Your free trial is active now.',
        nextLabel: 'Trial ends',
        nextValue: trialEnd,
      };
    case 'active':
      return {
        planLabel,
        statusLabel: 'Active',
        toneClass: 'bg-bauhaus-blue text-white',
        summary: `${planLabel} is active.`,
        detail: periodEnd
          ? `Your next renewal is ${periodEnd}.`
          : 'Billing is active for this workspace.',
        nextLabel: 'Renews',
        nextValue: periodEnd,
      };
    case 'past_due':
    case 'unpaid':
      return {
        planLabel,
        statusLabel: 'Needs attention',
        toneClass: 'bg-bauhaus-red text-white',
        summary: `Payment needs attention for ${planLabel}.`,
        detail: periodEnd
          ? `The current billing period ends on ${periodEnd}.`
          : 'Update billing details to keep access uninterrupted.',
        nextLabel: 'Period ends',
        nextValue: periodEnd,
      };
    case 'canceled':
    case 'cancelled':
      return {
        planLabel,
        statusLabel: 'Ended',
        toneClass: 'bg-bauhaus-black text-white',
        summary: `${planLabel} has ended.`,
        detail: periodEnd
          ? `Your last billing period ended on ${periodEnd}.`
          : 'This workspace is currently on the Community plan.',
        nextLabel: 'Ended',
        nextValue: periodEnd,
      };
    default:
      return {
        planLabel,
        statusLabel: tier === 'community' ? 'Community' : 'Syncing',
        toneClass: tier === 'community' ? 'bg-bauhaus-black text-white' : 'bg-bauhaus-yellow text-bauhaus-black',
        summary: tier === 'community' ? 'Community plan is active.' : `${planLabel} checkout completed.`,
        detail: tier === 'community'
          ? 'Upgrade when you want alerts, weekly digests, and shared pipeline workflow.'
          : 'Billing is syncing. Refresh in a moment if the status has not appeared yet.',
        nextLabel: trialEnd ? 'Trial ends' : periodEnd ? 'Renews' : null,
        nextValue: trialEnd || periodEnd,
      };
  }
}

export function ProfileClient() {
  const [profile, setProfile] = useState<OrgProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const isImpersonating = getIsImpersonating();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<MatchedGrant[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [savingGrant, setSavingGrant] = useState<string | null>(null);
  const [claims, setClaims] = useState<ClaimedCharity[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [openingBillingPortal, setOpeningBillingPortal] = useState(false);
  const [startingProfessionalTrial, setStartingProfessionalTrial] = useState(false);
  const [billingError, setBillingError] = useState('');

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setProfile({
            ...EMPTY_PROFILE,
            ...data,
            name: data.name || '',
            mission: data.mission || '',
            description: data.description || '',
            abn: data.abn || '',
            website: data.website || '',
            org_type: data.org_type || '',
            domains: data.domains || [],
            geographic_focus: data.geographic_focus || [],
            annual_revenue: data.annual_revenue?.toString() || '',
            team_size: data.team_size?.toString() || '',
            projects: data.projects || [],
            org_status: data.org_status || 'exploring',
            auspice_org_name: data.auspice_org_name || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load claimed charities
    fetch('/api/charities/claim')
      .then(r => r.ok ? r.json() : [])
      .then((data: ClaimedCharity[]) => setClaims(data))
      .catch(() => {});
  }, []);

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true);
    try {
      const r = await fetch('/api/profile/matches?threshold=0.6&limit=50');
      if (r.ok) {
        const data = await r.json();
        setMatches(data.matches || []);
      }
    } catch {
      // ignore
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const r = await fetch('/api/team');
      if (r.ok) {
        const data = await r.json();
        setTeamMembers(data.members || []);
        setCurrentUserRole(data.currentUserRole || null);
      }
    } catch {
      // ignore
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile.id) loadTeam();
  }, [profile.id, loadTeam]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMessage('');
    try {
      const r = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await r.json();
      if (!r.ok) {
        setInviteMessage(data.error || 'Failed to invite');
      } else {
        setInviteMessage(data.message || 'Team member added');
        setInviteEmail('');
        loadTeam();
      }
    } catch {
      setInviteMessage('Failed to invite');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    setRemovingMember(memberId);
    try {
      const r = await fetch('/api/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (r.ok) {
        loadTeam();
      }
    } catch {
      // ignore
    } finally {
      setRemovingMember(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    setSaved(false);

    try {
      const body = {
        ...profile,
        annual_revenue: profile.annual_revenue ? parseFloat(profile.annual_revenue) : null,
        team_size: profile.team_size ? parseInt(profile.team_size, 10) : null,
        org_status: profile.org_status || 'exploring',
        auspice_org_name: profile.auspice_org_name || null,
      };

      const r = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await r.json();
      setProfile(prev => ({ ...prev, id: data.id }));
      setSaved(true);

      const wasFirstRun = !profile.id;
      const explicitRedirect =
        getSafeRedirect(searchParams.get('next')) ||
        getSafeRedirect(searchParams.get('redirect'));
      const billingSuccess = searchParams.get('billing') === 'success';
      const shouldAdvanceToMatches = !billingSuccess && wasFirstRun;

      if (explicitRedirect && !billingSuccess) {
        router.push(explicitRedirect);
        return;
      }

      if (shouldAdvanceToMatches) {
        router.push('/profile/matches?onboarding=1');
        return;
      }

      // Auto-load matches after save for in-place profile edits
      loadMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function toggleArray(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
  }

  function addProject() {
    setProfile(prev => ({
      ...prev,
      projects: [...prev.projects, { name: '', description: '', status: 'active' }],
    }));
  }

  function updateProject(index: number, field: keyof Project, value: string) {
    setProfile(prev => ({
      ...prev,
      projects: prev.projects.map((p, i) => i === index ? { ...p, [field]: value } : p),
    }));
  }

  function removeProject(index: number) {
    setProfile(prev => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }));
  }

  async function saveToTracker(grantId: string) {
    setSavingGrant(grantId);
    try {
      await fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'discovered', stars: 0, color: 'none' }),
      });
    } catch {
      // ignore
    } finally {
      setSavingGrant(null);
    }
  }

  async function handleOpenBillingPortal() {
    setBillingError('');
    setOpeningBillingPortal(true);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: billingInteractionSource }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Could not open billing portal.');
      }

      window.location.href = data.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Could not open billing portal.');
    } finally {
      setOpeningBillingPortal(false);
    }
  }

  async function handleStartProfessionalTrial() {
    setBillingError('');
    setStartingProfessionalTrial(true);
    const result = await startCheckoutForTier('professional', billingInteractionSource);
    if (!result.ok) {
      setBillingError(result.error);
    }
    setStartingProfessionalTrial(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black uppercase tracking-widest text-bauhaus-muted animate-pulse">
          Loading profile...
        </div>
      </div>
    );
  }

  const isFirstRunProfile = !profile.id;
  const isCompressedOnboarding = isFirstRunProfile && !showAdvancedSetup;
  const billingSuccess = searchParams.get('billing') === 'success';
  const billingInteractionSource = getBillingSource(searchParams.get('billing_source'));
  const billingTier = resolveSubscriptionTier(profile.subscription_plan);
  const billingDetails = billingSuccess && !profile.subscription_status
    ? {
        planLabel: 'Professional',
        statusLabel: 'Syncing',
        toneClass: 'bg-bauhaus-yellow text-bauhaus-black',
        summary: 'Checkout completed.',
        detail: 'Stripe is still confirming the subscription state. Refresh in a moment if this does not update automatically.',
        nextLabel: null,
        nextValue: null,
      }
    : getBillingStatusDetails(profile);
  const showBillingSection = billingSuccess || Boolean(profile.stripe_customer_id) || billingTier !== 'community' || Boolean(profile.subscription_status);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-bauhaus-black">
          {isCompressedOnboarding ? 'Quick Profile Setup' : 'Organisation Profile'}
        </h1>
        <p className="text-sm text-bauhaus-muted mt-1">
          {isCompressedOnboarding
            ? 'Start with the minimum details needed to unlock matched grants. You can add the rest after your first results.'
            : 'Describe your organisation so CivicGraph can match grants, funders, and alerts to your work.'}
        </p>
      </div>

      {showBillingSection && (
        <section className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-red px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Billing</h2>
            <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black ${billingDetails.toneClass}`}>
              {billingDetails.statusLabel}
            </span>
          </div>
          <div className="p-5 space-y-4">
            {billingSuccess && (
              <div className="border-2 border-green-700 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
                Checkout completed. Your billing status is now syncing with CivicGraph.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div className="space-y-2">
                <p className="text-sm font-black uppercase tracking-wide text-bauhaus-black">
                  {billingDetails.summary}
                </p>
                <p className="text-sm text-bauhaus-muted">
                  {billingDetails.detail}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:min-w-[260px]">
                <div className="border-2 border-bauhaus-black px-3 py-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Plan</div>
                  <div className="mt-1 text-sm font-black text-bauhaus-black">{billingDetails.planLabel}</div>
                </div>
                <div className="border-2 border-bauhaus-black px-3 py-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                    {billingDetails.nextLabel || 'Status'}
                  </div>
                  <div className="mt-1 text-sm font-black text-bauhaus-black">
                    {billingDetails.nextValue || billingDetails.statusLabel}
                  </div>
                </div>
              </div>
            </div>

            {profile.subscription_cancel_at_period_end && profile.subscription_current_period_end && (
              <p className="text-xs font-bold uppercase tracking-widest text-bauhaus-red">
                Access changes at period end on {formatBillingDate(profile.subscription_current_period_end)}.
              </p>
            )}

            {billingError && (
              <div className="border-2 border-bauhaus-red bg-danger-light px-4 py-3 text-sm font-bold text-bauhaus-red">
                {billingError}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {profile.stripe_customer_id ? (
                <button
                  type="button"
                  onClick={handleOpenBillingPortal}
                  disabled={openingBillingPortal}
                  className="px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white border-4 border-bauhaus-black hover:bg-bauhaus-blue disabled:opacity-50"
                >
                  {openingBillingPortal ? 'Opening...' : 'Manage Billing'}
                </button>
              ) : !billingSuccess ? (
                <button
                  type="button"
                  onClick={handleStartProfessionalTrial}
                  disabled={startingProfessionalTrial}
                  className="px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-blue text-white border-4 border-bauhaus-black hover:bg-bauhaus-black disabled:opacity-50"
                >
                  {startingProfessionalTrial ? 'Starting...' : 'Start Professional Trial'}
                </button>
              ) : null}
              <Link
                href={`/support${billingInteractionSource !== 'profile_billing_panel' ? `?billing_source=${encodeURIComponent(billingInteractionSource)}` : ''}`}
                className="px-4 py-3 text-xs font-black uppercase tracking-widest bg-white text-bauhaus-black border-4 border-bauhaus-black hover:bg-bauhaus-yellow transition-colors"
              >
                Compare Plans
              </Link>
            </div>
          </div>
        </section>
      )}

      {(saved || (profile.name && profile.domains.length > 0 && profile.geographic_focus.length > 0)) && (
        <section className="border-4 border-bauhaus-black bg-bauhaus-canvas">
          <div className="bg-bauhaus-blue px-5 py-3">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Next Step</h2>
          </div>
          <div className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-black text-bauhaus-black uppercase tracking-wide">
                Review matched grants, then save the strongest opportunities into your tracker.
              </p>
              <p className="text-sm text-bauhaus-muted mt-2">
                Your profile is detailed enough to drive better matching and alerting.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/profile/matches"
                className="px-4 py-3 text-xs font-black uppercase tracking-widest bg-bauhaus-blue text-white border-4 border-bauhaus-black hover:bg-bauhaus-black transition-colors"
              >
                Review Matches
              </Link>
              <Link
                href="/tracker?onboarding=1"
                className="px-4 py-3 text-xs font-black uppercase tracking-widest bg-white text-bauhaus-black border-4 border-bauhaus-black hover:bg-bauhaus-yellow transition-colors"
              >
                Open Tracker
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Claimed Charities — only for incorporated orgs, hidden during impersonation */}
      {claims.length > 0 && profile.org_status === 'incorporated' && !isImpersonating && (
        <section className="border-4 border-bauhaus-black bg-white">
          <div className="bg-green-600 px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Claimed Profiles</h2>
            <Link href="/charities/claim" className="text-xs font-black text-white/80 uppercase tracking-widest hover:text-white">
              View All
            </Link>
          </div>
          <div className="divide-y-2 divide-bauhaus-black/10">
            {claims.map(claim => (
              <div key={claim.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-bauhaus-black truncate">
                      {claim.organisation_name || `ABN ${claim.abn}`}
                    </span>
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black ${
                      claim.status === 'verified' ? 'bg-green-500 text-white' :
                      claim.status === 'rejected' ? 'bg-bauhaus-red text-white' :
                      'bg-bauhaus-yellow text-bauhaus-black'
                    }`}>
                      {claim.status}
                    </span>
                  </div>
                  <div className="text-xs text-bauhaus-muted font-medium mt-0.5">ABN {claim.abn}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {claim.status === 'verified' && (
                    <Link
                      href={`/charities/${claim.abn}/edit`}
                      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-bauhaus-red text-white hover:bg-bauhaus-black transition-colors border-2 border-bauhaus-black"
                    >
                      Edit Profile
                    </Link>
                  )}
                  <Link
                    href={`/charities/${claim.abn}`}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-bauhaus-black text-white hover:bg-bauhaus-red transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {error && (
          <div className="bg-danger-light border-4 border-bauhaus-red p-3 text-sm font-bold text-bauhaus-red">
            {error}
          </div>
        )}

        {isCompressedOnboarding ? (
          <>
            <section className="border-4 border-bauhaus-black bg-bauhaus-canvas">
              <div className="bg-bauhaus-red px-5 py-3">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Quick Setup</h2>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-sm text-bauhaus-black font-bold">
                  These fields are enough to get your first matched grants.
                </p>
                <p className="text-sm text-bauhaus-muted">
                  You can add ABN, projects, revenue, team members, and organisational structure after you see your first results.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAdvancedSetup(true)}
                  className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-black"
                >
                  Show Full Setup
                </button>
              </div>
            </section>

            <section className="border-4 border-bauhaus-black bg-white">
              <div className="bg-bauhaus-black px-5 py-3">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Identity</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                    Organisation Name *
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                    required
                    className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                    placeholder="A Curious Tractor"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                    Mission Statement
                  </label>
                  <input
                    type="text"
                    value={profile.mission}
                    onChange={e => setProfile(p => ({ ...p, mission: e.target.value }))}
                    className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                    placeholder="Communities own their narratives, land, and economic futures"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                    Description
                  </label>
                  <textarea
                    value={profile.description}
                    onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
                    rows={3}
                    className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue resize-y"
                    placeholder="What does your organisation do? What communities do you serve?"
                  />
                </div>
              </div>
            </section>

            <section className="border-4 border-bauhaus-black bg-white">
              <div className="bg-bauhaus-blue px-5 py-3">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Focus Areas</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-3">
                    Domains
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DOMAIN_OPTIONS.map(domain => (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => setProfile(p => ({ ...p, domains: toggleArray(p.domains, domain) }))}
                        className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-3 transition-colors ${
                          profile.domains.includes(domain)
                            ? 'bg-bauhaus-blue text-white border-bauhaus-black'
                            : 'bg-white text-bauhaus-black border-bauhaus-black/30 hover:border-bauhaus-black'
                        }`}
                      >
                        {domain}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-3">
                    Geographic Focus
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GEO_OPTIONS.map(geo => (
                      <button
                        key={geo}
                        type="button"
                        onClick={() => setProfile(p => ({ ...p, geographic_focus: toggleArray(p.geographic_focus, geo) }))}
                        className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-3 transition-colors ${
                          profile.geographic_focus.includes(geo)
                            ? 'bg-bauhaus-yellow text-bauhaus-black border-bauhaus-black'
                            : 'bg-white text-bauhaus-black border-bauhaus-black/30 hover:border-bauhaus-black'
                        }`}
                      >
                        {geo}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Journey Status */}
            <section className="border-4 border-bauhaus-black bg-white">
              <div className="bg-bauhaus-black px-5 py-3">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Your Journey</h2>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {ORG_STATUSES.map((status, i) => {
                    const isActive = profile.org_status === status.value;
                    const isPast = ORG_STATUSES.findIndex(s => s.value === profile.org_status) > i;
                    return (
                      <div key={status.value} className="flex items-center gap-2">
                        {i > 0 && (
                          <div className={`hidden sm:block w-6 h-0.5 ${isPast || isActive ? 'bg-bauhaus-black' : 'bg-bauhaus-black/20'}`} />
                        )}
                        <button
                          type="button"
                          onClick={() => setProfile(p => ({ ...p, org_status: status.value }))}
                          className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-3 transition-colors ${
                            isActive
                              ? 'bg-bauhaus-blue text-white border-bauhaus-black'
                              : isPast
                              ? 'bg-bauhaus-blue/20 text-bauhaus-black border-bauhaus-black/40'
                              : 'bg-white text-bauhaus-black/50 border-bauhaus-black/20 hover:border-bauhaus-black/40'
                          }`}
                        >
                          {status.label}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-bauhaus-muted">
                  {ORG_STATUSES.find(s => s.value === profile.org_status)?.description}
                </p>
              </div>
            </section>

            {/* Identity */}
            <section className="border-4 border-bauhaus-black bg-white">
              <div className="bg-bauhaus-black px-5 py-3">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Identity</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                    Organisation Name *
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                    required
                    className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                    placeholder="A Curious Tractor"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                    Mission Statement
                  </label>
                  <input
                    type="text"
                    value={profile.mission}
                    onChange={e => setProfile(p => ({ ...p, mission: e.target.value }))}
                    className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                    placeholder="Communities own their narratives, land, and economic futures"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                    Description
                  </label>
                  <textarea
                    value={profile.description}
                    onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
                    rows={4}
                    className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue resize-y"
                    placeholder="What does your organisation do? What communities do you serve?"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.org_status === 'incorporated' && (
                    <div>
                      <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                        ABN
                      </label>
                      <input
                        type="text"
                        value={profile.abn}
                        onChange={e => setProfile(p => ({ ...p, abn: e.target.value }))}
                        className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                        placeholder="21 591 780 066"
                      />
                    </div>
                  )}
                  {profile.org_status === 'auspiced' && (
                    <div>
                      <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                        Auspicing Organisation
                      </label>
                      <input
                        type="text"
                        value={profile.auspice_org_name}
                        onChange={e => setProfile(p => ({ ...p, auspice_org_name: e.target.value }))}
                        className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                        placeholder="Name of the organisation auspicing you"
                      />
                      <p className="text-xs text-bauhaus-muted mt-1">
                        You can operate under a registered org&apos;s structure while you grow
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={profile.website}
                      onChange={e => setProfile(p => ({ ...p, website: e.target.value }))}
                      className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                      placeholder="https://act.place"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Focus Areas */}
            <section className="border-4 border-bauhaus-black bg-white">
              <div className="bg-bauhaus-blue px-5 py-3">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Focus Areas</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-3">
                    Domains
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DOMAIN_OPTIONS.map(domain => (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => setProfile(p => ({ ...p, domains: toggleArray(p.domains, domain) }))}
                        className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-3 transition-colors ${
                          profile.domains.includes(domain)
                            ? 'bg-bauhaus-blue text-white border-bauhaus-black'
                            : 'bg-white text-bauhaus-black border-bauhaus-black/30 hover:border-bauhaus-black'
                        }`}
                      >
                        {domain}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-3">
                    Geographic Focus
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GEO_OPTIONS.map(geo => (
                      <button
                        key={geo}
                        type="button"
                        onClick={() => setProfile(p => ({ ...p, geographic_focus: toggleArray(p.geographic_focus, geo) }))}
                        className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-3 transition-colors ${
                          profile.geographic_focus.includes(geo)
                            ? 'bg-bauhaus-yellow text-bauhaus-black border-bauhaus-black'
                            : 'bg-white text-bauhaus-black border-bauhaus-black/30 hover:border-bauhaus-black'
                        }`}
                      >
                        {geo}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {!isCompressedOnboarding && (
          <>
            {/* Organisation Details */}
            <section className="border-4 border-bauhaus-black bg-white">
              <div className="bg-bauhaus-red px-5 py-3">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Details</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                    Organisation Type
                  </label>
                  <select
                    value={profile.org_type}
                    onChange={e => setProfile(p => ({ ...p, org_type: e.target.value }))}
                    className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue bg-white"
                  >
                    {ORG_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                      Annual Revenue ($)
                    </label>
                    <input
                      type="number"
                      value={profile.annual_revenue}
                      onChange={e => setProfile(p => ({ ...p, annual_revenue: e.target.value }))}
                      className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                      placeholder="250000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                      Team Size
                    </label>
                    <input
                      type="number"
                      value={profile.team_size}
                      onChange={e => setProfile(p => ({ ...p, team_size: e.target.value }))}
                      className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                      placeholder="12"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* What Should I Be? — only for exploring/pre_formation */}
            {(profile.org_status === 'exploring' || profile.org_status === 'pre_formation') && (
              <section className="border-4 border-bauhaus-black bg-white">
                <div className="bg-bauhaus-blue px-5 py-3">
                  <h2 className="text-sm font-black text-white uppercase tracking-widest">What Should I Be?</h2>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-sm text-bauhaus-muted">
                    Based on your mission and focus areas, here are some structures to consider.
                    Fill in more details above for better recommendations.
                  </p>
                  {getFormationRecommendations(profile).map(rec => (
                    <div key={rec.type} className="border-2 border-bauhaus-black/20 p-4 space-y-2">
                      <h3 className="text-sm font-black uppercase tracking-wide text-bauhaus-black">
                        {rec.type}
                      </h3>
                      <p className="text-sm text-bauhaus-black/70">{rec.description}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-green-50 border border-green-200 px-3 py-2">
                          <span className="font-black text-green-800 uppercase tracking-wider">Benefit:</span>{' '}
                          <span className="text-green-700">{rec.benefit}</span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 px-3 py-2">
                          <span className="font-black text-amber-800 uppercase tracking-wider">Requires:</span>{' '}
                          <span className="text-amber-700">{rec.requirement}</span>
                        </div>
                      </div>
                      <a
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-black"
                      >
                        Learn more &rarr;
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Projects */}
            <section className="border-4 border-bauhaus-black bg-white">
              <div className="bg-bauhaus-black px-5 py-3 flex items-center justify-between">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Projects</h2>
                <button
                  type="button"
                  onClick={addProject}
                  className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest hover:text-white"
                >
                  + Add
                </button>
              </div>
              <div className="p-5 space-y-4">
                {profile.projects.length === 0 && (
                  <p className="text-sm text-bauhaus-muted">
                    Add your projects to improve grant matching accuracy
                  </p>
                )}
                {profile.projects.map((project, i) => (
                  <div key={i} className="border-2 border-bauhaus-black/20 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={project.name}
                          onChange={e => updateProject(i, 'name', e.target.value)}
                          placeholder="Project name"
                          className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProject(i)}
                        className="text-xs font-black text-bauhaus-red uppercase tracking-widest hover:text-bauhaus-black mt-2"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      value={project.description}
                      onChange={e => updateProject(i, 'description', e.target.value)}
                      placeholder="What does this project do?"
                      rows={2}
                      className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue resize-y"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Team Management */}
            {profile.id && (
              <section className="border-4 border-bauhaus-black bg-white">
                <div className="bg-green-600 px-5 py-3 flex items-center justify-between">
                  <h2 className="text-sm font-black text-white uppercase tracking-widest">Team</h2>
                  <span className="text-xs font-black text-white/80 uppercase tracking-widest">
                    {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="p-5 space-y-4">
                  {/* Member List */}
                  {teamLoading ? (
                    <div className="text-sm font-black uppercase tracking-widest text-bauhaus-muted animate-pulse">
                      Loading team...
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <p className="text-sm text-bauhaus-muted">
                      No team members yet. Invite colleagues to share your grant tracker.
                    </p>
                  ) : (
                    <div className="divide-y-2 divide-bauhaus-black/10">
                      {teamMembers.map(member => {
                        const isPending = !member.user_id;
                        return (
                          <div key={member.id} className="py-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <span className={`text-sm font-black truncate block ${isPending ? 'text-bauhaus-muted' : 'text-bauhaus-black'}`}>
                                {member.email || member.invited_email || (member.user_id ? member.user_id.slice(0, 8) + '...' : 'Unknown')}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {isPending ? (
                                  <span className="inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black bg-gray-200 text-bauhaus-muted">
                                    Pending
                                  </span>
                                ) : (
                                  <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black ${
                                    member.role === 'admin' ? 'bg-bauhaus-red text-white' :
                                    member.role === 'editor' ? 'bg-bauhaus-blue text-white' :
                                    'bg-bauhaus-yellow text-bauhaus-black'
                                  }`}>
                                    {member.role}
                                  </span>
                                )}
                                {member.accepted_at && (
                                  <span className="text-[10px] text-bauhaus-muted">
                                    Joined {new Date(member.accepted_at).toLocaleDateString('en-AU')}
                                  </span>
                                )}
                              </div>
                            </div>
                            {currentUserRole === 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={removingMember === member.id}
                                className="text-xs font-black text-bauhaus-red uppercase tracking-widest hover:text-bauhaus-black disabled:opacity-50"
                              >
                                {removingMember === member.id ? '...' : isPending ? 'Cancel' : 'Remove'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Invite Form (admin only) */}
                  {currentUserRole === 'admin' && (
                    <div className="border-t-2 border-bauhaus-black/10 pt-4">
                      <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                        Invite Team Member
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          placeholder="colleague@org.au"
                          className="flex-1 border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                        />
                        <select
                          value={inviteRole}
                          onChange={e => setInviteRole(e.target.value)}
                          className="border-4 border-bauhaus-black px-2 py-2 text-xs font-black uppercase tracking-widest bg-white focus:outline-none focus:border-bauhaus-blue"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleInvite}
                          disabled={inviting || !inviteEmail.trim()}
                          className="px-4 py-2 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white hover:bg-bauhaus-blue disabled:opacity-50 border-4 border-bauhaus-black"
                        >
                          {inviting ? '...' : 'Invite'}
                        </button>
                      </div>
                      {inviteMessage && (
                        <p className={`text-xs font-bold mt-2 ${inviteMessage.includes('Failed') || inviteMessage.includes('error') ? 'text-bauhaus-red' : 'text-green-700'}`}>
                          {inviteMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-bauhaus-red text-white font-black uppercase tracking-widest px-8 py-3 text-sm border-4 border-bauhaus-black hover:bg-bauhaus-black disabled:opacity-50 bauhaus-shadow-sm"
          >
            {saving ? 'Saving & Matching...' : isCompressedOnboarding ? 'Save & See Matches' : 'Save & Find Matches'}
          </button>
          {isCompressedOnboarding && (
            <button
              type="button"
              onClick={() => setShowAdvancedSetup(true)}
              className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-black"
            >
              Show Full Setup
            </button>
          )}
          {saved && (
            <span className="text-sm font-black text-green-700 uppercase tracking-widest">
              Saved
            </span>
          )}
        </div>
      </form>

      {/* Matches Section */}
      {(matches.length > 0 || matchesLoading) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black">
              Matched Grants
            </h2>
            <Link
              href="/profile/matches"
              className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-black"
            >
              View All
            </Link>
          </div>

          {matchesLoading ? (
            <div className="text-sm font-black uppercase tracking-widest text-bauhaus-muted animate-pulse py-8 text-center">
              Finding matches...
            </div>
          ) : (
            <div className="space-y-3">
              {matches.slice(0, 10).map(grant => (
                <div key={grant.id} className="border-4 border-bauhaus-black bg-white p-4 flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 h-14 bg-bauhaus-blue border-3 border-bauhaus-black flex items-center justify-center">
                    <span className="text-lg font-black text-white">{grant.fit_score}%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/grants/${grant.id}`}
                      className="text-sm font-black text-bauhaus-black hover:text-bauhaus-blue uppercase tracking-wide"
                    >
                      {grant.name}
                    </Link>
                    <div className="text-xs text-bauhaus-muted mt-1">{grant.provider}</div>
                    {grant.description && (
                      <p className="text-xs text-bauhaus-black/70 mt-1 line-clamp-2">{grant.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {grant.amount_max && (
                        <span className="text-xs font-bold text-bauhaus-black">
                          Up to ${grant.amount_max.toLocaleString()}
                        </span>
                      )}
                      {grant.closes_at && (
                        <span className="text-xs text-bauhaus-red font-bold">
                          Closes {new Date(grant.closes_at).toLocaleDateString('en-AU')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => saveToTracker(grant.id)}
                    disabled={savingGrant === grant.id}
                    className="flex-shrink-0 text-xs font-black uppercase tracking-widest px-3 py-2 border-3 border-bauhaus-black hover:bg-bauhaus-black hover:text-white disabled:opacity-50"
                  >
                    {savingGrant === grant.id ? '...' : 'Track'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
