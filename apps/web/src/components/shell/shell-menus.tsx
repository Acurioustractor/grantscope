'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Question, SignOut, User, Wrench } from '@phosphor-icons/react/dist/ssr';

export interface DataEvent {
  id: string;
  title: string;
  detail: string;
  at: string; // preformatted, server-side — avoids TZ drift between server and client render
  failed: boolean;
}

interface ShellMenusProps {
  events: DataEvent[];
  userEmail: string | null;
  isAdmin: boolean;
}

/**
 * Notifications here are DATA events (pipeline runs, refresh failures), not social noise —
 * see thoughts/shared/plans/dashboard-shell-buildout.md. The dot is red only when
 * something actually failed.
 */
export function ShellMenus({ events, userEmail, isAdmin }: ShellMenusProps) {
  const [open, setOpen] = useState<'bell' | 'help' | 'profile' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const hasFailure = events.some((e) => e.failed);
  const toggle = (m: 'bell' | 'help' | 'profile') => setOpen((cur) => (cur === m ? null : m));

  return (
    <div ref={rootRef} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => toggle('bell')}
        aria-label="Data events"
        className="shell-control relative flex h-9 w-9 items-center justify-center"
        style={{ background: 'var(--shell-surface)' }}
      >
        <Bell size={16} weight="bold" />
        {hasFailure && (
          <span
            className="absolute right-2 top-2 h-2 w-2 rounded-full"
            style={{ background: '#D02020' }}
          />
        )}
      </button>
      <button
        type="button"
        onClick={() => toggle('help')}
        aria-label="Help"
        className="shell-control flex h-9 w-9 items-center justify-center"
        style={{ background: 'var(--shell-surface)' }}
      >
        <Question size={16} weight="bold" />
      </button>
      <button
        type="button"
        onClick={() => toggle('profile')}
        aria-label="Profile"
        className="shell-control flex h-9 w-9 items-center justify-center"
        style={{ background: 'var(--shell-ink)', color: '#FFFFFF' }}
      >
        <User size={16} weight="bold" />
      </button>

      {open === 'bell' && (
        <Popover title="Data events">
          {events.length === 0 && (
            <p className="px-3 py-3 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>
              No pipeline activity recorded.
            </p>
          )}
          {events.map((e) => (
            <div
              key={e.id}
              className="flex gap-2.5 px-3 py-2.5"
              style={{ borderTop: '1px solid var(--shell-line)' }}
            >
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: e.failed ? '#D02020' : '#059669' }}
              />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{e.title}</div>
                <div className="text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
                  {e.detail} · {e.at}
                </div>
              </div>
            </div>
          ))}
        </Popover>
      )}

      {open === 'help' && (
        <Popover title="Help">
          <MenuLink href="/dashboard/guide" label="What this is" />
          <MenuLink href="/dashboard/help" label="Why our numbers differ" />
          <MenuLink href="/dashboard/help#caveats" label="Caveats on every view" />
          <MenuLink href="/dashboard/docs" label="The data we hold" />
          <MenuLink href="/clarity" label="The question registry" />
          <MenuLink href="/methodology" label="Methodology" />
        </Popover>
      )}

      {open === 'profile' && (
        <Popover title={userEmail ?? 'Not signed in'}>
          {userEmail ? (
            <>
              <MenuLink href="/account" label="Account" icon={<User size={14} weight="bold" />} />
              {isAdmin && (
                <MenuLink href="/admin" label="Admin" icon={<Wrench size={14} weight="bold" />} />
              )}
              <MenuLink
                href="/auth/signout"
                label="Sign out"
                icon={<SignOut size={14} weight="bold" />}
              />
            </>
          ) : (
            <MenuLink href="/login" label="Sign in" />
          )}
        </Popover>
      )}
    </div>
  );
}

function Popover({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="shell-card absolute right-0 top-11 z-50 w-[320px] overflow-hidden py-1"
      style={{ boxShadow: '0 8px 24px rgba(18,18,18,0.10)' }}
    >
      <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--shell-muted)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function MenuLink({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium hover:bg-[var(--shell-canvas)]"
    >
      {icon}
      {label}
    </Link>
  );
}
