'use client';

import { useEffect, useState } from 'react';

const sections = [
  { id: 'concentration', number: '01', label: 'The Concentration Problem' },
  { id: 'tax-structures', number: '02', label: 'Tax-Advantaged Structures' },
  { id: 'who-misses-out', number: '03', label: 'Who Misses Out' },
  { id: 'reputation', number: '04', label: 'Reputation Cleansing' },
  { id: 'political', number: '05', label: 'Political Influence' },
  { id: 'tax-question', number: '06', label: 'The Tax Question' },
  { id: 'what-now', number: '07', label: 'What Now' },
];

export function TableOfContents() {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0 }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <nav className="hidden lg:block">
      <div className="sticky top-24">
        <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-4">Contents</p>
        <ul className="space-y-0 border-l-4 border-bauhaus-black/10">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={`block pl-4 py-2 text-sm font-bold transition-all border-l-4 -ml-[4px] ${
                  activeId === section.id
                    ? 'border-bauhaus-red text-bauhaus-black'
                    : 'border-transparent text-bauhaus-muted hover:text-bauhaus-black hover:border-bauhaus-black/30'
                }`}
              >
                <span className="text-bauhaus-red mr-2 text-xs">{section.number}</span>
                {section.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-6 pt-4 border-t-2 border-bauhaus-black/10 space-y-2">
          <a href="/reports/big-philanthropy" className="block text-xs font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">
            $222 Billion Report &rarr;
          </a>
          <a href="/reports/community-power" className="block text-xs font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">
            Community Power Playbook &rarr;
          </a>
        </div>
      </div>
    </nav>
  );
}
