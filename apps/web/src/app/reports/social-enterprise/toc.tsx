'use client';

import { useEffect, useState } from 'react';

const sections = [
  { id: 'invisible-sector', number: '01', label: 'The Invisible Sector' },
  { id: 'what-is-se', number: '02', label: 'What Is a Social Enterprise?' },
  { id: 'landscape', number: '03', label: 'The Australian Landscape' },
  { id: 'legal-gap', number: '04', label: 'The Legal Gap' },
  { id: 'indigenous-enterprise', number: '05', label: 'Indigenous Enterprise' },
  { id: 'social-procurement', number: '06', label: 'Social Procurement' },
  { id: 'data-problem', number: '07', label: 'The Data Problem' },
  { id: 'grantscope-role', number: '08', label: 'Why CivicGraph' },
  { id: 'how-to-use', number: '09', label: 'How to Use This Platform' },
  { id: 'what-next', number: '10', label: 'What Comes Next' },
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
          <a href="/social-enterprises" className="block text-xs font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">
            Browse Directory &rarr;
          </a>
          <a href="/reports/community-power" className="block text-xs font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">
            Community Power Playbook &rarr;
          </a>
          <a href="/reports/community-parity" className="block text-xs font-black text-bauhaus-blue hover:text-bauhaus-red uppercase tracking-wider">
            Community Parity Report &rarr;
          </a>
        </div>
      </div>
    </nav>
  );
}
