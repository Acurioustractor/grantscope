import Link from 'next/link';

const VIEWS = [
  {
    href: '/graph/youth-justice-views/cityscape',
    title: 'Cityscape of Injustice',
    pitch: 'Each org is a tower. Height = $. The skyline IS the inequality.',
    accent: '#D02020',
    art: 'cityscape',
  },
  {
    href: '/graph/youth-justice-views/money-river',
    title: 'Money River',
    pitch: 'Three pillars fill up over 17 years. Reactive becomes a skyscraper. Prevention barely fills its glass.',
    accent: '#1040C0',
    art: 'river',
  },
  {
    href: '/graph/youth-justice-views/tree-rings',
    title: 'Tree Rings of Spend',
    pitch: 'Concentric year rings. Watch the red wedge eat the prevention sliver, ring by ring.',
    accent: '#F0C020',
    art: 'rings',
  },
  {
    href: '/graph/youth-justice-views/drain',
    title: 'The Drain',
    pitch: 'Money pours in at the top. Pipes thin at every layer. See how little reaches the kid.',
    accent: '#7C3AED',
    art: 'drain',
  },
  {
    href: '/graph/youth-justice-views/tanks',
    title: 'Two Tanks',
    pitch: 'Reactive tank vs Prevention tank. Same scale. Year scrubber fills both. The contrast IS the message.',
    accent: '#16A34A',
    art: 'tanks',
  },
];

export default function YouthJusticeViewsLauncher() {
  return (
    <div className="fixed inset-0 bg-bauhaus-canvas text-bauhaus-black overflow-y-auto">
      <div className="max-w-6xl mx-auto px-8 py-12">
        <Link href="/graph" className="text-xs font-mono uppercase tracking-widest text-bauhaus-red hover:underline">
          ← /graph
        </Link>

        <h1 className="font-black uppercase tracking-tight text-5xl md:text-7xl mt-2">
          Youth Justice
        </h1>
        <h2 className="font-black uppercase tracking-tight text-2xl md:text-3xl text-bauhaus-red mt-1">
          Five ways to see the same story
        </h2>

        <p className="font-mono text-sm md:text-base mt-6 max-w-3xl leading-relaxed">
          $19 billion of youth justice money over 17 years. <span className="bg-bauhaus-red text-white px-1">$15.1B reactive</span>{' '}
          (police, courts, detention). <span className="bg-bauhaus-yellow text-bauhaus-black px-1">$470M community-led</span>.{' '}
          <span className="bg-bauhaus-blue text-white px-1">$90M prevention</span>. The ratio is roughly{' '}
          <span className="font-bold">168:5:1</span>. A force-directed graph hides this. These five visualizations make it
          impossible to look away.
        </p>

        <div className="mt-10 grid md:grid-cols-2 gap-4">
          {VIEWS.map(v => (
            <Link
              key={v.href}
              href={v.href}
              className="block border-4 border-bauhaus-black bg-white hover:bg-bauhaus-yellow transition-colors group"
            >
              <div
                className="h-40 border-b-4 border-bauhaus-black flex items-center justify-center"
                style={{ background: v.accent }}
              >
                <ViewArt kind={v.art} accent={v.accent} />
              </div>
              <div className="p-5">
                <div className="font-black uppercase tracking-widest text-xl">{v.title}</div>
                <div className="font-mono text-xs mt-2 leading-relaxed text-zinc-700 group-hover:text-bauhaus-black">
                  {v.pitch}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-bauhaus-red mt-3 group-hover:text-bauhaus-black">
                  Open →
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 border-t-4 border-bauhaus-black pt-6 font-mono text-[11px] text-zinc-600 leading-relaxed">
          Data: <code>justice_funding</code> filtered to <code>topics @&gt; ARRAY[&apos;youth-justice&apos;]</code>, aggregates excluded,
          ≥$50K grants. Lane classification combines explicit topic tags + recipient-name patterns
          (state Justice ministries → reactive; ACCO patterns → community-led; diversion/prevention programs → prevention).
        </div>
      </div>
    </div>
  );
}

function ViewArt({ kind, accent }: { kind: string; accent: string }) {
  const stroke = '#121212';
  switch (kind) {
    case 'cityscape':
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <rect x={20} y={70} width={20} height={30} fill="#fff" stroke={stroke} strokeWidth={2} />
          <rect x={42} y={20} width={26} height={80} fill={stroke} stroke={stroke} strokeWidth={2} />
          <rect x={70} y={50} width={18} height={50} fill="#fff" stroke={stroke} strokeWidth={2} />
          <rect x={90} y={75} width={12} height={25} fill="#fff" stroke={stroke} strokeWidth={2} />
          <rect x={104} y={80} width={10} height={20} fill="#fff" stroke={stroke} strokeWidth={2} />
          <rect x={116} y={85} width={8} height={15} fill="#fff" stroke={stroke} strokeWidth={2} />
          <rect x={126} y={88} width={6} height={12} fill="#fff" stroke={stroke} strokeWidth={2} />
          <rect x={134} y={90} width={5} height={10} fill="#fff" stroke={stroke} strokeWidth={2} />
        </svg>
      );
    case 'river':
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <rect x={30} y={10} width={30} height={90} fill="#fff" stroke={stroke} strokeWidth={2} />
          <rect x={30} y={20} width={30} height={80} fill={stroke} />
          <rect x={75} y={10} width={30} height={90} fill="#fff" stroke={stroke} strokeWidth={2} />
          <rect x={75} y={88} width={30} height={12} fill="#fff" />
          <rect x={120} y={10} width={30} height={90} fill="#fff" stroke={stroke} strokeWidth={2} />
          <rect x={120} y={94} width={30} height={6} fill="#fff" />
        </svg>
      );
    case 'rings':
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <circle cx={100} cy={50} r={40} fill="none" stroke="#fff" strokeWidth={4} />
          <path d="M 100 10 A 40 40 0 0 1 134 71 L 100 50 Z" fill={stroke} />
          <circle cx={100} cy={50} r={26} fill="none" stroke="#fff" strokeWidth={4} />
          <path d="M 100 24 A 26 26 0 0 1 122 60 L 100 50 Z" fill={stroke} />
          <circle cx={100} cy={50} r={12} fill={stroke} />
        </svg>
      );
    case 'drain':
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <circle cx={100} cy={20} r={14} fill="#fff" stroke={stroke} strokeWidth={2} />
          <path d="M 86 30 L 60 55 L 75 55 L 90 80 L 110 80 L 125 55 L 140 55 L 114 30 Z" fill="#fff" stroke={stroke} strokeWidth={2} />
          <circle cx={100} cy={88} r={4} fill={stroke} />
        </svg>
      );
    case 'tanks':
      return (
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <rect x={20} y={10} width={70} height={80} fill="#fff" stroke={stroke} strokeWidth={2} />
          <rect x={20} y={20} width={70} height={70} fill={stroke} />
          <rect x={110} y={10} width={70} height={80} fill="#fff" stroke={stroke} strokeWidth={2} />
          <rect x={110} y={84} width={70} height={6} fill={stroke} />
        </svg>
      );
    default:
      return <div style={{ background: accent }} className="w-full h-full" />;
  }
}
