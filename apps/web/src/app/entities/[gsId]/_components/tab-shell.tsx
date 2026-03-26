'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, type ReactNode } from 'react';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'money', label: 'Money Flows' },
  { key: 'network', label: 'Network' },
  { key: 'evidence', label: 'Evidence' },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

interface TabShellProps {
  gsId: string;
  defaultTab?: TabKey;
  overviewContent: ReactNode;
  moneyContent: ReactNode;
  networkContent: ReactNode;
  evidenceContent: ReactNode;
  hasEvidence: boolean;
  entityType?: string;
}

export function TabShell({
  defaultTab = 'overview',
  overviewContent,
  moneyContent,
  networkContent,
  evidenceContent,
  hasEvidence,
  entityType,
}: TabShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (searchParams.get('tab') as TabKey) || defaultTab;

  const setTab = useCallback(
    (tab: TabKey) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'overview') {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const isPerson = entityType === 'person';
  const visibleTabs = TABS.filter((t) => {
    if (t.key === 'evidence' && !hasEvidence) return false;
    if (t.key === 'money' && isPerson) return false;
    return true;
  });

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0 border-b-4 border-bauhaus-black mb-8">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-colors ${
              activeTab === tab.key
                ? 'bg-bauhaus-black text-white'
                : 'text-bauhaus-muted hover:text-bauhaus-black hover:bg-bauhaus-canvas'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && overviewContent}
      {activeTab === 'money' && moneyContent}
      {activeTab === 'network' && networkContent}
      {activeTab === 'evidence' && evidenceContent}
    </div>
  );
}
