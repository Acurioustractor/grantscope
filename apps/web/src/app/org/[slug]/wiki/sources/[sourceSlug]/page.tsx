import fs from 'node:fs/promises';
import path from 'node:path';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { goodsSourceDocuments } from '@/lib/services/goods-operating-system';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  getWikiSupportIndex,
  getWikiSupportSourceBySlug,
} from '@/lib/services/wiki-support-index';

export const revalidate = 3600;

type Heading = {
  id: string;
  title: string;
  level: number;
  line: number;
};

function sourcePathLabel(sourcePath: string) {
  return sourcePath
    .replace('/Users/benknight/Code/', '')
    .replace(/^act-global-infrastructure\//, 'act-global-infrastructure / ')
    .replace(/^Goods Asset Register\//, 'Goods Asset Register / ');
}

function anchorSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function parseMarkdownHeadings(content: string): Heading[] {
  const seen = new Map<string, number>();
  return content
    .split(/\r?\n/)
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (!match) return null;
      const base = anchorSlug(match[2]);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return {
        id: count > 0 ? `${base}-${count + 1}` : base,
        title: match[2],
        level: match[1].length,
        line: index,
      };
    })
    .filter((heading): heading is Heading => Boolean(heading));
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^>\s*/, '')
    .trim();
}

function isMarkdownTableDivider(line: string) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function splitMarkdownTableLine(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cleanInlineMarkdown(cell.trim()));
}

function renderTable(lines: string[], key: string) {
  const tableLines = lines.filter((line) => !isMarkdownTableDivider(line));
  const [headerLine, ...rowLines] = tableLines;
  const headers = splitMarkdownTableLine(headerLine ?? '').slice(0, 6);
  const rows = rowLines.slice(0, 8).map((line) => splitMarkdownTableLine(line).slice(0, headers.length || 6));

  if (headers.length === 0) return null;

  return (
    <div key={key} className="overflow-auto border border-gray-200 bg-white">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header, index) => (
              <th key={`${key}-head-${index}`} className="border-b border-gray-200 px-3 py-2 font-black text-bauhaus-black">
                {header || `Column ${index + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${key}-row-${rowIndex}`} className="border-b border-gray-100 last:border-b-0">
              {headers.map((_, cellIndex) => (
                <td key={`${key}-row-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top text-gray-700">
                  {row[cellIndex] || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rowLines.length > rows.length ? (
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
          Showing first {rows.length} rows
        </div>
      ) : null}
    </div>
  );
}

function renderReadableMarkdown(body: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const lines = body.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        if (lines[index].trim()) codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      if (codeLines.length > 0) {
        nodes.push(
          <pre
            key={`${keyPrefix}-code-${index}`}
            className="max-h-72 overflow-auto border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-700"
          >
            {codeLines.join('\n')}
          </pre>,
        );
      }
      continue;
    }

    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        tableLines.push(lines[index]);
        index += 1;
      }
      const table = renderTable(tableLines, `${keyPrefix}-table-${index}`);
      if (table) nodes.push(table);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(cleanInlineMarkdown(lines[index].trim().replace(/^[-*]\s+/, '')));
        index += 1;
      }
      nodes.push(
        <ul key={`${keyPrefix}-ul-${index}`} className="space-y-2 text-sm leading-relaxed text-gray-700">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ul-${index}-${itemIndex}`} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-bauhaus-blue" />
              <span>{item}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(cleanInlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/, '')));
        index += 1;
      }
      nodes.push(
        <ol key={`${keyPrefix}-ol-${index}`} className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gray-700">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ol-${index}-${itemIndex}`}>{item}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith('|') &&
      !lines[index].trim().startsWith('```') &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    const paragraph = cleanInlineMarkdown(paragraphLines.join(' '));
    if (paragraph) {
      nodes.push(
        <p key={`${keyPrefix}-p-${index}`} className="text-sm leading-relaxed text-gray-700">
          {paragraph}
        </p>,
      );
    }
  }

  return nodes.length > 0 ? nodes : [
    <p key={`${keyPrefix}-empty`} className="text-sm leading-relaxed text-gray-600">
      No readable body text under this heading yet.
    </p>,
  ];
}

function splitCsvLine(line: string) {
  return line
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((cell) => cell.replace(/^"|"$/g, '').trim());
}

function renderCsvPreview(content: string) {
  const rows = content.split(/\r?\n/).filter(Boolean).slice(0, 13).map(splitCsvLine);
  const [headers = [], ...bodyRows] = rows;
  const visibleHeaders = headers.slice(0, 8);

  return (
    <section className="border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Data preview</div>
      <h2 className="mt-1 text-xl font-black text-bauhaus-black">First rows from the source table</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        This is a preview for orientation. Use it to see the fields and shape of the evidence before opening the source file.
      </p>
      <div className="mt-4 overflow-auto border border-gray-200">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="bg-gray-50">
            <tr>
              {visibleHeaders.map((header, index) => (
                <th key={`${header}-${index}`} className="border-b border-gray-200 px-3 py-2 font-black text-bauhaus-black">
                  {header || `Column ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rowIndex) => (
              <tr key={`csv-row-${rowIndex}`} className="border-b border-gray-100 last:border-b-0">
                {visibleHeaders.map((_, cellIndex) => (
                  <td key={`csv-row-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top text-gray-700">
                    {row[cellIndex] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderJsonPreview(content: string) {
  try {
    const parsed = JSON.parse(content) as unknown;
    const entries = Array.isArray(parsed)
      ? parsed.slice(0, 12).map((value, index) => [`Item ${index + 1}`, value] as const)
      : Object.entries((parsed ?? {}) as Record<string, unknown>).slice(0, 24);

    return (
      <section className="border border-gray-200 bg-white p-5 shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Structured preview</div>
        <h2 className="mt-1 text-xl font-black text-bauhaus-black">Top-level structure</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {entries.map(([key, value]) => {
            const valueType = Array.isArray(value)
              ? `${value.length} items`
              : value && typeof value === 'object'
                ? `${Object.keys(value as Record<string, unknown>).length} fields`
                : String(value ?? '');
            return (
              <div key={key} className="border border-gray-200 bg-gray-50 p-3">
                <div className="text-sm font-black text-bauhaus-black">{key}</div>
                <div className="mt-1 text-xs leading-relaxed text-gray-600">{valueType}</div>
              </div>
            );
          })}
        </div>
      </section>
    );
  } catch {
    return null;
  }
}

function sourceActionLinks(slug: string) {
  return [
    {
      label: 'Use in Goods OS',
      href: `/org/${slug}/wiki/goods-operating-system#sources`,
      detail: 'Return to the packaged evidence library and route model.',
    },
    {
      label: 'Work grant feed',
      href: '/grants?type=open_opportunity&sort=closing_asc&project=goods&quality=ready',
      detail: 'Use this source against live Goods-matched opportunities.',
    },
    {
      label: 'Open Goods workspace',
      href: `/org/${slug}/goods#goods-readiness`,
      detail: 'Move from proof into the calm project operating surface.',
    },
    {
      label: 'Open contacts',
      href: `/org/${slug}/contacts`,
      detail: 'Turn the evidence into a funder, buyer, partner, or advisor follow-up.',
    },
  ];
}

function isPathInsideRoot(filePath: string, rootPath: string) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(filePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function readIndexedSourceFile(sourcePath: string, roots: string[]) {
  if (!roots.some((root) => isPathInsideRoot(sourcePath, root))) return null;
  try {
    return await fs.readFile(sourcePath, 'utf8');
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; sourceSlug: string }>;
}) {
  const { sourceSlug } = await params;
  const source = getWikiSupportSourceBySlug(sourceSlug);
  return {
    title: source ? `${source.label} - Wiki Source - CivicGraph` : 'Wiki Source - CivicGraph',
    description: 'Indexed ACT and Goods wiki source document with headers, linked project lanes, and source context.',
  };
}

export default async function WikiSourcePage({
  params,
}: {
  params: Promise<{ slug: string; sourceSlug: string }>;
}) {
  const { slug, sourceSlug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug)
    ? ACT_FAST_PROFILE
    : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const wikiSupportIndex = getWikiSupportIndex();
  const source = getWikiSupportSourceBySlug(sourceSlug);
  if (!source || !source.exists) notFound();
  const sourceGuide = goodsSourceDocuments.find((doc) => doc.source === source.label);
  const actionLinks = sourceActionLinks(slug);

  const sourceContent = await readIndexedSourceFile(source.path, Object.values(wikiSupportIndex.source_roots));
  if (sourceContent === null) notFound();

  const lines = sourceContent.split(/\r?\n/);
  const headings = parseMarkdownHeadings(sourceContent);
  const linkedProjects = wikiSupportIndex.projects.filter((project) => {
    const projectSourcePaths = [
      ...project.source_documents.map((doc) => doc.path),
      ...project.routes.flatMap((route) => route.source_documents.map((doc) => doc.path)),
      ...project.support_actions.flatMap((action) => action.source_documents.map((doc) => doc.path)),
    ];
    return projectSourcePaths.includes(source.path);
  });
  const sections = headings.map((heading, index) => {
    const nextHeading = headings[index + 1];
    const body = lines.slice(heading.line + 1, nextHeading ? nextHeading.line : lines.length).join('\n').trim();
    return { heading, body };
  });

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">
              {profile.name}
            </Link>
            <span>/</span>
            <Link href={`/org/${slug}/wiki/workshop-alignment`} className="hover:text-white">
              Workshop operating board
            </Link>
            <span>/</span>
            <span className="text-white">{source.label}</span>
          </nav>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-bauhaus-red">Evidence source</p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black uppercase tracking-wider">{source.label}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">
                {sourceGuide?.use ?? 'This source is indexed so claims, evidence, and reusable operating language can be checked before they are used.'}
              </p>
            </div>
            <Link
              href={`/org/${slug}/wiki/workshop-alignment#source-documents`}
              className="w-fit border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
            >
              Back to sources
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {sourceGuide ? (
            <section className="border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">What this is for</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="bg-gray-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                  {sourceGuide.kind}
                </span>
                <span className="bg-gray-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {sourceGuide.output}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-gray-700">{sourceGuide.use}</p>
              <p className="mt-3 text-xs leading-relaxed text-bauhaus-black">
                <span className="font-black">Best use:</span> {sourceGuide.bestFor}
              </p>
            </section>
          ) : null}

          <section className="border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Turn this into</p>
            <div className="mt-3 space-y-2">
              {actionLinks.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="block border border-gray-200 bg-gray-50 p-3 hover:border-bauhaus-blue hover:bg-link-light/40"
                >
                  <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black">{action.label}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-600">{action.detail}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">Source context</p>
            <dl className="mt-3 space-y-3 text-xs leading-relaxed text-gray-600">
              <div>
                <dt className="font-black uppercase tracking-wider text-gray-500">Role</dt>
                <dd className="mt-1">{source.role}</dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-wider text-gray-500">Size</dt>
                <dd className="mt-1">{source.lines} lines</dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-wider text-gray-500">Path</dt>
                <dd className="mt-1 break-all font-mono text-[11px]">{sourcePathLabel(source.path)}</dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-wider text-gray-500">Linked projects</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {linkedProjects.length > 0 ? (
                    linkedProjects.map((project) => (
                      <Link
                        key={project.slug}
                        href={`/org/${slug}/${project.slug}`}
                        className="bg-gray-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-blue hover:bg-link-light"
                      >
                        {project.code ? `${project.code} ` : ''}
                        {project.name}
                      </Link>
                    ))
                  ) : (
                    <span>No project tags yet</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Headers</p>
            {headings.length > 0 ? (
              <nav className="mt-3 max-h-[60vh] space-y-1 overflow-auto pr-1">
                {headings.map((heading) => (
                  <a
                    key={heading.id}
                    href={`#${heading.id}`}
                    className="block border border-gray-100 bg-gray-50 px-2 py-1 text-[11px] leading-relaxed text-gray-700 hover:border-bauhaus-blue hover:bg-link-light"
                    style={{ marginLeft: `${Math.max(0, heading.level - 1) * 8}px` }}
                  >
                    {heading.title}
                  </a>
                ))}
              </nav>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-gray-600">
                This source is structured data, so a preview is shown instead of a markdown outline.
              </p>
            )}
          </section>
        </aside>

        <div className="space-y-4">
          {sections.length > 0 ? (
            sections.map(({ heading, body }) => (
              <section key={heading.id} id={heading.id} className="scroll-mt-6 border border-gray-200 bg-white p-5 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                  Line {heading.line + 1}
                </div>
                <h2 className="mt-1 text-xl font-black text-bauhaus-black">{heading.title}</h2>
                <div className="mt-4 space-y-4">
                  {renderReadableMarkdown(body, heading.id)}
                </div>
              </section>
            ))
          ) : source.path.endsWith('.csv') ? (
            renderCsvPreview(sourceContent)
          ) : source.path.endsWith('.json') ? (
            renderJsonPreview(sourceContent)
          ) : (
            <section className="border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Readable source</div>
              <h2 className="mt-1 text-xl font-black text-bauhaus-black">{source.label}</h2>
              <div className="mt-4 space-y-4">
                {renderReadableMarkdown(sourceContent, 'source')}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
