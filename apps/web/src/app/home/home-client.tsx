'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SlidePanel, SlidePanelHeader, SlidePanelBody } from '../components/slide-panel';

/* ── Shared types (serializable from server) ── */

export interface GrantItem {
  id: string;
  stage: string;
  grant: {
    id: string;
    name: string;
    provider: string;
    amount_min: number | null;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[];
  } | null;
}

export interface FoundationItem {
  id: string;
  stage: string;
  foundation: {
    id: string;
    name: string;
    total_giving_annual: number | null;
    thematic_focus: string[];
    geographic_focus: string[];
  } | null;
}

export interface AgentRun {
  agent_name: string;
  status: string;
  items_found: number | null;
  items_new: number | null;
  started_at: string;
  duration_ms: number | null;
}

interface HomeClientProps {
  greeting: string;
  contextLine: string;
  isNewUser: boolean;
  hasProfile: boolean;
  hasFocusAreas: boolean;
  grants: GrantItem[];
  foundations: FoundationItem[];
  agentRuns: AgentRun[];
  openGrantCount: number;
  entityCount: number;
  urgentDeadlines: GrantItem[];
  soonDeadlines: GrantItem[];
  discoveredCount: number;
  activeCount: number;
  submittedCount: number;
  wonCount: number;
}

function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Ongoing';
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

type PreviewTarget =
  | { type: 'grant'; item: GrantItem }
  | { type: 'foundation'; item: FoundationItem }
  | null;

export function HomeClient(props: HomeClientProps) {
  const [preview, setPreview] = useState<PreviewTarget>(null);

  const {
    greeting, contextLine, isNewUser, hasProfile, hasFocusAreas,
    grants, foundations, agentRuns, openGrantCount, entityCount,
    urgentDeadlines, soonDeadlines,
    discoveredCount, activeCount, submittedCount, wonCount,
  } = props;

  function openGrant(item: GrantItem) {
    setPreview({ type: 'grant', item });
  }

  function openFoundation(item: FoundationItem) {
    setPreview({ type: 'foundation', item });
  }

  return (
    <div className="max-w-5xl">
      {/* Greeting */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--ws-text)' }}>
          {greeting}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ws-text-secondary)' }}>
          {contextLine}
        </p>
      </header>

      {/* Onboarding */}
      {isNewUser && (
        <div className="rounded-lg border p-5 mb-8" style={{ borderColor: 'var(--ws-accent)', background: 'rgba(37,99,235,0.04)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--ws-text)' }}>Get Started</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { href: '/profile', step: '1', title: 'Complete Profile', desc: 'Name, ABN & focus areas', done: hasProfile && hasFocusAreas },
              { href: '/grants', step: '2', title: 'Find Grants', desc: 'Search 14k+ opportunities', done: false },
              { href: '/alerts', step: '3', title: 'Set Up Alerts', desc: 'Get notified about new grants', done: false },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 p-3 rounded-lg border transition-colors hover:border-[var(--ws-accent)]"
                style={{
                  borderColor: item.done ? 'var(--ws-green)' : 'var(--ws-border)',
                  background: item.done ? 'rgba(22,163,74,0.04)' : 'var(--ws-surface-1)',
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{
                    background: item.done ? 'var(--ws-green)' : 'var(--ws-surface-2)',
                    color: item.done ? '#fff' : 'var(--ws-text-secondary)',
                  }}
                >
                  {item.done ? '\u2713' : item.step}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>{item.title}</p>
                  <p className="text-xs" style={{ color: 'var(--ws-text-tertiary)' }}>{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Profile nudge */}
      {!isNewUser && !hasFocusAreas && (
        <Link
          href="/profile"
          className="flex items-center gap-3 p-4 mb-6 rounded-lg border transition-colors hover:border-[var(--ws-accent)]"
          style={{ borderColor: 'var(--ws-accent)', background: 'rgba(37,99,235,0.04)' }}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--ws-accent)', color: '#fff' }}>!</div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--ws-text)' }}>Add your focus areas for better grant matches</p>
            <p className="text-xs" style={{ color: 'var(--ws-text-secondary)' }}>Tell us what you fund so we can surface the most relevant opportunities.</p>
          </div>
        </Link>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Urgent deadlines */}
          {urgentDeadlines.length > 0 && (
            <section>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ws-red)' }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'var(--ws-red)' }}>
                  <span className="text-xs font-semibold text-white uppercase tracking-wide">Closing This Week</span>
                  <span className="text-xs font-medium text-white/70">{urgentDeadlines.length} grant{urgentDeadlines.length !== 1 ? 's' : ''}</span>
                </div>
                <div>
                  {urgentDeadlines.map((item, i) => {
                    const days = daysUntil(item.grant!.closes_at!);
                    return (
                      <button
                        key={item.id}
                        onClick={() => openGrant(item)}
                        className="w-full text-left flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--ws-surface-2)]"
                        style={{ borderTop: i > 0 ? '1px solid var(--ws-border)' : 'none' }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--ws-text)' }}>{item.grant?.name}</p>
                          <p className="text-xs" style={{ color: 'var(--ws-text-tertiary)' }}>{item.grant?.provider}</p>
                        </div>
                        <div className="flex items-center gap-3 ml-4 shrink-0">
                          {item.grant?.amount_max && (
                            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{formatMoney(item.grant.amount_max)}</span>
                          )}
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded tabular-nums"
                            style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--ws-red)' }}
                          >
                            {days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Pipeline stats */}
          {grants.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>Pipeline</h2>
                <Link href="/tracker" className="text-xs font-medium transition-colors hover:underline" style={{ color: 'var(--ws-accent)' }}>
                  Open Tracker &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'To Review', value: discoveredCount, warn: discoveredCount > 20, href: '/tracker' },
                  { label: 'In Progress', value: activeCount, href: '/tracker' },
                  { label: 'Submitted', value: submittedCount, href: '/tracker' },
                  { label: 'Won', value: wonCount, color: 'var(--ws-green)', href: '/tracker' },
                ].map(stat => (
                  <Link
                    key={stat.label}
                    href={stat.href}
                    className="rounded-lg border p-4 transition-colors hover:border-[var(--ws-accent)]"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
                  >
                    <p className="text-2xl font-semibold tabular-nums" style={{ color: stat.color || 'var(--ws-text)' }}>
                      {stat.value}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--ws-text-secondary)' }}>{stat.label}</p>
                    {stat.warn && (
                      <p className="text-[11px] font-medium mt-1.5" style={{ color: 'var(--ws-amber)' }}>Needs triaging</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Upcoming deadlines */}
          {soonDeadlines.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--ws-text)' }}>Coming Up</h2>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                {soonDeadlines.map((item, i) => {
                  const days = daysUntil(item.grant!.closes_at!);
                  return (
                    <button
                      key={item.id}
                      onClick={() => openGrant(item)}
                      className="w-full text-left flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--ws-surface-2)]"
                      style={{ borderTop: i > 0 ? '1px solid var(--ws-border)' : 'none' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--ws-text)' }}>{item.grant?.name}</p>
                        <p className="text-xs" style={{ color: 'var(--ws-text-tertiary)' }}>{item.grant?.provider}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {item.grant?.amount_max && (
                          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{formatMoney(item.grant.amount_max)}</span>
                        )}
                        <span className="text-xs tabular-nums" style={{ color: 'var(--ws-text-tertiary)' }}>{days}d</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Foundations */}
          {foundations.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>Foundations</h2>
                <Link href="/foundations/tracker" className="text-xs font-medium transition-colors hover:underline" style={{ color: 'var(--ws-accent)' }}>
                  View All {foundations.length} &rarr;
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {foundations.slice(0, 6).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => openFoundation(f)}
                    className="text-left flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:border-[var(--ws-accent)]"
                    style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--ws-text)' }}>{f.foundation?.name}</p>
                      <p className="text-xs" style={{ color: 'var(--ws-text-tertiary)' }}>
                        {f.foundation?.total_giving_annual
                          ? `${formatMoney(f.foundation.total_giving_annual)}/yr`
                          : 'Giving unknown'}
                        {f.foundation?.thematic_focus?.[0] && ` \u00B7 ${f.foundation.thematic_focus[0]}`}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-medium uppercase tracking-wide ml-3 shrink-0 px-2 py-0.5 rounded"
                      style={{ color: 'var(--ws-text-tertiary)', background: 'var(--ws-surface-2)' }}
                    >
                      {f.stage.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {grants.length === 0 && foundations.length === 0 && !isNewUser && (
            <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: 'var(--ws-border)' }}>
              <p className="text-sm mb-3" style={{ color: 'var(--ws-text-secondary)' }}>Your pipeline is empty</p>
              <Link
                href="/grants"
                className="inline-block px-5 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ background: 'var(--ws-accent)', color: '#fff' }}
              >
                Find Grants
              </Link>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick navigation */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ws-text-tertiary)' }}>Quick Actions</h2>
            <div className="space-y-1">
              {[
                { href: '/grants', label: 'Search Grants', icon: '\uD83D\uDD0D', count: openGrantCount },
                { href: '/home/portfolio', label: 'My Grantees', icon: '\uD83D\uDCCB' },
                { href: '/home/watchlist', label: 'Watchlist', icon: '\uD83D\uDC41\uFE0F' },
                { href: '/home/report-builder', label: 'Report Builder', icon: '\uD83D\uDCCA' },
                { href: '/home/tender-brief', label: 'Tender Brief', icon: '\uD83D\uDCE6' },
                { href: '/home/board-report', label: 'Board Report', icon: '\uD83D\uDCCB' },
                { href: '/home/api-keys', label: 'API Keys', icon: '\uD83D\uDD11' },
                { href: '/places', label: 'Place Packs', icon: '\uD83D\uDCCD' },
                { href: '/reports', label: 'Reports & Research', icon: '\uD83D\uDCCA' },
                { href: '/entities', label: 'Entity Graph', icon: '\uD83D\uDD17', count: entityCount },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-[var(--ws-surface-2)]"
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="text-sm font-medium flex-1" style={{ color: 'var(--ws-text)' }}>{item.label}</span>
                  {item.count != null && (
                    <span className="text-xs tabular-nums" style={{ color: 'var(--ws-text-tertiary)' }}>{item.count.toLocaleString()}</span>
                  )}
                </Link>
              ))}
            </div>
          </section>

          {/* Agent activity feed */}
          {agentRuns.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>Data Activity</h2>
                <Link href="/mission-control" className="text-[11px] font-medium hover:underline" style={{ color: 'var(--ws-accent)' }}>
                  All Agents
                </Link>
              </div>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                {agentRuns.map((run, i) => (
                  <div
                    key={`${run.agent_name}-${run.started_at}`}
                    className="px-3 py-2.5 flex items-start gap-2.5"
                    style={{ borderTop: i > 0 ? '1px solid var(--ws-border)' : 'none' }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{
                        background: run.status === 'success' ? 'var(--ws-green)'
                          : run.status === 'running' ? 'var(--ws-accent)'
                          : run.status === 'error' ? 'var(--ws-red)'
                          : 'var(--ws-text-tertiary)',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--ws-text)' }}>
                        {run.agent_name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>
                        {run.items_new != null && run.items_new > 0
                          ? `+${run.items_new} new`
                          : run.items_found != null
                            ? `${run.items_found} checked`
                            : run.status}
                        {' \u00B7 '}
                        {relativeTime(run.started_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Database pulse */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ws-text-tertiary)' }}>Database</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Entities', value: entityCount.toLocaleString() },
                { label: 'Open Grants', value: openGrantCount.toLocaleString() },
              ].map(stat => (
                <div
                  key={stat.label}
                  className="rounded-lg border px-3 py-2.5"
                  style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
                >
                  <p className="text-lg font-semibold tabular-nums" style={{ color: 'var(--ws-text)' }}>{stat.value}</p>
                  <p className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── Grant preview panel ── */}
      <SlidePanel open={preview?.type === 'grant'} onClose={() => setPreview(null)}>
        {preview?.type === 'grant' && preview.item.grant && (
          <>
            <SlidePanelHeader onClose={() => setPreview(null)} href={`/grants/${preview.item.grant.id}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                Grant Preview
              </p>
            </SlidePanelHeader>
            <SlidePanelBody>
              <div className="space-y-5">
                {/* Title */}
                <div>
                  <h2 className="text-lg font-semibold leading-snug" style={{ color: 'var(--ws-text)' }}>
                    {preview.item.grant.name}
                  </h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--ws-text-secondary)' }}>
                    {preview.item.grant.provider}
                  </p>
                </div>

                {/* Key details grid */}
                <div className="grid grid-cols-2 gap-3">
                  <DetailCell label="Amount" value={
                    preview.item.grant.amount_min && preview.item.grant.amount_max
                      ? `${formatMoney(preview.item.grant.amount_min)} \u2013 ${formatMoney(preview.item.grant.amount_max)}`
                      : preview.item.grant.amount_max
                        ? `Up to ${formatMoney(preview.item.grant.amount_max)}`
                        : preview.item.grant.amount_min
                          ? `From ${formatMoney(preview.item.grant.amount_min)}`
                          : 'Not specified'
                  } />
                  <DetailCell label="Closes" value={formatDate(preview.item.grant.closes_at)} highlight={
                    preview.item.grant.closes_at ? daysUntil(preview.item.grant.closes_at) <= 7 : false
                  } />
                  <DetailCell label="Stage" value={preview.item.stage.replace('_', ' ')} />
                  <DetailCell label="Categories" value={
                    preview.item.grant.categories.length > 0
                      ? preview.item.grant.categories.slice(0, 3).join(', ')
                      : 'None'
                  } />
                </div>

                {/* Deadline urgency bar */}
                {preview.item.grant.closes_at && daysUntil(preview.item.grant.closes_at) <= 14 && (
                  <div
                    className="rounded-lg px-4 py-3 flex items-center gap-3"
                    style={{
                      background: daysUntil(preview.item.grant.closes_at) <= 7
                        ? 'rgba(220,38,38,0.08)'
                        : 'rgba(217,119,6,0.08)',
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background: daysUntil(preview.item.grant.closes_at) <= 7 ? 'var(--ws-red)' : 'var(--ws-amber)',
                      }}
                    />
                    <p className="text-sm font-medium" style={{
                      color: daysUntil(preview.item.grant.closes_at) <= 7 ? 'var(--ws-red)' : 'var(--ws-amber)',
                    }}>
                      {daysUntil(preview.item.grant.closes_at) === 0
                        ? 'Closes today'
                        : `${daysUntil(preview.item.grant.closes_at)} days remaining`}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Link
                    href={`/grants/${preview.item.grant.id}`}
                    className="flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
                    style={{ background: 'var(--ws-accent)', color: '#fff' }}
                  >
                    View Full Details
                  </Link>
                  <Link
                    href="/tracker"
                    className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors border"
                    style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
                  >
                    Tracker
                  </Link>
                </div>
              </div>
            </SlidePanelBody>
          </>
        )}
      </SlidePanel>

      {/* ── Foundation preview panel ── */}
      <SlidePanel open={preview?.type === 'foundation'} onClose={() => setPreview(null)}>
        {preview?.type === 'foundation' && preview.item.foundation && (
          <>
            <SlidePanelHeader onClose={() => setPreview(null)} href={`/foundations/${preview.item.foundation.id}`}>
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>
                Foundation Preview
              </p>
            </SlidePanelHeader>
            <SlidePanelBody>
              <div className="space-y-5">
                {/* Title */}
                <div>
                  <h2 className="text-lg font-semibold leading-snug" style={{ color: 'var(--ws-text)' }}>
                    {preview.item.foundation.name}
                  </h2>
                </div>

                {/* Key details grid */}
                <div className="grid grid-cols-2 gap-3">
                  <DetailCell label="Annual Giving" value={
                    preview.item.foundation.total_giving_annual
                      ? `${formatMoney(preview.item.foundation.total_giving_annual)}/yr`
                      : 'Unknown'
                  } />
                  <DetailCell label="Relationship" value={preview.item.stage.replace('_', ' ')} />
                </div>

                {/* Thematic focus */}
                {preview.item.foundation.thematic_focus.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>
                      Thematic Focus
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.item.foundation.thematic_focus.map(t => (
                        <span
                          key={t}
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Geographic focus */}
                {preview.item.foundation.geographic_focus.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--ws-text-tertiary)' }}>
                      Geographic Focus
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {preview.item.foundation.geographic_focus.map(g => (
                        <span
                          key={g}
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: 'var(--ws-surface-2)', color: 'var(--ws-text-secondary)' }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Link
                    href={`/foundations/${preview.item.foundation.id}`}
                    className="flex-1 text-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
                    style={{ background: 'var(--ws-accent)', color: '#fff' }}
                  >
                    View Full Profile
                  </Link>
                  <Link
                    href="/foundations/tracker"
                    className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors border"
                    style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-secondary)' }}
                  >
                    Tracker
                  </Link>
                </div>
              </div>
            </SlidePanelBody>
          </>
        )}
      </SlidePanel>
    </div>
  );
}

/* ── Small detail cell used in preview panels ── */

function DetailCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: 'var(--ws-surface-2)' }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--ws-text-tertiary)' }}>
        {label}
      </p>
      <p
        className="text-sm font-medium capitalize"
        style={{ color: highlight ? 'var(--ws-red)' : 'var(--ws-text)' }}
      >
        {value}
      </p>
    </div>
  );
}
