import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getWikiSupportIndex, wikiSupportSourceSlug } from '@/lib/services/wiki-support-index';
import {
  WORKSHOP_AREAS,
  WORKSHOP_TEMPLATES,
  getWorkshopSourceDocuments,
} from '@/lib/services/act-workshop-wiki';

export const revalidate = 3600;

const DOCUMENT_PACK = [
  {
    label: 'Vision, strategy, or business plan',
    detail: 'Use this to prove the ambition, route, project priorities, and operating model.',
    areas: ['vision-ambition', 'strategy-risk'],
  },
  {
    label: 'Revenue, costs, and yearly financial summary',
    detail: 'Use this to support sustainability, use of funds, contract pricing, and capital readiness.',
    areas: ['financial-performance', 'business-model', 'investors-capital'],
  },
  {
    label: 'Recent pitch deck or grant application',
    detail: 'Use this as reusable language for the problem, proof, ask, and delivery plan.',
    areas: ['social-objective-impact', 'investors-capital'],
  },
  {
    label: 'Theory of change or impact measures',
    detail: 'Use this to connect ACT project work to evidence, outcomes, and system gaps.',
    areas: ['social-objective-impact', 'governance-reporting'],
  },
  {
    label: 'Constitution, governance docs, or risk register',
    detail: 'Use this to answer vehicle, accountability, reporting, and risk questions.',
    areas: ['governance-reporting', 'legal-structure', 'strategy-risk'],
  },
  {
    label: 'Team structure and key delivery roles',
    detail: 'Use this to show delivery capacity, advisors, community partners, and follow-up ownership.',
    areas: ['people-organisation', 'process-technology'],
  },
];

const RUN_STEPS = [
  {
    label: 'Pick the output',
    detail: 'Grant section, foundation brief, procurement offer, capital ask, board note, or CRM follow-up.',
  },
  {
    label: 'Choose the project lane',
    detail: 'Goods, CivicGraph, JusticeHub, Empathy Ledger, PICC/Palm Island, Harvest, or ACT shared service.',
  },
  {
    label: 'Pull proof',
    detail: 'Use wiki source docs, pipeline records, funder relationships, contacts, finance/project codes, and field evidence.',
  },
  {
    label: 'Create the next action',
    detail: 'Assign owner, route, due date, source link, and where it should live next: GrantScope, GHL, wiki, or board pack.',
  },
];

function sourcePathLabel(path: string) {
  return path
    .replace('/Users/benknight/Code/', '')
    .replace(/^act-global-infrastructure\//, 'act-global-infrastructure / ')
    .replace(/^Goods Asset Register\//, 'Goods Asset Register / ');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (shouldUseFastLocalOrg() && isActSlug(slug)) {
    return {
      title: `Workshop Wiki - ${ACT_FAST_PROFILE.name} - CivicGraph`,
      description: 'ACT workshop operating board for fundability, governance, shared services, contracts, and capital routes.',
    };
  }
  const profile = await getOrgProfileBySlug(slug);
  return {
    title: profile ? `Workshop Wiki - ${profile.name} - CivicGraph` : 'Workshop Wiki - CivicGraph',
    description: 'ACT workshop operating board for fundability, governance, shared services, contracts, and capital routes.',
  };
}

export default async function WorkshopAlignmentWikiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug)
    ? ACT_FAST_PROFILE
    : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const wikiSupportIndex = getWikiSupportIndex();
  const projectsBySlug = new Map(wikiSupportIndex.projects.map((project) => [project.slug, project]));
  const sourceInventory = wikiSupportIndex.source_inventory.filter((source) => source.exists);

  const operatingMoves = [
    {
      title: 'Build the Goods support pack',
      route: 'Grant + procurement + foundation + capital',
      outcome: 'Turn Goods into a fundable and contractable offer with evidence, route, budget, vehicle, and next relationship move.',
      creates: ['Goods funder brief', 'procurement offer', 'use-of-funds table', 'foundation approach'],
      evidence: ['Goods market intelligence', 'path to thousands', 'asset register', 'Snow submission review'],
      primary: { label: 'Goods operating wiki', href: `/org/${slug}/wiki/goods-operating-system` },
      secondary: { label: 'Goods grants', href: '/grants?type=open_opportunity&project=goods&sort=closing_asc' },
    },
    {
      title: 'Move CivicGraph opportunities',
      route: 'Pipeline + funder relationships',
      outcome: 'Decide which opportunities deserve action now, which need evidence, and which should become CRM follow-ups.',
      creates: ['pipeline decision', 'foundation brief', 'GHL next touch', 'application evidence list'],
      evidence: ['matched grants', 'foundation contacts', 'source frontier', 'relationship signals'],
      primary: { label: 'Open pipeline', href: `/org/${slug}/civicgraph#project-pipeline` },
      secondary: { label: 'Open contacts', href: `/org/${slug}/contacts` },
    },
    {
      title: 'Package ACT shared service',
      route: 'Operating model + service offer',
      outcome: 'Explain what ACT provides across projects so grant, foundation, and procurement asks do not read like disconnected projects.',
      creates: ['shared service offer menu', 'systems map', '90 day support plan', 'board note'],
      evidence: ['ACT operational thesis', 'knowledge ops loop', 'project codes', 'repo connections'],
      primary: { label: 'ACT dashboard', href: `/org/${slug}` },
      secondary: { label: 'Source inventory', href: '#source-documents' },
    },
    {
      title: 'Prepare the workshop pack',
      route: 'Governance + evidence + action register',
      outcome: 'Walk into the workshop with the right evidence, gaps, owners, and support asks across the ten assessment areas.',
      creates: ['evidence register', 'document pack', 'risk and blocker board', 'owner table'],
      evidence: ['financial summary', 'strategy docs', 'governance docs', 'team roles', 'grant drafts'],
      primary: { label: 'Document pack', href: '#document-pack' },
      secondary: { label: 'Ten areas', href: '#workshop-areas' },
    },
  ];

  const liveSurfaces = [
    {
      label: 'Org dashboard',
      href: `/org/${slug}`,
      detail: 'Calm top-level operating view, project lanes, workshop alignment, and wiki support index.',
    },
    {
      label: 'Goods workspace',
      href: `/org/${slug}/goods`,
      detail: 'Goods evidence, procurement routes, foundation moves, grant fit, and capital readiness.',
    },
    {
      label: 'CivicGraph pipeline',
      href: `/org/${slug}/civicgraph#project-pipeline`,
      detail: 'Tracked opportunities, time-sensitive work, best matches, and pipeline decisions.',
    },
    {
      label: 'Grant finder',
      href: '/grants?type=open_opportunity&sort=closing_asc',
      detail: 'Open opportunities across the expanded public-source grant frontier.',
    },
    {
      label: 'Contacts and GHL',
      href: `/org/${slug}/contacts`,
      detail: 'Funder, partner, governance, advocacy, and CRM follow-up surface.',
    },
    {
      label: 'Capture notes',
      href: '/start',
      detail: 'Capture workshop notes or ideas, then tag them back to project lanes and next actions.',
    },
  ];

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">
              {profile.name}
            </Link>
            <span>/</span>
            <span className="text-white">Workshop operating board</span>
          </nav>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-bauhaus-red">ACT shared service system</p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black uppercase tracking-wider">
                Turn the wiki into fundable work
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">
                This page has one job: help you decide what to do next. Pick an output, pull the proof from the ACT wiki
                and project systems, then turn it into a grant section, foundation brief, procurement offer, board note,
                or GHL follow-up.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href={`/org/${slug}`}
                className="border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
              >
                Back to dashboard
              </Link>
              <Link
                href="/start"
                className="border border-bauhaus-red bg-bauhaus-red px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
              >
                Capture notes
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <section className="border-4 border-bauhaus-black bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="border-b-4 border-bauhaus-black p-5 lg:border-b-0 lg:border-r-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Start here</p>
              <h2 className="mt-2 text-2xl font-black text-bauhaus-black">Do not read this top to bottom</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">
                The ten questions are the assessment frame. The useful work is choosing the next output and making the
                evidence usable across grants, foundations, procurement, capital, governance, and CRM follow-up.
              </p>
              <div className="mt-5 space-y-2">
                {RUN_STEPS.map((step, index) => (
                  <div key={step.label} className="border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-bauhaus-black text-[10px] font-black text-white">
                        {index + 1}
                      </span>
                      <div>
                        <div className="text-sm font-black text-bauhaus-black">{step.label}</div>
                        <p className="mt-1 text-xs leading-relaxed text-gray-600">{step.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-2">
              {operatingMoves.map((move) => (
                <article key={move.title} className="flex min-h-[280px] flex-col border border-gray-200 bg-gray-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{move.route}</div>
                  <h3 className="mt-2 text-lg font-black text-bauhaus-black">{move.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-gray-700">{move.outcome}</p>

                  <div className="mt-4 grid gap-3 text-xs leading-relaxed text-gray-600 sm:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Creates</div>
                      <ul className="mt-1 space-y-1">
                        {move.creates.map((item) => (
                          <li key={`${move.title}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Pull proof</div>
                      <ul className="mt-1 space-y-1">
                        {move.evidence.map((item) => (
                          <li key={`${move.title}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Link
                      href={move.primary.href}
                      className="border border-bauhaus-black bg-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-red"
                    >
                      {move.primary.label}
                    </Link>
                    <Link
                      href={move.secondary.href}
                      className="border border-gray-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
                    >
                      {move.secondary.label}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Live surfaces</p>
              <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Where the work actually happens</h2>
            </div>
            <a
              href="#workshop-areas"
              className="w-fit border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
            >
              Open assessment frame
            </a>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {liveSurfaces.map((surface) => (
              <Link
                key={surface.label}
                href={surface.href}
                className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
              >
                <div className="text-sm font-black text-bauhaus-black">{surface.label}</div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">{surface.detail}</p>
              </Link>
            ))}
          </div>
        </section>

        <nav className="sticky top-0 z-20 mt-6 border-4 border-bauhaus-black bg-white/95 p-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Jump to</span>
            <a
              href="#document-pack"
              className="border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:border-bauhaus-blue hover:bg-link-light hover:text-bauhaus-blue"
            >
              Document pack
            </a>
            <a
              href="#project-tags"
              className="border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:border-bauhaus-blue hover:bg-link-light hover:text-bauhaus-blue"
            >
              Project tags
            </a>
            <a
              href="#templates"
              className="border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:border-bauhaus-blue hover:bg-link-light hover:text-bauhaus-blue"
            >
              Templates
            </a>
            <a
              href="#source-documents"
              className="border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:border-bauhaus-blue hover:bg-link-light hover:text-bauhaus-blue"
            >
              Sources
            </a>
            {WORKSHOP_AREAS.map((area, index) => (
              <a
                key={area.id}
                href={`#${area.id}`}
                className="border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-bauhaus-black hover:border-bauhaus-blue hover:bg-link-light hover:text-bauhaus-blue"
              >
                {index + 1}
              </a>
            ))}
          </div>
        </nav>

        <section id="document-pack" className="mt-6 scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Document pack</p>
            <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Bring evidence, gaps, and owners</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
              Drafts are useful. The goal is to tag what exists, what is missing, which project owns it, and what output
              it can support next.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {DOCUMENT_PACK.map((doc) => (
              <div key={doc.label} className="border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-black text-bauhaus-black">{doc.label}</div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">{doc.detail}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {doc.areas.map((areaId) => {
                    const area = WORKSHOP_AREAS.find((item) => item.id === areaId);
                    return area ? (
                      <a
                        key={`${doc.label}-${areaId}`}
                        href={`#${areaId}`}
                        className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-blue hover:bg-link-light"
                      >
                        {area.label}
                      </a>
                    ) : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="project-tags" className="mt-6 scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Project tagging map</p>
              <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Every claim needs a project lane</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
                This prevents ACT shared service work from becoming generic. Notes, source documents, opportunities,
                templates, and follow-ups should point back to a lane.
              </p>
            </div>
            <Link
              href={`/org/${slug}#projects`}
              className="w-fit border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
            >
              Project dashboard
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {wikiSupportIndex.projects.slice(0, 12).map((project) => (
              <Link
                key={project.slug}
                href={`/org/${slug}/${project.slug}`}
                className="border border-gray-200 bg-gray-50 p-4 hover:border-bauhaus-blue hover:bg-link-light/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-bauhaus-black">{project.name}</span>
                  {project.code ? (
                    <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                      {project.code}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-600">{project.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.routes.slice(0, 4).map((route) => (
                    <span
                      key={`${project.slug}-${route.type}`}
                      className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500"
                    >
                      {route.type}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section id="templates" className="mt-6 scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Reusable outputs</p>
            <h2 className="mt-1 text-2xl font-black text-bauhaus-black">What this page should produce</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
              These are the actual assets to make from the wiki. Each one should have a project tag, evidence source,
              owner, and next action.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {WORKSHOP_TEMPLATES.map((template) => (
              <div key={template.title} className="border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-black text-bauhaus-black">{template.title}</div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">{template.use}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {template.sections.map((section) => (
                    <span
                      key={`${template.title}-${section}`}
                      className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500"
                    >
                      {section}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="workshop-areas" className="mt-6 scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Assessment frame</p>
            <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Ten workshop questions</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
              Open these when you need the workshop lens. They are not the work queue; they are the structure for
              deciding what evidence and support each output needs.
            </p>
          </div>

          <div className="space-y-3">
            {WORKSHOP_AREAS.map((area, index) => {
              const sources = getWorkshopSourceDocuments(wikiSupportIndex, area.sourceRoles);
              const taggedProjects = area.projectSlugs
                .map((projectSlug) => projectsBySlug.get(projectSlug))
                .filter((project): project is (typeof wikiSupportIndex.projects)[number] => Boolean(project));

              return (
                <details
                  key={area.id}
                  id={area.id}
                  open={index === 0}
                  className="scroll-mt-28 border border-gray-200 bg-gray-50 open:bg-white"
                >
                  <summary className="cursor-pointer list-none px-4 py-4 hover:bg-link-light/40">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                          Area {index + 1}
                        </div>
                        <h3 className="mt-1 text-lg font-black text-bauhaus-black">{area.label}</h3>
                        <p className="mt-1 max-w-4xl text-xs leading-relaxed text-gray-600">{area.question}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                          {taggedProjects.length} project tags
                        </span>
                        <span className="bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
                          {sources.length} source docs
                        </span>
                      </div>
                    </div>
                  </summary>

                  <div className="grid gap-4 border-t border-gray-200 p-4 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-4">
                      <div className="border-l-4 border-bauhaus-blue bg-link-light/40 p-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                          Shared service strength
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-bauhaus-black">{area.sharedStrength}</p>
                      </div>
                      <div className="border border-gray-200 bg-gray-50 p-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                          Next decision
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-gray-700">{area.nextAction}</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="border border-gray-200 bg-white p-4">
                          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                            Templates
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {area.templates.map((template) => (
                              <a
                                key={template}
                                href="#templates"
                                className="bg-gray-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-gray-600 hover:bg-bauhaus-canvas"
                              >
                                {template}
                              </a>
                            ))}
                          </div>
                        </div>
                        <div className="border border-gray-200 bg-white p-4">
                          <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                            Project tags
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {taggedProjects.map((project) => (
                              <Link
                                key={project.slug}
                                href={`/org/${slug}/${project.slug}`}
                                className="bg-gray-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-blue hover:bg-link-light"
                              >
                                {project.code ? `${project.code} ` : ''}
                                {project.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border border-gray-200 bg-white p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                        Source documents
                      </div>
                      <div className="mt-3 space-y-3">
                        {sources.length > 0 ? (
                          sources.map((source) => (
                            <div key={`${area.id}-${source.path}`} className="border border-gray-200 bg-gray-50 p-3">
                              <Link
                                href={`/org/${slug}/wiki/sources/${wikiSupportSourceSlug(source)}`}
                                className="text-sm font-black text-bauhaus-blue hover:underline"
                              >
                                {source.label}
                              </Link>
                              <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-blue">
                                {source.role}
                              </div>
                              <div className="mt-2 break-all font-mono text-[11px] leading-relaxed text-gray-500">
                                {sourcePathLabel(source.path)}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm leading-relaxed text-gray-600">
                            No source role is tagged yet. Add one in the wiki support index so this area has durable
                            proof.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <section id="source-documents" className="mt-6 scroll-mt-28 border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Source wiki documents</p>
            <h2 className="mt-1 text-2xl font-black text-bauhaus-black">Current source inventory</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
              These are the source documents currently feeding the support index. The next useful step is to tag precise
              facts, claims, examples, and reusable wording back to project lanes.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {sourceInventory.map((source) => (
              <div key={source.path} className="border border-gray-200 bg-gray-50 p-3">
                <Link
                  href={`/org/${slug}/wiki/sources/${wikiSupportSourceSlug(source)}`}
                  className="text-sm font-black text-bauhaus-blue hover:underline"
                >
                  {source.label}
                </Link>
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                  <span>{source.role}</span>
                  <span>{source.lines} lines</span>
                </div>
                <div className="mt-2 break-all font-mono text-[11px] leading-relaxed text-gray-500">
                  {sourcePathLabel(source.path)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
