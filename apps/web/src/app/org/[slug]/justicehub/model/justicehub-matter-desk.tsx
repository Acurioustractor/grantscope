'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarBlank,
  CaretRight,
  CheckCircle,
  FileText,
  Gavel,
  Lightbulb,
  MapPin,
  ShieldWarning,
  UserCircle,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react';
import type { JusticeHubMatterDeskSnapshot } from '@/lib/services/justicehub-matter-desk';

type JusticeContext = 'matter' | 'evidence' | 'learning';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function JusticeHubMatterDesk({ desk }: { desk: JusticeHubMatterDeskSnapshot }) {
  const matter = desk.matters[desk.matterOrder[0]];
  const [context, setContext] = useState<JusticeContext>('matter');

  return (
    <main className="!mx-0 min-h-screen !max-w-none bg-[#f5f7f8] text-slate-950">
      <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-[1320px] items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>{desk.project.label}</span>
              <CaretRight size={12} weight="bold" aria-hidden />
              <span>Matter decision desk</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              {matter.title}
            </h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <MapPin size={17} aria-hidden />
                {matter.placeLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarBlank size={17} aria-hidden />
                Read {formatDate(matter.readAt)}
              </span>
              <span>
                Working position: <strong className="text-[#1040c0]">{matter.pathway.label}</strong>
              </span>
            </div>
          </div>
          <div className="relative hidden h-[112px] w-[210px] shrink-0 overflow-hidden rounded-2xl sm:block">
            <Image
              src="/images/justicehub-seed-house.jpg"
              alt="A community-led place represented in JusticeHub"
              fill
              priority
              sizes="210px"
              className="object-cover"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] space-y-4 p-4 sm:p-6 lg:p-8">
        <section className="grid gap-5 rounded-2xl border border-[#d7b16a]/40 bg-[#fffaf1] p-5 lg:grid-cols-[1.2fr_0.9fr_160px] lg:p-6">
          <div className="flex gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#b9812d] text-white">
              <Lightbulb size={21} weight="fill" aria-hidden />
            </span>
            <div>
              <div className="text-xs font-semibold text-[#7c5f21]">Next decision</div>
              <p className="mt-2 max-w-xl text-base font-semibold leading-6">{matter.nextDecision}</p>
            </div>
          </div>
          <div className="border-t border-[#d7b16a]/30 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className="text-xs font-semibold text-[#7c5f21]">Unresolved questions</div>
            <ol className="mt-2 space-y-2">
              {matter.unresolvedQuestions.map((question, index) => (
                <li key={question} className="flex gap-2 text-xs leading-5 text-slate-700">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white font-semibold text-[#7c5f21]">
                    {index + 1}
                  </span>
                  {question}
                </li>
              ))}
            </ol>
          </div>
          <div className="border-t border-[#d7b16a]/30 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className="text-xs font-semibold text-[#7c5f21]">Owner</div>
            <UserCircle size={42} weight="thin" className="mt-3 text-slate-400" aria-hidden />
            <div className="mt-1 text-sm font-medium text-slate-700">{matter.nextAction.owner ?? 'Unassigned'}</div>
            <div className="mt-2 text-xs text-slate-500">Due date not set</div>
          </div>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2.5">
              <UsersThree size={21} className="text-[#1040c0]" aria-hidden />
              <h2 className="font-semibold">Authority and relationship</h2>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{matter.pathway.disclaimer}</p>
            <div className="mt-5 rounded-xl bg-[#f3f6ff] p-4">
              <ShieldWarning size={22} className="text-[#1040c0]" aria-hidden />
              <div className="mt-3 text-sm font-semibold">{matter.authority.label}</div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{matter.authority.note}</p>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 p-4">
              <div className="text-sm font-semibold">{matter.currentRequest.label}</div>
              <p className="mt-2 text-xs leading-5 text-slate-600">{matter.currentRequest.note}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <FileText size={21} className="text-[#1040c0]" aria-hidden />
                <h2 className="font-semibold text-[#1040c0]">Connected evidence</h2>
              </div>
              <span className="rounded-full border border-[#1040c0]/15 bg-[#f3f6ff] px-2.5 py-1 text-[11px] font-semibold text-[#1040c0]">
                Partial
              </span>
            </div>
            <div className="mt-5 space-y-1">
              {[
                ['Public initiative evidenced', 'Budget measure and program pages establish Kickstarter as a named initiative.', CheckCircle],
                [`${matter.evidence.sourceCount} public sources connected`, 'Budget, program and government statement sources are retained separately.', FileText],
                ['Provider and model proof incomplete', matter.evidence.note, WarningCircle],
                ['Human review not connected', 'No retained JusticeHub review currently authorises publication or outreach.', UserCircle],
              ].map(([label, note, Icon]) => (
                <div key={String(label)} className="flex gap-3 border-b border-slate-100 py-3 last:border-0">
                  <Icon size={20} className="mt-0.5 shrink-0 text-[#1040c0]" aria-hidden />
                  <div>
                    <div className="text-sm font-semibold">{String(label)}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{String(note)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2.5">
              <Gavel size={21} className="text-[#1040c0]" aria-hidden />
              <h2 className="font-semibold">Action and learning</h2>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">Next concrete action</div>
              <p className="mt-2 text-sm font-semibold leading-6">{matter.nextAction.label}</p>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-500">What happens afterwards</div>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Invite correction, retain different perspectives, record what was authorised, and revise the public claim.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-[#0b2454] p-4 text-white">
              <div>
                <div className="text-xs font-semibold text-blue-200">Learning question</div>
                <div className="mt-1 text-sm font-semibold">What changed, for whom, according to whom?</div>
              </div>
              <ArrowRight size={20} aria-hidden />
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div role="tablist" aria-label="JusticeHub matter context" className="grid border-b border-slate-200 sm:grid-cols-3">
            {[
              { id: 'matter' as const, label: 'Matter', icon: BookOpen },
              { id: 'evidence' as const, label: 'Evidence boundary', icon: FileText },
              { id: 'learning' as const, label: 'Learning', icon: Gavel },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = context === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setContext(tab.id)}
                  className={`relative flex min-h-16 items-center gap-3 border-r px-5 text-left ${
                    active ? 'bg-[#f3f6ff] text-[#1040c0]' : 'hover:bg-slate-50'
                  }`}
                >
                  <Icon size={22} aria-hidden />
                  <span className="text-sm font-semibold">{tab.label}</span>
                  <span className={`absolute inset-x-0 bottom-0 h-0.5 ${active ? 'bg-[#1040c0]' : ''}`} aria-hidden />
                </button>
              );
            })}
          </div>
          <div role="tabpanel" className="p-5 text-sm leading-6 text-slate-700">
            {context === 'matter'
              ? 'Queensland describes Kickstarter as early intervention. JusticeHub’s matter is narrower: verify who is funded, where they work, what model they use, and what evidence or community account can responsibly support the claim.'
              : context === 'evidence'
                ? 'Public expenditure and program announcements can establish that government made and funded a claim. They cannot establish participant experience, cultural authority, community consent or program outcomes.'
                : 'The matter returns after provider verification, an authorised contribution, new outcome evidence, a disputed claim, or a deliberately named review date.'}
          </div>
        </section>
      </div>
    </main>
  );
}

