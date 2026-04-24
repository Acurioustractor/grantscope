import Link from 'next/link';
import type { OrgProjectSummary } from '@/lib/services/org-dashboard-service';
import { money } from '@/lib/services/org-dashboard-service';

const CATEGORY_COLORS: Record<string, string> = {
  community: 'bg-amber-50 text-amber-800 border-amber-300',
  justice: 'bg-orange-50 text-orange-700 border-orange-200',
  enterprise: 'bg-teal-50 text-teal-700 border-teal-200',
  regenerative: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  technology: 'bg-blue-50 text-blue-700 border-blue-200',
  cultural: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  research: 'bg-purple-50 text-purple-700 border-purple-200',
  education: 'bg-amber-50 text-amber-700 border-amber-200',
  health: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  advocacy: 'bg-red-50 text-red-700 border-red-200',
};

const TIER_STYLES: Record<string, string> = {
  major: 'border-bauhaus-red',
  sub: 'border-bauhaus-blue',
  micro: 'border-gray-300',
};

export function ProjectCards({
  projects,
  orgSlug,
  parentSlug,
}: {
  projects: OrgProjectSummary[];
  orgSlug: string;
  parentSlug?: string;
}) {
  if (projects.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {projects.map((project) => {
        const href = parentSlug
          ? `/org/${orgSlug}/${parentSlug}/${project.slug}`
          : `/org/${orgSlug}/${project.slug}`;

        return (
          <Link
            key={project.id}
            href={href}
            className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden hover:shadow-md hover:border-bauhaus-black transition-all group"
          >
            <div className={`border-l-4 ${TIER_STYLES[project.tier] ?? 'border-gray-300'} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  {project.code && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">
                      {project.code}
                    </span>
                  )}
                  <h3 className="font-black text-base leading-tight group-hover:text-bauhaus-red transition-colors">
                    {project.name}
                  </h3>
                </div>
                <span className="text-gray-300 group-hover:text-bauhaus-red transition-colors text-lg leading-none">
                  &rarr;
                </span>
              </div>

              {project.description && (
                <p className="mt-2 text-sm leading-relaxed text-gray-500 line-clamp-2">{project.description}</p>
              )}

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {project.category && (
                  <span className={`text-[10px] px-2 py-0.5 font-bold border rounded-sm ${CATEGORY_COLORS[project.category] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {project.category}
                  </span>
                )}
                {project.status !== 'active' && (
                  <span className="text-[10px] px-2 py-0.5 font-bold border rounded-sm bg-yellow-50 text-yellow-700 border-yellow-200 uppercase">
                    {project.status}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
                {project.program_count > 0 && (
                  <span>{project.program_count} program{project.program_count !== 1 ? 's' : ''}</span>
                )}
                {project.pipeline_count > 0 && (
                  <span>{project.pipeline_count} pipeline</span>
                )}
                {project.pipeline_value > 0 && (
                  <span className="font-mono font-bold text-green-600">{money(project.pipeline_value)}</span>
                )}
                {project.children.length > 0 && (
                  <span>{project.children.length} sub-project{project.children.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
