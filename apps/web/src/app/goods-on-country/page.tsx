import type { Metadata } from 'next';
import Link from 'next/link';
import { GOODS_UNIT_ECONOMICS } from '@/lib/services/goods-living-investment-model';

export const metadata: Metadata = {
  title: 'Goods on Country — CivicGraph',
  description:
    'A flat-packable, washable bed made from recycled plastic, heavy-duty canvas and galvanised steel. Built on Country, with community. Buy beds for your project, or sponsor a bed for a community.',
};

/**
 * PROTOTYPE — Goods on Country marketplace profile.
 *
 * The archetype for "Profile 2.0": one open profile that is both desirable
 * (story, photos, the feeling) and defensible (evidence panel). Two doors —
 * buy for your project (commercial, Goods on Country) or sponsor a bed for a
 * community (receipted via The Butterfly Movement DGR). Real story + photos
 * from the Utopia Homelands deployment.
 *
 * Voice: no em-dashes, sentence case, communities named, real numbers only,
 * quotes verbatim. Photo consent + final counts pending (see footer note).
 */

const COMMUNITIES = [
  'Wherever the need is greatest',
  'Utopia Homelands, NT',
  'Tennant Creek, NT',
  'Ampilatwatja, NT',
  'Palm Island, QLD',
  'Maningrida, NT',
];

const GOODS_IMAGE_SIZE = { width: 1760, height: 1173 };

const GOODS_IMAGES = {
  hero: {
    src: '/goods/hero.jpg',
    alt: 'Carrying Stretch Beds onto Country at Utopia Homelands',
  },
  beforeAfter: {
    src: '/goods/beforeafter.jpg',
    alt: 'An Elder on her Stretch Bed beside her home at Utopia Homelands',
  },
  build: {
    src: '/goods/build.jpg',
    alt: 'Building Stretch Beds on Country at Utopia Homelands',
  },
  gallery: [
    { src: '/goods/offground.jpg', alt: 'Resting on a finished bed, up off the ground' },
    { src: '/goods/materials.jpg', alt: 'Working the recycled plastic that becomes the bed legs' },
    { src: '/goods/close.jpg', alt: 'Golden hour at Utopia Homelands' },
  ],
} as const;

function Eyebrow({ children, tone = 'red' }: { children: React.ReactNode; tone?: 'red' | 'yellow' | 'muted' }) {
  const color = tone === 'yellow' ? 'text-bauhaus-yellow' : tone === 'muted' ? 'text-bauhaus-muted' : 'text-bauhaus-red';
  return <div className={`text-[11px] font-black uppercase tracking-widest ${color} mb-2`}>{children}</div>;
}

function GoodsImage({
  src,
  alt,
  className,
  loading = 'lazy',
}: {
  src: string;
  alt: string;
  className: string;
  loading?: 'eager' | 'lazy';
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={GOODS_IMAGE_SIZE.width}
      height={GOODS_IMAGE_SIZE.height}
      loading={loading}
      decoding="async"
      className={className}
    />
  );
}

export default function GoodsOnCountryPage() {
  return (
    <div className="space-y-12">
      <Link href="/suppliers" className="text-xs font-black uppercase tracking-widest text-bauhaus-muted hover:text-bauhaus-black">
        &larr; The open supply base
      </Link>

      {/* Hero */}
      <header>
        <div className="relative border-4 border-bauhaus-black overflow-hidden">
          <GoodsImage {...GOODS_IMAGES.hero} loading="eager" className="block w-full h-[clamp(320px,52vh,560px)] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-bauhaus-black/85 via-bauhaus-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-[10px] px-2 py-0.5 font-black uppercase tracking-widest border-2 border-bauhaus-black bg-bauhaus-yellow text-bauhaus-black">Proven outcomes</span>
              <span className="text-[10px] px-2 py-0.5 font-black uppercase tracking-widest border-2 border-money bg-money-light text-money">Verified</span>
              <span className="text-[10px] px-2 py-0.5 font-black uppercase tracking-widest border-2 border-white/40 text-white/90">A Curious Tractor</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-white leading-none mb-3">
              Goods on Country
            </h1>
            <p className="text-base sm:text-lg font-medium text-white/90 max-w-2xl leading-relaxed">
              A flat-packable, washable bed made from recycled plastic, heavy-duty canvas and galvanised steel.
              Built on Country, with community.
            </p>
          </div>
        </div>
        <p className="text-xs font-bold text-bauhaus-muted mt-3 uppercase tracking-wider">
          Mparntwe (Alice Springs), NT · delivered to Utopia Homelands, Tennant Creek, Ampilatwatja, Palm Island, Maningrida
        </p>
      </header>

      {/* The two doors */}
      <section>
        <Eyebrow>Two ways to back this work</Eyebrow>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-4 border-bauhaus-black">
          {/* Buy */}
          <div className="bg-white p-6 sm:p-8 border-b-4 lg:border-b-0 lg:border-r-4 border-bauhaus-black flex flex-col">
            <Eyebrow tone="muted">Buy · for your project</Eyebrow>
            <h2 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black mb-3">Buy Stretch Beds</h2>
            <p className="text-[15px] font-medium text-bauhaus-black/80 leading-relaxed mb-4">
              Steel poles, Australian canvas, recycled-plastic legs. 200kg load. Up in about five minutes, no tools,
              no screws. Built to last ten years. For shelters, camps, housing programs, anyone who needs a bed that lasts.
            </p>
            <p className="text-xs font-bold text-bauhaus-muted mb-5">
              Commercial supply from Goods on Country (A Curious Tractor Pty Ltd). Delivery on Country included.
            </p>
            <Link
              href="#"
              className="mt-auto inline-block text-center px-6 py-3 bg-bauhaus-blue text-white text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black hover:bg-bauhaus-black transition-colors"
            >
              Buy beds
            </Link>
          </div>

          {/* Sponsor for community */}
          <div className="bg-bauhaus-black p-6 sm:p-8 flex flex-col">
            <Eyebrow tone="yellow">Sponsor · for community</Eyebrow>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-3">Sponsor a bed for community</h2>
            <p className="text-[15px] font-medium text-white/80 leading-relaxed mb-4">
              One Stretch Bed, into one home that needs it, in a community you can choose. We deliver. We log the bed
              under a QR code. You can follow exactly where it lands.
            </p>
            <label className="block mb-5">
              <span className="block text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow mb-1.5">Where should this bed go?</span>
              <select className="w-full border-2 border-white/30 bg-bauhaus-black px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-bauhaus-yellow">
                {COMMUNITIES.map((c) => (
                  <option key={c} className="text-bauhaus-black">{c}</option>
                ))}
              </select>
            </label>
            <p className="text-xs font-bold text-white/50 mb-5">
              Receipted through The Butterfly Movement, a registered charity with DGR since 2012. Your gift is tax deductible.
            </p>
            <Link
              href="#"
              className="mt-auto inline-block text-center px-6 py-3 bg-bauhaus-yellow text-bauhaus-black text-xs font-black uppercase tracking-widest border-2 border-bauhaus-yellow hover:bg-white hover:border-white transition-colors"
            >
              Sponsor a bed
            </Link>
          </div>
        </div>
      </section>

      {/* Why a bed */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-0 border-4 border-bauhaus-black">
        <div className="order-2 md:order-1 bg-bauhaus-canvas p-6 sm:p-10 flex flex-col justify-center">
          <Eyebrow>Why a bed</Eyebrow>
          <p className="text-xl sm:text-2xl font-black text-bauhaus-black leading-snug">
            Some people were sleeping on a door laid flat on the ground.
          </p>
          <p className="text-[15px] font-medium text-bauhaus-black/80 leading-relaxed mt-3">
            Now the door is a door again, and the bed is a bed. Off the ground. Washable. Built to last ten years.
          </p>
        </div>
        <div className="order-1 md:order-2 aspect-[3/2] md:aspect-auto md:min-h-[280px]">
          <GoodsImage {...GOODS_IMAGES.beforeAfter} className="block w-full h-full object-cover" />
        </div>
      </section>

      {/* The story — Utopia Homelands */}
      <section>
        <Eyebrow>The story · Utopia Homelands</Eyebrow>
        <div className="border-4 border-bauhaus-black bg-white">
          <div className="min-h-[300px] sm:h-[420px] border-b-4 border-bauhaus-black">
            <GoodsImage {...GOODS_IMAGES.build} className="block w-full h-full object-cover" />
          </div>
          <div className="p-6 sm:p-10 max-w-3xl">
            <p className="text-xl sm:text-2xl font-black text-bauhaus-black leading-snug mb-6">
              Mykel built the bed he would sleep on from recycled lids. Then he built more. Seven in total.
            </p>

            <blockquote className="border-l-4 border-bauhaus-red pl-4 mb-6">
              <p className="text-lg font-bold text-bauhaus-black italic leading-relaxed">
                &ldquo;Comfortable as. Smooth, tight, hard, fancy. It&apos;s not trampoline.&rdquo;
              </p>
              <cite className="text-xs font-black uppercase tracking-widest text-bauhaus-muted not-italic">Mykel</cite>
            </blockquote>

            <p className="text-[15px] font-medium text-bauhaus-black/80 leading-relaxed mb-4">An Elder watched him work.</p>

            <blockquote className="border-l-4 border-bauhaus-black pl-4 mb-6">
              <p className="text-lg font-bold text-bauhaus-black italic leading-relaxed">
                &ldquo;Well done, grandson. Well done, brother. That could be a good employment for yourself too, grandson. Later on.&rdquo;
              </p>
            </blockquote>

            <blockquote className="border-l-4 border-bauhaus-yellow pl-4 mb-8">
              <p className="text-lg font-bold text-bauhaus-black italic leading-relaxed">
                &ldquo;Yeah, I&apos;ll be rocking up every day to make them.&rdquo;
              </p>
              <cite className="text-xs font-black uppercase tracking-widest text-bauhaus-muted not-italic">Mykel</cite>
            </blockquote>

            <p className="text-[15px] font-medium text-bauhaus-black leading-relaxed">
              Waste into rest. A pile of lids into a bed. A morning into a trade. A young man into someone an Elder is proud to name.
            </p>
          </div>

          {/* gallery */}
          <div className="grid grid-cols-3 gap-0 border-t-4 border-bauhaus-black">
            {GOODS_IMAGES.gallery.map((img, i) => (
              <div key={img.src} className={`aspect-[3/2] min-h-40 sm:min-h-56 ${i < 2 ? 'border-r-4 border-bauhaus-black' : ''}`}>
                <GoodsImage {...img} className="block w-full h-full object-cover" />
              </div>
            ))}
          </div>

          <div className="p-6 sm:p-10 border-t-4 border-bauhaus-black bg-bauhaus-canvas">
            <p className="text-[15px] font-medium text-bauhaus-black/80 leading-relaxed">
              At Antarrengeny, Elders Frank and Casey Holmes said they were no longer experiencing back pains after their new beds.
            </p>
            <p className="text-[11px] font-bold text-bauhaus-muted mt-2 uppercase tracking-wider">
              Source: Oonchiumpa good news story, 2 December 2025
            </p>
          </div>
        </div>
      </section>

      {/* The evidence — the honesty layer */}
      <section>
        <Eyebrow tone="muted">The evidence</Eyebrow>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-4 border-bauhaus-black">
          {[
            { v: '60 beds', l: 'Delivered to Utopia Homelands, 7 to 9 Oct 2025', accent: 'text-money' },
            { v: 'A$85,712', l: 'Funded by Centrecorp Foundation', accent: 'text-bauhaus-black' },
            {
              v: `$${GOODS_UNIT_ECONOMICS.contributionChange.toFixed(2)}`,
              l: 'Modelled contribution increase per bed if in-house pressing achieves workpaper cost',
              accent: 'text-money',
            },
            { v: '20kg', l: 'Plastic design mass per Stretch Bed, not weighed diversion', accent: 'text-bauhaus-black' },
          ].map((s, i) => (
            <div key={s.l} className={`bg-white p-4 sm:p-5 ${i < 3 ? 'border-r-4' : ''} ${i < 2 ? 'border-b-4 sm:border-b-0' : ''} border-bauhaus-black`}>
              <div className={`text-2xl sm:text-3xl font-black ${s.accent}`}>{s.v}</div>
              <div className="text-[11px] font-bold text-bauhaus-muted mt-1 leading-snug">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="border-4 border-t-0 border-bauhaus-black bg-bauhaus-canvas p-5 space-y-2">
          <p className="text-sm font-bold text-bauhaus-black">
            Buy beds: Goods on Country, A Curious Tractor Pty Ltd, ABN 36 697 347 676 (commercial supply).
          </p>
          <p className="text-sm font-bold text-bauhaus-black">
            Sponsor a bed: receipted through The Butterfly Movement, ABN 22 155 132 684, Item 1 DGR and PBI since 2012.
          </p>
          <p className="text-[11px] font-medium text-bauhaus-muted leading-relaxed pt-1">
            Sources: Goods asset register and the Centrecorp impact report. The 60 beds shown are a verified delivery,
            not a program total. The per-bed contribution change is a cost-model result that still needs an instrumented
            production run. The 20kg plastic figure is design mass, not a weighed diversion result.
          </p>
        </div>
      </section>

      {/* The model */}
      <section className="border-4 border-bauhaus-black bg-bauhaus-black text-white p-6 sm:p-10">
        <Eyebrow tone="yellow">The model</Eyebrow>
        <p className="text-[15px] sm:text-base font-medium text-white/80 leading-relaxed max-w-3xl mb-4">
          The invention is the loop. Health hardware, circular plastic and local production in one system. Owning the
          press changes cost, margin, jobs and ownership at the same time. Beds are built with community, on Country,
          from plastic the community collects. The intended destination is not only a profit share. It is an agreed
          community owner holding the machines, knowledge, customer relationships, margin and next decisions.
        </p>
        <p className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-bauhaus-yellow leading-none">
          Our job is to become unnecessary.
        </p>
      </section>

      {/* Prototype note */}
      <p className="text-[11px] font-bold text-bauhaus-muted uppercase tracking-wider border-t-2 border-bauhaus-black/20 pt-4">
        Prototype for internal review. Photo consent, final bed counts and pricing to be confirmed before any public launch.
      </p>
    </div>
  );
}
