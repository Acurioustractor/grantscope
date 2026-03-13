import Link from 'next/link';
import {
  mapThemeToCharityPurpose,
  mapThemeToFoundationFocus,
  mapThemeToSocialEnterpriseSector,
  detectFundingPowerTheme,
  fundingPowerThemeLabel,
  normaliseTheme,
  toStateCode,
} from './funding-intelligence-utils';

interface FundingIntelligenceRailProps {
  current: 'grants' | 'foundations';
  totalLabel: string;
  query?: string;
  theme?: string;
  geography?: string;
  trackerHref: string;
}

export function FundingIntelligenceRail({
  current,
  totalLabel,
  query = '',
  theme = '',
  geography = '',
  trackerHref,
}: FundingIntelligenceRailProps) {
  const activeTheme = theme || query;
  const normalizedTheme = normaliseTheme(activeTheme);
  const foundationFocus = mapThemeToFoundationFocus(activeTheme);
  const charityPurpose = mapThemeToCharityPurpose(activeTheme);
  const socialSector = mapThemeToSocialEnterpriseSector(activeTheme);
  const stateCode = toStateCode(geography);
  const powerTheme = detectFundingPowerTheme(activeTheme);
  const ndisIntent =
    normalizedTheme.includes('disab') ||
    normalizedTheme.includes('ndis') ||
    normalizedTheme.includes('autis') ||
    normalizedTheme.includes('care') ||
    normalizedTheme.includes('youth justice');

  const foundationHref = `/foundations${foundationFocus || stateCode ? '?' : ''}${new URLSearchParams({
    ...(foundationFocus ? { focus: foundationFocus } : {}),
    ...(stateCode ? { geo: `AU-${stateCode}` } : {}),
  }).toString()}`;

  const charityHref = `/charities${charityPurpose || stateCode ? '?' : ''}${new URLSearchParams({
    ...(charityPurpose ? { purpose: charityPurpose } : {}),
    ...(stateCode ? { reg_state: stateCode } : {}),
  }).toString()}`;

  const socialEnterpriseHref = `/social-enterprises${socialSector || stateCode || activeTheme.toLowerCase().includes('indigen') ? '?' : ''}${new URLSearchParams({
    ...(socialSector ? { sector: socialSector } : {}),
    ...(stateCode ? { state: stateCode } : {}),
    ...(activeTheme.toLowerCase().includes('indigen') ? { indigenous: 'true' } : {}),
  }).toString()}`;

  const pressureSearchHref = `/tracker?${new URLSearchParams({
    lens: 'pressure',
    ...(powerTheme ? { theme: powerTheme } : {}),
    ...(stateCode && stateCode !== 'NATIONAL' && stateCode !== 'INTERNATIONAL' ? { state: stateCode } : {}),
  }).toString()}`;

  const alternativesSearchHref = `/tracker?${new URLSearchParams({
    lens: 'alternatives',
    ...(powerTheme ? { theme: powerTheme } : {}),
    ...(stateCode && stateCode !== 'NATIONAL' && stateCode !== 'INTERNATIONAL' ? { state: stateCode } : {}),
  }).toString()}`;

  const capturedSearchHref = `/tracker?${new URLSearchParams({
    lens: 'captured',
    ...(powerTheme ? { theme: powerTheme } : {}),
    ...(stateCode && stateCode !== 'NATIONAL' && stateCode !== 'INTERNATIONAL' ? { state: stateCode } : {}),
  }).toString()}`;

  const primaryCard =
    current === 'grants'
      ? {
          title: 'Search live funding',
          description: 'Use grants first when you need open opportunities, deadlines, and application-ready pathways.',
          href: '/grants',
          cta: 'Open Grants',
        }
      : {
          title: 'Search aligned funders',
          description: 'Use foundations first when you need relationship targets, giving behaviour, and open programs.',
          href: '/foundations',
          cta: 'Open Foundations',
        };

  return (
    <section className="border-4 border-bauhaus-black bg-white mb-8">
      <div className="bg-bauhaus-black px-5 py-4 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-bauhaus-yellow mb-2">Funding Intelligence Layer</p>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-black">Move from directories to a funding system</h2>
            <p className="mt-2 text-sm font-medium text-white/70">
              {totalLabel}. Use one search surface to move between open grants, philanthropic funders,
              delivery organisations, and relationship tracking without starting again every time.
            </p>
          </div>
          <Link
            href={trackerHref}
            className="inline-flex px-4 py-3 border-2 border-white text-white text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-bauhaus-black transition-colors"
          >
            Open Pipeline Tracker
          </Link>
        </div>
      </div>

      <div className={`grid gap-0 ${powerTheme ? 'lg:grid-cols-6' : 'lg:grid-cols-4'}`}>
        {[
          primaryCard,
          {
            title: 'Search philanthropic funders',
            description: 'Move from causes and places into foundations that already give in those areas.',
            href: foundationHref,
            cta: foundationFocus || stateCode ? 'Search Matching Foundations' : 'Browse Foundations',
            secondaryHref: '/reports/philanthropy-power',
            secondaryCta: 'See Gatekeepers',
          },
          {
            title: 'Search delivery organisations',
            description: 'Pressure-test who is already doing the work across charities and social enterprises before outreach.',
            href: charityHref,
            cta: charityPurpose || stateCode ? 'Search Matching Charities' : 'Browse Charities',
            secondaryHref: socialEnterpriseHref,
            secondaryCta: socialSector || stateCode ? 'Search Social Enterprises' : 'Browse Social Enterprises',
          },
          {
            title: 'Start with need, not supply',
            description: 'Check place-level funding gaps, disadvantage, and community-controlled presence before you prioritise a funder or an application.',
            href: '/places',
            cta: 'Open Place Coverage',
          },
          ...(powerTheme
            ? [
                {
                  title: 'Search pressure and alternatives',
                  description:
                    `Jump straight into the cross-area search for ${fundingPowerThemeLabel(powerTheme).toLowerCase()}, ranking pressure points, captured districts, and grounded alternatives in one view.`,
                  href: pressureSearchHref,
                  cta: 'Open Pressure Search',
                  secondaryHref: alternativesSearchHref,
                  secondaryCta: 'Back Alternatives',
                },
                ...(ndisIntent
                  ? [
                      {
                        title: 'Check service market power',
                        description:
                          'Disability and care work do not live only in grants and philanthropy. See where NDIS supply is thin, where a few providers dominate, and where community-rooted alternatives are missing.',
                        href: '/reports/ndis-market',
                        cta: 'Open NDIS Market Layer',
                        secondaryHref: capturedSearchHref,
                        secondaryCta: 'Captured Markets',
                      },
                    ]
                  : [
                      {
                        title: 'Search captured power',
                        description:
                          'Open the places where funding and service power are concentrated, so you can see who is blocked out and where alternatives should be backed.',
                        href: capturedSearchHref,
                        cta: 'Open Captured Search',
                      },
                    ]),
              ]
            : []),
        ].map((card, index) => (
          <div
            key={card.title}
            className={`p-5 ${index > 0 ? 'border-t-4 lg:border-t-0 lg:border-l-4' : ''} border-bauhaus-black`}
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Workflow</p>
            <h3 className="mt-2 text-lg font-black text-bauhaus-black">{card.title}</h3>
            <p className="mt-2 text-sm font-medium text-bauhaus-muted min-h-[88px]">{card.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={card.href}
                className="inline-flex px-3 py-2 border-2 border-bauhaus-black text-bauhaus-black text-[10px] font-black uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
              >
                {card.cta}
              </Link>
              {'secondaryHref' in card && card.secondaryHref && card.secondaryCta && (
                <Link
                  href={card.secondaryHref}
                  className="inline-flex px-3 py-2 border-2 border-bauhaus-black/20 text-bauhaus-muted text-[10px] font-black uppercase tracking-widest hover:border-bauhaus-black hover:text-bauhaus-black transition-colors"
                >
                  {card.secondaryCta}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t-4 border-bauhaus-black bg-bauhaus-canvas px-5 py-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">What strong users do here</p>
        <div className="mt-2 grid gap-2 md:grid-cols-3 text-sm font-medium text-bauhaus-black">
          <p>Community organisations search grants, then trace back to aligned foundations and relationship targets.</p>
          <p>Foundations search charities and social enterprises by cause, geography, and community signals before opening a round.</p>
          <p>Corporate and philanthropic teams check place need and existing coverage before funding whoever shouts loudest.</p>
        </div>
      </div>
    </section>
  );
}
