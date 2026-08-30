'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ApplicantEntitySummary {
  id: string;
  name: string;
  verificationStatus: string;
  dgrStatus: string;
}

interface ApplicantProjectSummary {
  code: string;
  name: string;
}

async function postApplicantAction(body: Record<string, unknown>) {
  const response = await fetch('/api/ops/funding/applicants', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { error?: string; assigned?: number; routeStatus?: string; entity?: { name?: string } };
  if (!response.ok) throw new Error(payload.error || 'Applicant registry update failed');
  return payload;
}

export function ApplicantRegistryManager({ entities, projects }: { entities: ApplicantEntitySummary[]; projects: ApplicantProjectSummary[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createEntity(formData: FormData) {
    setPending(true); setMessage(null);
    try {
      const payload = await postApplicantAction({
        action: 'create_entity',
        name: String(formData.get('name') || ''),
        entityType: String(formData.get('entityType') || ''),
        status: String(formData.get('status') || ''),
        abn: String(formData.get('abn') || ''),
        acn: String(formData.get('acn') || ''),
        dgrStatus: String(formData.get('dgrStatus') || 'unknown'),
        verificationSource: String(formData.get('verificationSource') || ''),
        notes: String(formData.get('notes') || ''),
      });
      setMessage(`${payload.entity?.name || 'Applicant entity'} added. Assign it to projects in the batch route form.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Applicant entity failed');
    } finally {
      setPending(false);
    }
  }

  async function assignRoutes(formData: FormData) {
    setPending(true); setMessage(null);
    try {
      const allProjects = formData.get('allProjects') === 'yes';
      const projectCodes = allProjects
        ? projects.map(project => project.code)
        : formData.getAll('projectCodes').map(String);
      const payload = await postApplicantAction({
        action: 'assign_routes',
        applicantEntityId: String(formData.get('applicantEntityId') || ''),
        routeType: String(formData.get('routeType') || ''),
        projectCodes,
        rationale: String(formData.get('rationale') || ''),
      });
      setMessage(`${payload.assigned || 0} project routes assigned as ${payload.routeStatus || 'review required'}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Applicant routes failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="border-t border-[#dbe4df] bg-[#f8fafc]">
      <summary className="min-h-11 cursor-pointer list-none px-5 py-4 text-xs font-black uppercase tracking-wide text-[#183426]">Add an entity or batch-assign routes</summary>
      <div className="grid gap-5 border-t border-[#dbe4df] p-5 lg:grid-cols-2">
        <form action={createEntity} className="grid gap-3 rounded-lg border border-[#dbe4df] bg-white p-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><h3 className="font-black">1. Register an applicant entity</h3><p className="mt-1 text-xs text-[#64748b]">Identity is verified against the entity graph. DGR assertions require a public evidence URL.</p></div>
          <label className="text-xs font-semibold sm:col-span-2">Entity name<input name="name" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] px-3" /></label>
          <label className="text-xs font-semibold">Entity type<select name="entityType" defaultValue="charity" className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3"><option value="charity">Charity</option><option value="company">Company</option><option value="auspice">Auspice</option><option value="pending_company">Pending company</option><option value="other">Other</option></select></label>
          <label className="text-xs font-semibold">Status<select name="status" defaultValue="active" className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3"><option value="active">Active</option><option value="pending">Pending</option></select></label>
          <label className="text-xs font-semibold">ABN<input name="abn" inputMode="numeric" placeholder="11 digits" className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] px-3" /></label>
          <label className="text-xs font-semibold">ACN<input name="acn" inputMode="numeric" placeholder="9 digits" className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] px-3" /></label>
          <label className="text-xs font-semibold">DGR status<select name="dgrStatus" defaultValue="unknown" className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3"><option value="unknown">Unknown</option><option value="endorsed">Endorsed</option><option value="not_endorsed">Not endorsed</option></select></label>
          <label className="text-xs font-semibold">Evidence URL<input name="verificationSource" type="url" placeholder="Required for DGR assertion" className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] px-3" /></label>
          <label className="text-xs font-semibold sm:col-span-2">Notes<input name="notes" className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] px-3" /></label>
          <button disabled={pending} className="min-h-11 rounded bg-[#183426] px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-50 sm:col-span-2">Add entity</button>
        </form>

        <form action={assignRoutes} className="grid gap-3 rounded-lg border border-[#dbe4df] bg-white p-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><h3 className="font-black">2. Assign one route across projects</h3><p className="mt-1 text-xs text-[#64748b]">This adds an alternate route. It never silently replaces the canonical default.</p></div>
          <label className="text-xs font-semibold sm:col-span-2">Applicant entity<select name="applicantEntityId" required className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3">{entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name} · {entity.verificationStatus} · DGR {entity.dgrStatus}</option>)}</select></label>
          <label className="text-xs font-semibold">Route type<select name="routeType" defaultValue="charity" className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] bg-white px-3"><option value="charity">Charity</option><option value="dgr">DGR</option><option value="auspice">Auspice</option><option value="partner">Partner</option><option value="direct">Direct</option><option value="commercial">Commercial</option></select></label>
          <label className="flex min-h-11 items-center gap-2 text-xs font-semibold"><input type="checkbox" name="allProjects" value="yes" className="h-5 w-5" />Assign to all active projects</label>
          <fieldset className="grid max-h-44 gap-2 overflow-y-auto rounded border border-[#cbd5e1] p-3 sm:col-span-2"><legend className="px-1 text-xs font-semibold">Or select projects</legend>{projects.map(project => <label key={project.code} className="flex items-center gap-2 text-xs"><input type="checkbox" name="projectCodes" value={project.code} className="h-4 w-4" /><span className="font-mono text-[10px]">{project.code}</span><span>{project.name}</span></label>)}</fieldset>
          <label className="text-xs font-semibold sm:col-span-2">Route rationale<input name="rationale" placeholder="Why this entity may apply for these projects" className="mt-1 min-h-11 w-full rounded border border-[#94a3b8] px-3" /></label>
          <button disabled={pending || !entities.length} className="min-h-11 rounded bg-[#183426] px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-50 sm:col-span-2">Assign routes</button>
        </form>
        {message ? <p role="status" className="rounded bg-[#eef6f1] p-3 text-xs text-[#183426] lg:col-span-2">{message}</p> : null}
      </div>
    </details>
  );
}
