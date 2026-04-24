'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface OpsData {
  health: {
    grants: { total: number; embedded: number; enriched: number; open: number };
    foundations: { total: number; profiled: number; withWebsite: number; programs: number };
    community: { orgs: number; acncRecords: number };
    socialEnterprises: { total: number; enriched: number };
    billing: { paidProfiles: number; activeTrials: number; expiringTrials: number; atRisk: number; scheduledChurn: number; trialStarts30d: number; remindersSent30d: number; reminderClicks30d: number; portalOpens30d: number };
  };
  dataReview: {
    windowDays: number;
    reviewCount: number;
    recentReviewDate: string | null;
    grantRows: number;
    foundationRows: number;
    grantPrecision: number;
    foundationPrecision: number;
    openNowTrust: number;
    topIssues: Array<{ issue: string; count: number }>;
    noisySources: Array<{ source: string; count: number }>;
  };
  dataReviewBenchmarks: Array<{
    key: string;
    label: string;
    current: number;
    target: number;
    unit: '%' | 'rows';
    passing: boolean;
    gap: number;
  }>;
  dataReviewDecision: {
    status: 'insufficient_data' | 'pass' | 'mixed' | 'failing';
    recommendation: string;
    benchmarkPassCount: number;
    benchmarkTotal: number;
    reviewIsStale: boolean;
  };
  productFunnel: {
    windowDays: number;
    profileReadyUsers: number;
    firstShortlistUsers: number;
    pipelineStartedUsers: number;
    firstAlertUsers: number;
    alertClickUsers: number;
    checkoutStartedUsers: number;
    trialStartedUsers: number;
    billingReminderUsers: number;
    billingReminderClickUsers: number;
    billingPortalUsers: number;
    activatedUsers: number;
  };
  pilotSummary: {
    total: number;
    consultants: number;
    nonprofits: number;
    active: number;
    completed: number;
    paid: number;
    strongYes: number;
    conditionalYes: number;
    linkedAccounts: number;
    profileReady: number;
    shortlistStarted: number;
    pipelineStarted: number;
    alertCreated: number;
    weeklyActive: number;
    veryDisappointed: number;
    paymentSignals: Record<string, number>;
    stageCounts: Record<string, number>;
  };
  pilotBenchmarks: Array<{
    key: string;
    label: string;
    current: number;
    target: number;
    passing: boolean;
    gap: number;
  }>;
  pilotDecision: {
    status: 'insufficient_data' | 'pass' | 'mixed' | 'failing';
    recommendation: string;
    benchmarkPassCount: number;
    benchmarkTotal: number;
    strongerCohort: 'consultant' | 'nonprofit' | null;
  };
  pilotCohorts: Array<{
    cohort: 'consultant' | 'nonprofit' | 'other';
    total: number;
    linkedAccounts: number;
    weeklyActive: number;
    profileReady: number;
    shortlistStarted: number;
    pipelineStarted: number;
    alertCreated: number;
    strongYes: number;
    conditionalYes: number;
    paid: number;
    paidOrCommitted: number;
    veryDisappointed: number;
    weeklyActiveRate: number;
    profileReadyRate: number;
    shortlistRate: number;
    pipelineRate: number;
    alertRate: number;
    paymentIntentRate: number;
    paidOrCommittedRate: number;
    paidRate: number;
    seanEllisRate: number;
  }>;
  pilotAttention: Array<{
    pilotId: string;
    participant_name: string;
    organization_name: string | null;
    cohort: 'consultant' | 'nonprofit' | 'other';
    stage: PilotParticipant['stage'];
    payment_intent: PilotParticipant['payment_intent'];
    severity: 'high' | 'medium' | 'low';
    reason: string;
    detail: string;
    daysSinceTouch: number;
    updated_at: string;
  }>;
  pilots: PilotParticipant[];
  upgradeSources: Record<string, { viewed: number; clicked: number; started: number; activated: number }>;
  upcomingBillingProfiles: BillingProfile[];
  recentRuns: AgentRun[];
  lastUpdated: string;
}

interface PilotParticipant {
  id: string;
  participant_name: string;
  email: string;
  organization_name: string | null;
  role_title: string | null;
  cohort: 'consultant' | 'nonprofit' | 'other';
  stage: 'lead' | 'invited' | 'scheduled' | 'onboarded' | 'active' | 'completed' | 'paid' | 'declined';
  payment_intent: 'unknown' | 'strong_yes' | 'conditional_yes' | 'not_now' | 'no_budget' | 'no_fit';
  sean_ellis_response: 'unknown' | 'very_disappointed' | 'somewhat_disappointed' | 'not_disappointed';
  pilot_source: string | null;
  funding_task: string | null;
  notes: string | null;
  linked_user_id: string | null;
  linked_org_profile_id: string | null;
  created_at: string;
  updated_at: string;
  last_contact_at: string | null;
  onboarding_at: string | null;
  observed_session_at: string | null;
  closeout_at: string | null;
  activation: {
    linkedAccount: boolean;
    weeklyActive: boolean;
    profileReady: boolean;
    shortlistStarted: boolean;
    pipelineStarted: boolean;
    alertCreated: boolean;
    checkoutStarted: boolean;
    activated: boolean;
  };
}

interface BillingProfile {
  id: string;
  name: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  subscription_trial_end: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean | null;
}

interface AgentRun {
  id: string;
  agent_id: string;
  agent_name: string;
  started_at: string;
  completed_at: string;
  status: string;
  items_found: number;
  items_new: number;
  items_updated: number;
  duration_ms: number;
  errors: unknown[];
}

const TOOL_INVENTORY = [
  { stage: 'Grant Discovery', tools: '31 source plugins (Cheerio, GrantConnect API, ARC API, CKAN)', cost: 'Free' },
  { stage: 'Grant Enrichment', tools: 'Cheerio + Groq/Gemini/DeepSeek/Minimax (auto-rotate)', cost: 'Free' },
  { stage: 'Grant Embedding', tools: 'OpenAI text-embedding-3-small', cost: '~$0.02/500' },
  { stage: 'Foundation Profiling', tools: 'Firecrawl + 9 LLM providers (Gemini-grounded first)', cost: '~$0.05/ea' },
  { stage: 'ACNC Import', tools: 'data.gov.au CSV parser', cost: 'Free' },
  { stage: 'SE Directory Import', tools: 'ORIC CSV + Cheerio scrapers (Social Traders, BuyAbility, B Corp, Kinaway)', cost: 'Free' },
  { stage: 'SE AI Enrichment', tools: 'Jina Reader + multi-LLM profiler (same as foundations)', cost: '~$0.03/ea' },
];

const QUICK_ACTIONS = [
  { label: 'Enrich Grants (Free)', cmd: 'node --env-file=.env scripts/enrich-grants-free.mjs --limit=100', desc: 'Scrape + extract with free LLMs' },
  { label: 'Profile Foundations', cmd: 'node --env-file=.env scripts/build-foundation-profiles.mjs --limit=20', desc: 'AI-profile un-enriched foundations' },
  { label: 'Backfill Embeddings', cmd: 'node --env-file=.env scripts/backfill-embeddings.mjs --limit=500', desc: 'Generate missing vectors' },
  { label: 'Run Discovery', cmd: 'npx tsx scripts/grantscope-discovery.mjs', desc: 'Full multi-source grant discovery' },
  { label: 'Sync ACNC', cmd: 'node --env-file=.env scripts/sync-acnc-register.mjs', desc: 'Download + update ACNC register' },
  { label: 'Import ORIC', cmd: 'node --env-file=.env scripts/import-oric-register.mjs', desc: 'Indigenous corp register (data.gov.au)' },
  { label: 'Enrich SEs', cmd: 'node --env-file=.env scripts/enrich-social-enterprises.mjs --limit=100', desc: 'AI-profile social enterprises' },
];

const PILOT_STAGE_OPTIONS: PilotParticipant['stage'][] = ['lead', 'invited', 'scheduled', 'onboarded', 'active', 'completed', 'paid', 'declined'];
const PILOT_PAYMENT_OPTIONS: PilotParticipant['payment_intent'][] = ['unknown', 'strong_yes', 'conditional_yes', 'not_now', 'no_budget', 'no_fit'];
const PILOT_COHORT_OPTIONS: PilotParticipant['cohort'][] = ['consultant', 'nonprofit', 'other'];
const PILOT_SEAN_ELLIS_OPTIONS: PilotParticipant['sean_ellis_response'][] = ['unknown', 'very_disappointed', 'somewhat_disappointed', 'not_disappointed'];

function pct(n: number, total: number): string {
  if (total === 0) return '0';
  return ((n / total) * 100).toFixed(1);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function HealthCard({ label, value, total, sub }: { label: string; value: number; total: number; sub?: string }) {
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="border-4 border-bauhaus-black p-5">
      <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">{label}</div>
      <div className="text-3xl font-black text-bauhaus-black">{value.toLocaleString()}</div>
      <div className="text-sm text-bauhaus-muted mt-1">
        of {total.toLocaleString()} ({pct(value, total)}%)
      </div>
      {sub && <div className="text-xs text-bauhaus-muted mt-1">{sub}</div>}
      <div className="mt-3 h-2 bg-gray-200 border border-bauhaus-black/20">
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.min(percent, 100)}%`,
            backgroundColor: percent > 90 ? '#22c55e' : percent > 50 ? '#eab308' : '#ef4444',
          }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'bg-green-600 text-white',
    partial: 'bg-yellow-500 text-bauhaus-black',
    failed: 'bg-bauhaus-red text-white',
    running: 'bg-bauhaus-blue text-white',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-wider ${colors[status] ?? 'bg-gray-300 text-bauhaus-black'}`}>
      {status}
    </span>
  );
}

export function OpsClient() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [pilotError, setPilotError] = useState<string | null>(null);
  const [pilotSuccess, setPilotSuccess] = useState<string | null>(null);
  const [savingPilot, setSavingPilot] = useState(false);
  const [savingPilotId, setSavingPilotId] = useState<string | null>(null);
  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const [uploadingReview, setUploadingReview] = useState(false);
  const [reviewUploadMessage, setReviewUploadMessage] = useState<string | null>(null);
  const [reviewUploadError, setReviewUploadError] = useState<string | null>(null);
  const [pilotDrafts, setPilotDrafts] = useState<Record<string, { stage: PilotParticipant['stage']; payment_intent: PilotParticipant['payment_intent']; notes: string; sean_ellis_response: PilotParticipant['sean_ellis_response'] }>>({});
  const [newPilot, setNewPilot] = useState({
    participant_name: '',
    email: '',
    organization_name: '',
    cohort: 'consultant' as PilotParticipant['cohort'],
    stage: 'lead' as PilotParticipant['stage'],
    payment_intent: 'unknown' as PilotParticipant['payment_intent'],
    notes: '',
  });
  const router = useRouter();

  async function loadOps() {
    setLoading(true);
    const response = await fetch('/api/ops');
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    const payload = await response.json();
    setData(payload);
    const nextDrafts = (payload.pilots || []).reduce((acc: Record<string, { stage: PilotParticipant['stage']; payment_intent: PilotParticipant['payment_intent']; notes: string; sean_ellis_response: PilotParticipant['sean_ellis_response'] }>, pilot: PilotParticipant) => {
      acc[pilot.id] = {
        stage: pilot.stage,
        payment_intent: pilot.payment_intent,
        notes: pilot.notes || '',
        sean_ellis_response: pilot.sean_ellis_response,
      };
      return acc;
    }, {});
    setPilotDrafts(nextDrafts);
    setLoading(false);
  }

  useEffect(() => {
    loadOps().catch(() => setLoading(false));
  }, [router]);

  function copyCmd(cmd: string) {
    navigator.clipboard.writeText(cmd);
    setCopied(cmd);
    setTimeout(() => setCopied(null), 2000);
  }

  function setPilotDraft(id: string, patch: Partial<{ stage: PilotParticipant['stage']; payment_intent: PilotParticipant['payment_intent']; notes: string; sean_ellis_response: PilotParticipant['sean_ellis_response'] }>) {
    setPilotDrafts((current) => ({
      ...current,
      [id]: {
        stage: current[id]?.stage ?? 'lead',
        payment_intent: current[id]?.payment_intent ?? 'unknown',
        notes: current[id]?.notes ?? '',
        sean_ellis_response: current[id]?.sean_ellis_response ?? 'unknown',
        ...patch,
      },
    }));
  }

  async function createPilot() {
    setSavingPilot(true);
    setPilotError(null);
    setPilotSuccess(null);
    try {
      const response = await fetch('/api/ops/pilots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPilot),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create pilot participant');
      }
      setPilotSuccess('Pilot participant added.');
      setNewPilot({
        participant_name: '',
        email: '',
        organization_name: '',
        cohort: 'consultant',
        stage: 'lead',
        payment_intent: 'unknown',
        notes: '',
      });
      await loadOps();
    } catch (error) {
      setPilotError(error instanceof Error ? error.message : 'Failed to create pilot participant');
    } finally {
      setSavingPilot(false);
    }
  }

  async function savePilot(id: string) {
    const draft = pilotDrafts[id];
    if (!draft) return;
    setSavingPilotId(id);
    setPilotError(null);
    setPilotSuccess(null);
    try {
      const response = await fetch(`/api/ops/pilots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update pilot participant');
      }
      setPilotSuccess('Pilot participant updated.');
      await loadOps();
    } catch (error) {
      setPilotError(error instanceof Error ? error.message : 'Failed to update pilot participant');
    } finally {
      setSavingPilotId(null);
    }
  }

  async function uploadReviewCsv() {
    if (!reviewFile) return;
    setUploadingReview(true);
    setReviewUploadMessage(null);
    setReviewUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', reviewFile);
      const response = await fetch('/api/ops/validation-reviews/import', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to import validation review CSV');
      }
      setReviewUploadMessage(`Imported ${payload.imported} review row${payload.imported === 1 ? '' : 's'}.`);
      setReviewFile(null);
      await loadOps();
    } catch (error) {
      setReviewUploadError(error instanceof Error ? error.message : 'Failed to import validation review CSV');
    } finally {
      setUploadingReview(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading ops...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-red uppercase tracking-widest">Failed to load ops data</div>
      </div>
    );
  }

  const { health, recentRuns } = data;
  const funnel = data.productFunnel;
  const billing = data.health.billing;
  const dataReview = data.dataReview;
  const dataReviewBenchmarks = data.dataReviewBenchmarks;
  const dataReviewDecision = data.dataReviewDecision;
  const pilotSummary = data.pilotSummary;
  const pilotBenchmarks = data.pilotBenchmarks;
  const pilotDecision = data.pilotDecision;
  const pilotCohorts = data.pilotCohorts;
  const pilotAttention = data.pilotAttention;
  const upgradeSources = Object.entries(data.upgradeSources || {})
    .sort((a, b) => b[1].viewed - a[1].viewed || b[1].started - a[1].started)
    .slice(0, 6);
  const shortlistRate = funnel.profileReadyUsers > 0 ? (funnel.firstShortlistUsers / funnel.profileReadyUsers) * 100 : 0;
  const pipelineRate = funnel.firstShortlistUsers > 0 ? (funnel.pipelineStartedUsers / funnel.firstShortlistUsers) * 100 : 0;
  const checkoutRate = funnel.alertClickUsers > 0 ? (funnel.checkoutStartedUsers / funnel.alertClickUsers) * 100 : 0;
  const activationRate = funnel.checkoutStartedUsers > 0 ? (funnel.activatedUsers / funnel.checkoutStartedUsers) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">Data Operations</h1>
        <div className="text-xs text-bauhaus-muted font-mono">
          Updated {timeAgo(data.lastUpdated)}
        </div>
      </div>

      {/* Pipeline Health */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Pipeline Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <HealthCard
            label="Grants Embedded"
            value={health.grants.embedded}
            total={health.grants.total}
          />
          <HealthCard
            label="Grants Enriched"
            value={health.grants.enriched}
            total={health.grants.total}
            sub={`${health.grants.open} with future close dates`}
          />
          <HealthCard
            label="Foundations Profiled"
            value={health.foundations.profiled}
            total={health.foundations.total}
            sub={`${health.foundations.withWebsite} have websites · ${health.foundations.programs} programs`}
          />
          <HealthCard
            label="SEs Enriched"
            value={health.socialEnterprises.enriched}
            total={health.socialEnterprises.total}
            sub="ORIC, Social Traders, BuyAbility, B Corp"
          />
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Community Orgs</div>
            <div className="text-3xl font-black text-bauhaus-black">{health.community.orgs.toLocaleString()}</div>
            <div className="text-sm text-bauhaus-muted mt-1">AI-profiled</div>
            <div className="text-xs text-bauhaus-muted mt-2">
              {health.community.acncRecords.toLocaleString()} ACNC records (multi-year)
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Activation Funnel ({funnel.windowDays} Days)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Profile Ready</div>
            <div className="text-3xl font-black text-bauhaus-black">{funnel.profileReadyUsers}</div>
            <div className="text-xs text-bauhaus-muted mt-2">Users with a usable org profile</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">First Shortlist</div>
            <div className="text-3xl font-black text-bauhaus-blue">{funnel.firstShortlistUsers}</div>
            <div className="text-xs text-bauhaus-muted mt-2">{pct(funnel.firstShortlistUsers, funnel.profileReadyUsers)} of profile-ready users</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Pipeline Started</div>
            <div className="text-3xl font-black text-bauhaus-black">{funnel.pipelineStartedUsers}</div>
            <div className="text-xs text-bauhaus-muted mt-2">{pct(funnel.pipelineStartedUsers, funnel.firstShortlistUsers)} of shortlisted users</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">First Alert Created</div>
            <div className="text-3xl font-black text-bauhaus-red">{funnel.firstAlertUsers}</div>
            <div className="text-xs text-bauhaus-muted mt-2">Alert-product adoption</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Alert Click Users</div>
            <div className="text-3xl font-black text-bauhaus-black">{funnel.alertClickUsers}</div>
            <div className="text-xs text-bauhaus-muted mt-2">Clicked from alert or digest</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Checkout Started</div>
            <div className="text-3xl font-black text-bauhaus-blue">{funnel.checkoutStartedUsers}</div>
            <div className="text-xs text-bauhaus-muted mt-2">{checkoutRate.toFixed(1)}% of click users</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Activated</div>
            <div className="text-3xl font-black text-green-700">{funnel.activatedUsers}</div>
            <div className="text-xs text-bauhaus-muted mt-2">{activationRate.toFixed(1)}% of checkout starts</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Stage Rates</div>
            <div className="text-sm font-black text-bauhaus-black leading-6">
              <div>Shortlist: {shortlistRate.toFixed(1)}%</div>
              <div>Pipeline: {pipelineRate.toFixed(1)}%</div>
              <div>Checkout: {checkoutRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Billing Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Paid Profiles</div>
            <div className="text-3xl font-black text-bauhaus-black">{billing.paidProfiles}</div>
            <div className="text-xs text-bauhaus-muted mt-2">
              {billing.trialStarts30d} trial start{billing.trialStarts30d !== 1 ? 's' : ''} in the last 30 days
            </div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Active Trials</div>
            <div className="text-3xl font-black text-bauhaus-blue">{billing.activeTrials}</div>
            <div className="text-xs text-bauhaus-muted mt-2">
              {billing.remindersSent30d} reminder{billing.remindersSent30d !== 1 ? 's' : ''} sent · {billing.reminderClicks30d} click{billing.reminderClicks30d !== 1 ? 's' : ''} · {billing.portalOpens30d} portal open{billing.portalOpens30d !== 1 ? 's' : ''} in 30 days
            </div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Trials Ending Soon</div>
            <div className="text-3xl font-black text-bauhaus-red">{billing.expiringTrials}</div>
            <div className="text-xs text-bauhaus-muted mt-2">Within the next 7 days</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Payment Risk</div>
            <div className="text-3xl font-black text-bauhaus-red">{billing.atRisk}</div>
            <div className="text-xs text-bauhaus-muted mt-2">Past due or unpaid</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Scheduled Churn</div>
            <div className="text-3xl font-black text-bauhaus-black">{billing.scheduledChurn}</div>
            <div className="text-xs text-bauhaus-muted mt-2">Cancel at period end</div>
          </div>
        </div>

        {data.upcomingBillingProfiles.length > 0 && (
          <div className="border-4 border-bauhaus-black overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Workspace</th>
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Plan</th>
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Status</th>
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Trial End</th>
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Period End</th>
                </tr>
              </thead>
              <tbody>
                {data.upcomingBillingProfiles.map((profile) => (
                  <tr key={profile.id} className="border-t-2 border-bauhaus-black/10">
                    <td className="px-4 py-3 font-bold">{profile.name || 'Untitled workspace'}</td>
                    <td className="px-4 py-3 uppercase">{profile.subscription_plan || 'community'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-wider ${
                        profile.subscription_status === 'trialing'
                          ? 'bg-bauhaus-blue text-white'
                          : profile.subscription_cancel_at_period_end || ['past_due', 'unpaid'].includes(profile.subscription_status || '')
                            ? 'bg-bauhaus-red text-white'
                            : 'bg-gray-300 text-bauhaus-black'
                      }`}>
                        {profile.subscription_cancel_at_period_end
                          ? 'cancelling'
                          : profile.subscription_status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{formatDate(profile.subscription_trial_end)}</td>
                    <td className="px-4 py-3 font-mono">{formatDate(profile.subscription_current_period_end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Data Truth Loop
        </h2>

        <div className="border-4 border-bauhaus-black p-5 mb-4">
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-3">
            Import Weekly Review CSV
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setReviewFile(event.target.files?.[0] || null)}
              className="border-2 border-bauhaus-black px-3 py-2 text-sm bg-white"
            />
            <button
              onClick={uploadReviewCsv}
              disabled={!reviewFile || uploadingReview}
              className="border-4 border-bauhaus-black bg-bauhaus-blue text-white px-4 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              {uploadingReview ? 'Importing...' : 'Import Review CSV'}
            </button>
            <a
              href="/api/ops/validation-reviews/template"
              className="border-2 border-bauhaus-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white"
            >
              Download Template
            </a>
          </div>
          {reviewFile && (
            <div className="text-xs text-bauhaus-muted mt-3">
              Ready to import: {reviewFile.name}
            </div>
          )}
          {reviewUploadMessage && (
            <div className="text-xs font-black uppercase tracking-widest text-green-700 mt-3">
              {reviewUploadMessage}
            </div>
          )}
          {reviewUploadError && (
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red mt-3">
              {reviewUploadError}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Reviews Imported</div>
            <div className="text-3xl font-black text-bauhaus-black">{dataReview.reviewCount}</div>
            <div className="text-xs text-bauhaus-muted mt-2">
              {dataReview.recentReviewDate ? `Latest review ${formatDate(dataReview.recentReviewDate)}` : 'No review data yet'}
            </div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Grant Precision</div>
            <div className={`text-3xl font-black ${dataReview.grantPrecision >= 70 ? 'text-green-700' : 'text-bauhaus-red'}`}>
              {dataReview.grantPrecision.toFixed(1)}%
            </div>
            <div className="text-xs text-bauhaus-muted mt-2">{dataReview.grantRows} grant reviews · target 70%</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Foundation Precision</div>
            <div className={`text-3xl font-black ${dataReview.foundationPrecision >= 75 ? 'text-green-700' : 'text-bauhaus-red'}`}>
              {dataReview.foundationPrecision.toFixed(1)}%
            </div>
            <div className="text-xs text-bauhaus-muted mt-2">{dataReview.foundationRows} foundation reviews · target 75%</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Open Now Trust</div>
            <div className={`text-3xl font-black ${dataReview.openNowTrust >= 85 ? 'text-green-700' : 'text-bauhaus-red'}`}>
              {dataReview.openNowTrust.toFixed(1)}%
            </div>
            <div className="text-xs text-bauhaus-muted mt-2">Target 85%</div>
          </div>
        </div>

        <div className={`border-4 p-5 mb-4 ${
          dataReviewDecision.status === 'pass'
            ? 'border-green-700 bg-green-50'
            : dataReviewDecision.status === 'mixed'
              ? 'border-yellow-500 bg-yellow-50'
              : dataReviewDecision.status === 'failing'
                ? 'border-bauhaus-red bg-red-50'
                : 'border-bauhaus-black bg-white'
        }`}>
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">
            Data Quality Read
          </div>
          <div className="text-lg font-black text-bauhaus-black mb-2">
            {dataReviewDecision.benchmarkPassCount}/{dataReviewDecision.benchmarkTotal} trust benchmarks passing
          </div>
          <div className="text-sm text-bauhaus-black">
            {dataReviewDecision.recommendation}
          </div>
        </div>

        {dataReview.reviewCount === 0 ? (
          <div className="border-4 border-dashed border-bauhaus-black/20 p-8 text-center">
            <div className="text-sm text-bauhaus-muted mb-3">
              No data-review rows imported yet. Fill the scorecard CSV and import it to turn trust review into live ops metrics.
            </div>
            <div className="font-mono text-xs text-bauhaus-black break-all">
              node --env-file=.env scripts/import-validation-reviews.mjs thoughts/plans/grantscope-data-review-scorecard-template.csv --apply
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-4 border-bauhaus-black overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Benchmark</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Current</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Target</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Gap</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dataReviewBenchmarks.map((metric) => (
                    <tr key={metric.key} className="border-t-2 border-bauhaus-black/10">
                      <td className="px-4 py-3 font-bold">{metric.label}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {metric.unit === '%' ? `${metric.current.toFixed(1)}%` : metric.current.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {metric.unit === '%' ? `${metric.target.toFixed(1)}%` : metric.target.toFixed(0)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${metric.gap >= 0 ? 'text-green-700' : 'text-bauhaus-red'}`}>
                        {metric.gap >= 0 ? '+' : ''}{metric.gap.toFixed(1)} {metric.unit === '%' ? 'pts' : 'rows'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-wider ${
                          metric.passing ? 'bg-green-700 text-white' : 'bg-bauhaus-red text-white'
                        }`}>
                          {metric.passing ? 'passing' : 'below'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border-4 border-bauhaus-black overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bauhaus-black text-white">
                      <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Top Issue</th>
                      <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataReview.topIssues.map((issue) => (
                      <tr key={issue.issue} className="border-t-2 border-bauhaus-black/10">
                        <td className="px-4 py-3 font-bold">{issue.issue}</td>
                        <td className="px-4 py-3 text-right font-mono">{issue.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-4 border-bauhaus-black overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bauhaus-black text-white">
                      <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Noisy Source</th>
                      <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Wrong / Noisy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataReview.noisySources.map((source) => (
                      <tr key={source.source} className="border-t-2 border-bauhaus-black/10">
                        <td className="px-4 py-3 font-bold">{source.source}</td>
                        <td className="px-4 py-3 text-right font-mono">{source.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      {upgradeSources.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
            Upgrade Sources
          </h2>
          <div className="border-4 border-bauhaus-black overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Source</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Views</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Clicks</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Checkout Starts</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Activations</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Click Rate</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Activation Rate</th>
                </tr>
              </thead>
              <tbody>
                {upgradeSources.map(([source, counts]) => (
                  <tr key={source} className="border-t-2 border-bauhaus-black/10">
                    <td className="px-4 py-3 font-bold">{source}</td>
                    <td className="px-4 py-3 text-right font-mono">{counts.viewed}</td>
                    <td className="px-4 py-3 text-right font-mono">{counts.clicked}</td>
                    <td className="px-4 py-3 text-right font-mono">{counts.started}</td>
                    <td className="px-4 py-3 text-right font-mono">{counts.activated}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {counts.viewed > 0 ? `${((counts.clicked / counts.viewed) * 100).toFixed(1)}%` : '0%'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {counts.started > 0 ? `${((counts.activated / counts.started) * 100).toFixed(1)}%` : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Pilot Validation
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Pilot Participants</div>
            <div className="text-3xl font-black text-bauhaus-black">{pilotSummary.total}</div>
            <div className="text-xs text-bauhaus-muted mt-2">{pilotSummary.consultants} consultants · {pilotSummary.nonprofits} nonprofits</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Active Pilots</div>
            <div className="text-3xl font-black text-bauhaus-blue">{pilotSummary.active}</div>
            <div className="text-xs text-bauhaus-muted mt-2">{pilotSummary.completed} completed · {pilotSummary.paid} paid</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Payment Signal</div>
            <div className="text-3xl font-black text-green-700">{pilotSummary.strongYes}</div>
            <div className="text-xs text-bauhaus-muted mt-2">{pilotSummary.conditionalYes} conditional yes</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Linked Accounts</div>
            <div className="text-3xl font-black text-bauhaus-black">{pilotSummary.linkedAccounts}</div>
            <div className="text-xs text-bauhaus-muted mt-2">{pilotSummary.profileReady} profile-ready · {pilotSummary.shortlistStarted} shortlisted</div>
          </div>
          <div className="border-4 border-bauhaus-black p-5">
            <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">Pilot Activation</div>
            <div className="text-3xl font-black text-bauhaus-red">{pilotSummary.pipelineStarted}</div>
            <div className="text-xs text-bauhaus-muted mt-2">{pilotSummary.alertCreated} created alerts · {pilotSummary.weeklyActive} active this week</div>
          </div>
        </div>

        <div className={`border-4 p-5 mb-4 ${
          pilotDecision.status === 'pass'
            ? 'border-green-700 bg-green-50'
            : pilotDecision.status === 'mixed'
              ? 'border-yellow-500 bg-yellow-50'
              : pilotDecision.status === 'failing'
                ? 'border-bauhaus-red bg-red-50'
                : 'border-bauhaus-black bg-white'
        }`}>
          <div className="text-xs font-black uppercase tracking-widest text-bauhaus-muted mb-2">
            Pilot Read
          </div>
          <div className="text-lg font-black text-bauhaus-black mb-2">
            {pilotDecision.benchmarkPassCount}/{pilotDecision.benchmarkTotal} pilot benchmarks passing
          </div>
          <div className="text-sm text-bauhaus-black">
            {pilotDecision.recommendation}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black p-5 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 mb-3">
            <input
              value={newPilot.participant_name}
              onChange={(event) => setNewPilot((current) => ({ ...current, participant_name: event.target.value }))}
              placeholder="Participant name"
              className="border-2 border-bauhaus-black px-3 py-2 text-sm"
            />
            <input
              value={newPilot.email}
              onChange={(event) => setNewPilot((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
              className="border-2 border-bauhaus-black px-3 py-2 text-sm"
            />
            <input
              value={newPilot.organization_name}
              onChange={(event) => setNewPilot((current) => ({ ...current, organization_name: event.target.value }))}
              placeholder="Organisation"
              className="border-2 border-bauhaus-black px-3 py-2 text-sm"
            />
            <select
              value={newPilot.cohort}
              onChange={(event) => setNewPilot((current) => ({ ...current, cohort: event.target.value as PilotParticipant['cohort'] }))}
              className="border-2 border-bauhaus-black px-3 py-2 text-sm bg-white"
            >
              {PILOT_COHORT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select
              value={newPilot.stage}
              onChange={(event) => setNewPilot((current) => ({ ...current, stage: event.target.value as PilotParticipant['stage'] }))}
              className="border-2 border-bauhaus-black px-3 py-2 text-sm bg-white"
            >
              {PILOT_STAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select
              value={newPilot.payment_intent}
              onChange={(event) => setNewPilot((current) => ({ ...current, payment_intent: event.target.value as PilotParticipant['payment_intent'] }))}
              className="border-2 border-bauhaus-black px-3 py-2 text-sm bg-white"
            >
              {PILOT_PAYMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <textarea
            value={newPilot.notes}
            onChange={(event) => setNewPilot((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Notes"
            className="w-full border-2 border-bauhaus-black px-3 py-2 text-sm min-h-24 mb-3"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={createPilot}
              disabled={savingPilot}
              className="border-4 border-bauhaus-black bg-bauhaus-red text-white px-4 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-50"
            >
              {savingPilot ? 'Saving...' : 'Add Pilot Participant'}
            </button>
            {pilotSuccess && <div className="text-xs font-black uppercase tracking-widest text-green-700">{pilotSuccess}</div>}
            {pilotError && <div className="text-xs font-black uppercase tracking-widest text-bauhaus-red">{pilotError}</div>}
          </div>
        </div>

        {data.pilots.length === 0 ? (
          <div className="border-4 border-dashed border-bauhaus-black/20 p-8 text-center">
            <div className="text-sm text-bauhaus-muted">No pilot participants yet. Add the first consultant or nonprofit test user above.</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-4 border-bauhaus-black overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Benchmark</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Current</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Target</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Gap</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pilotBenchmarks.map((metric) => (
                    <tr key={metric.key} className="border-t-2 border-bauhaus-black/10">
                      <td className="px-4 py-3 font-bold">{metric.label}</td>
                      <td className="px-4 py-3 text-right font-mono">{metric.current.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{metric.target.toFixed(1)}%</td>
                      <td className={`px-4 py-3 text-right font-mono ${metric.gap >= 0 ? 'text-green-700' : 'text-bauhaus-red'}`}>
                        {metric.gap >= 0 ? '+' : ''}{metric.gap.toFixed(1)} pts
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-wider ${
                          metric.passing ? 'bg-green-700 text-white' : 'bg-bauhaus-red text-white'
                        }`}>
                          {metric.passing ? 'passing' : 'below'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-4 border-bauhaus-black overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Cohort</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Participants</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Weekly Active</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Shortlisted</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Pipeline</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Alerts</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Paid / Commit</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Sean Ellis</th>
                  </tr>
                </thead>
                <tbody>
                  {pilotCohorts.map((cohort) => (
                    <tr key={cohort.cohort} className="border-t-2 border-bauhaus-black/10">
                      <td className="px-4 py-3 font-bold uppercase">{cohort.cohort}</td>
                      <td className="px-4 py-3 text-right font-mono">{cohort.total}</td>
                      <td className="px-4 py-3 text-right font-mono">{cohort.weeklyActiveRate.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{cohort.shortlistRate.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{cohort.pipelineRate.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{cohort.alertRate.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{cohort.paidOrCommittedRate.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right font-mono">{cohort.seanEllisRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pilotAttention.length > 0 && (
              <div className="border-4 border-bauhaus-black overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bauhaus-black text-white">
                      <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Needs Attention</th>
                      <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Reason</th>
                      <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Detail</th>
                      <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pilotAttention.map((item) => (
                      <tr key={item.pilotId} className="border-t-2 border-bauhaus-black/10">
                        <td className="px-4 py-3">
                          <div className="font-bold">{item.participant_name}</div>
                          <div className="text-xs text-bauhaus-muted">{item.organization_name || item.cohort}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-black uppercase tracking-wider ${
                            item.severity === 'high'
                              ? 'bg-bauhaus-red text-white'
                              : item.severity === 'medium'
                                ? 'bg-yellow-400 text-bauhaus-black'
                                : 'bg-gray-300 text-bauhaus-black'
                          }`}>
                            {item.reason}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-bauhaus-muted">{item.detail}</td>
                        <td className="px-4 py-3 text-right font-mono">{item.daysSinceTouch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-4 border-bauhaus-black overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bauhaus-black text-white">
                    <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Participant</th>
                    <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Cohort</th>
                    <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Stage</th>
                    <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Payment Intent</th>
                    <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Sean Ellis</th>
                    <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Activation</th>
                    <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Notes</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Updated</th>
                    <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pilots.map((pilot) => (
                    <tr key={pilot.id} className="border-t-2 border-bauhaus-black/10 align-top">
                      <td className="px-4 py-3">
                        <div className="font-bold">{pilot.participant_name}</div>
                        <div className="text-xs text-bauhaus-muted">{pilot.organization_name || pilot.email}</div>
                        {pilot.linked_user_id && <div className="text-[11px] font-mono text-green-700 mt-1">linked account</div>}
                      </td>
                      <td className="px-4 py-3 uppercase text-xs font-black tracking-wider">{pilot.cohort}</td>
                      <td className="px-4 py-3">
                        <select
                          value={pilotDrafts[pilot.id]?.stage ?? pilot.stage}
                          onChange={(event) => setPilotDraft(pilot.id, { stage: event.target.value as PilotParticipant['stage'] })}
                          className="border-2 border-bauhaus-black px-2 py-1 text-xs bg-white"
                        >
                          {PILOT_STAGE_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={pilotDrafts[pilot.id]?.payment_intent ?? pilot.payment_intent}
                          onChange={(event) => setPilotDraft(pilot.id, { payment_intent: event.target.value as PilotParticipant['payment_intent'] })}
                          className="border-2 border-bauhaus-black px-2 py-1 text-xs bg-white"
                        >
                          {PILOT_PAYMENT_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={pilotDrafts[pilot.id]?.sean_ellis_response ?? pilot.sean_ellis_response}
                          onChange={(event) => setPilotDraft(pilot.id, { sean_ellis_response: event.target.value as PilotParticipant['sean_ellis_response'] })}
                          className="border-2 border-bauhaus-black px-2 py-1 text-xs bg-white"
                        >
                          {PILOT_SEAN_ELLIS_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-bauhaus-muted">
                        <div>{pilot.activation.weeklyActive ? 'active this week' : 'no recent activity'}</div>
                        <div>{pilot.activation.profileReady ? 'profile' : 'no profile'}</div>
                        <div>{pilot.activation.shortlistStarted ? 'shortlisted' : 'no shortlist'}</div>
                        <div>{pilot.activation.pipelineStarted ? 'pipeline' : 'no pipeline'}</div>
                        <div>{pilot.activation.alertCreated ? 'alerts' : 'no alerts'}</div>
                      </td>
                      <td className="px-4 py-3 min-w-52">
                        <textarea
                          value={pilotDrafts[pilot.id]?.notes ?? pilot.notes ?? ''}
                          onChange={(event) => setPilotDraft(pilot.id, { notes: event.target.value })}
                          className="w-full border-2 border-bauhaus-black px-2 py-1 text-xs min-h-20"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-bauhaus-muted">{timeAgo(pilot.updated_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => savePilot(pilot.id)}
                          disabled={savingPilotId === pilot.id}
                          className="border-2 border-bauhaus-black px-3 py-1 text-xs font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white disabled:opacity-50"
                        >
                          {savingPilotId === pilot.id ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Tool Inventory */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Tool Inventory
        </h2>
        <div className="border-4 border-bauhaus-black overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bauhaus-black text-white">
                <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Stage</th>
                <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Tools</th>
                <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Cost</th>
              </tr>
            </thead>
            <tbody>
              {TOOL_INVENTORY.map((row) => (
                <tr key={row.stage} className="border-t-2 border-bauhaus-black/10">
                  <td className="px-4 py-3 font-bold">{row.stage}</td>
                  <td className="px-4 py-3 text-bauhaus-muted">{row.tools}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{row.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Agent Runs */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Recent Agent Runs
        </h2>
        {recentRuns.length === 0 ? (
          <div className="border-4 border-dashed border-bauhaus-black/20 p-8 text-center">
            <div className="text-sm text-bauhaus-muted">No agent runs yet. Run a job below to get started.</div>
          </div>
        ) : (
          <div className="border-4 border-bauhaus-black overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Agent</th>
                  <th className="text-left px-4 py-2 font-black uppercase tracking-wider text-xs">Status</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Found</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">New</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">Duration</th>
                  <th className="text-right px-4 py-2 font-black uppercase tracking-wider text-xs">When</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id} className="border-t-2 border-bauhaus-black/10">
                    <td className="px-4 py-3 font-bold">{run.agent_name}</td>
                    <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                    <td className="px-4 py-3 text-right font-mono">{run.items_found}</td>
                    <td className="px-4 py-3 text-right font-mono">{run.items_new}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{formatDuration(run.duration_ms)}</td>
                    <td className="px-4 py-3 text-right text-bauhaus-muted text-xs">{timeAgo(run.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section className="mb-10">
        <h2 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-4 border-b-2 border-bauhaus-black pb-2">
          Quick Actions
        </h2>
        <p className="text-xs text-bauhaus-muted mb-4">
          Copy a command and run it locally. Each script logs to agent_runs so results appear above.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <div key={action.label} className="border-4 border-bauhaus-black p-4">
              <div className="font-black text-sm uppercase tracking-wide mb-1">{action.label}</div>
              <div className="text-xs text-bauhaus-muted mb-3">{action.desc}</div>
              <button
                onClick={() => copyCmd(action.cmd)}
                className="w-full text-left font-mono text-xs bg-gray-100 border-2 border-bauhaus-black/20 px-3 py-2 hover:bg-bauhaus-black hover:text-white transition-colors cursor-pointer break-all"
              >
                {copied === action.cmd ? 'Copied!' : action.cmd}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
