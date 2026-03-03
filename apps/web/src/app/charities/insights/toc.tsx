'use client';

import { useEffect, useState } from 'react';

const sections = [
  { id: 'size-pyramid', number: '01', label: 'The Size Pyramid' },
  { id: 'geography', number: '02', label: 'Where the Money Goes' },
  { id: 'purposes', number: '03', label: 'What Charities Do' },
  { id: 'beneficiaries', number: '04', label: 'Who They Serve' },
  { id: 'grant-makers', number: '05', label: 'The Grant-Making Ecosystem' },
  { id: 'pbi', number: '06', label: 'PBI & Tax Deductibility' },
  { id: 'workforce', number: '07', label: 'The Workforce' },
  { id: 'trends', number: '08', label: 'Seven-Year Trends' },
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

        <div className="mt-6 pt-4 border-t-2 border-bauhaus-black/10">
          <a href="/charities" className="text-xs font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">
            Charity Directory &rarr;
          </a>
        </div>
      </div>
    </nav>
  );
}
