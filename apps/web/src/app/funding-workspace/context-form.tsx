'use client';

import { useState } from 'react';

type ProjectOption = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  metadata?: Record<string, unknown> | null;
};

const STATE_OPTIONS = [
  'National',
  'Queensland',
  'New South Wales',
  'Victoria',
  'Western Australia',
  'South Australia',
  'Tasmania',
  'Australian Capital Territory',
  'Northern Territory',
];

const ORG_TYPE_OPTIONS = [
  'ORIC',
  'Charity',
  'Social enterprise',
  'Community group',
];

function buildProjectMission(project: ProjectOption | null) {
  if (!project) return '';
  const profileSummary =
    typeof project.metadata?.profile_summary === 'string' ? project.metadata.profile_summary.trim() : '';
  const fundingBrief =
    typeof project.metadata?.funding_brief === 'string' ? project.metadata.funding_brief.trim() : '';
  return profileSummary || fundingBrief || [project.name, project.description].filter(Boolean).join('. ').trim();
}

export function FundingWorkspaceContextForm({
  initialMission,
  rawMission,
  initialState,
  initialOrgType,
  profileMission,
  projects,
  selectedProjectSlug,
}: {
  initialMission: string;
  rawMission: string;
  initialState: string;
  initialOrgType: string;
  profileMission: string;
  projects: ProjectOption[];
  selectedProjectSlug: string;
}) {
  const projectOptions = projects.filter((project): project is ProjectOption & { slug: string } => Boolean(project.slug));
  const projectMissionMap = Object.fromEntries(
    projectOptions.map((project) => [project.slug, buildProjectMission(project)])
  ) as Record<string, string>;

  const initialAutoMission = selectedProjectSlug
    ? projectMissionMap[selectedProjectSlug] || profileMission
    : profileMission;

  const [projectValue, setProjectValue] = useState(selectedProjectSlug);
  const [missionValue, setMissionValue] = useState(initialMission);
  const [stateValue, setStateValue] = useState(initialState);
  const [orgTypeValue, setOrgTypeValue] = useState(initialOrgType);
  const [lastAutoMission, setLastAutoMission] = useState(initialAutoMission);
  const [missionDirty, setMissionDirty] = useState(
    Boolean(rawMission) &&
      rawMission !== initialAutoMission &&
      rawMission !== profileMission
  );

  function handleProjectChange(nextProjectSlug: string) {
    const nextAutoMission = nextProjectSlug ? projectMissionMap[nextProjectSlug] || profileMission : profileMission;
    const shouldSyncMission =
      !missionDirty ||
      missionValue === lastAutoMission ||
      missionValue === profileMission;

    setProjectValue(nextProjectSlug);
    setLastAutoMission(nextAutoMission);

    if (shouldSyncMission) {
      setMissionValue(nextAutoMission);
      setMissionDirty(false);
    }
  }

  return (
    <form className="mt-8 grid gap-4 border-2 border-bauhaus-black bg-bauhaus-canvas p-4 md:grid-cols-[minmax(0,2.2fr)_220px_220px_auto] md:items-end">
      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Mission or project</span>
        <input
          type="text"
          name="mission"
          value={missionValue}
          onChange={(event) => {
            setMissionValue(event.target.value);
            setMissionDirty(true);
          }}
          placeholder="Youth justice on Country, community manufacturing, Indigenous health..."
          className="mt-2 w-full border-2 border-bauhaus-black bg-white px-4 py-3 text-sm font-medium text-bauhaus-black outline-none placeholder:text-bauhaus-muted"
        />
      </label>

      {projectOptions.length > 0 ? (
        <label className="block md:col-span-3">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Project context</span>
          <select
            name="project"
            value={projectValue}
            onChange={(event) => handleProjectChange(event.target.value)}
            className="mt-2 w-full border-2 border-bauhaus-black bg-white px-4 py-3 text-sm font-medium text-bauhaus-black outline-none"
          >
            <option value="">Whole organisation</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.slug}>
                {project.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] font-medium text-bauhaus-muted">
            Changing project updates the brief automatically unless you have already edited the mission text yourself.
          </p>
        </label>
      ) : null}

      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">State</span>
        <select
          name="state"
          value={stateValue}
          onChange={(event) => setStateValue(event.target.value)}
          className="mt-2 w-full border-2 border-bauhaus-black bg-white px-4 py-3 text-sm font-medium text-bauhaus-black outline-none"
        >
          <option value="">Anywhere in Australia</option>
          {STATE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-bauhaus-muted">Organisation type</span>
        <select
          name="org_type"
          value={orgTypeValue}
          onChange={(event) => setOrgTypeValue(event.target.value)}
          className="mt-2 w-full border-2 border-bauhaus-black bg-white px-4 py-3 text-sm font-medium text-bauhaus-black outline-none"
        >
          <option value="">Any organisation type</option>
          {ORG_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="border-2 border-bauhaus-red bg-bauhaus-red px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-bauhaus-red"
      >
        Find matches
      </button>
    </form>
  );
}
