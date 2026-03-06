'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface TeamMember {
  id: string;
  user_id: string | null;
  invited_email: string | null;
  email: string | null;
  role: string;
  invited_at: string | null;
  accepted_at: string | null;
}

interface ClaimedCharity {
  id: string;
  abn: string;
  status: string;
  organisation_name: string | null;
  created_at: string;
}

const DOMAIN_OPTIONS = [
  'indigenous', 'youth', 'education', 'environment', 'health',
  'disability', 'housing', 'arts', 'community', 'justice',
  'agriculture', 'technology', 'social enterprise', 'women',
  'mental health', 'aged care', 'sport', 'multicultural',
];

const GEO_OPTIONS = [
  'national', 'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt',
  'rural', 'remote', 'urban', 'regional',
];

const ORG_TYPES = [
  { value: 'charity', label: 'Registered Charity' },
  { value: 'nfp', label: 'Not-for-Profit' },
  { value: 'social_enterprise', label: 'Social Enterprise' },
  { value: 'startup', label: 'Startup' },
  { value: 'government', label: 'Government' },
  { value: 'university', label: 'University / Research' },
];

interface Project {
  name: string;
  description: string;
  status: string;
}

interface OrgProfile {
  id?: string;
  name: string;
  mission: string;
  description: string;
  abn: string;
  website: string;
  domains: string[];
  geographic_focus: string[];
  org_type: string;
  annual_revenue: string;
  team_size: string;
  projects: Project[];
  notify_email: boolean;
  notify_threshold: number;
}

const EMPTY_PROFILE: OrgProfile = {
  name: '',
  mission: '',
  description: '',
  abn: '',
  website: '',
  domains: [],
  geographic_focus: [],
  org_type: '',
  annual_revenue: '',
  team_size: '',
  projects: [],
  notify_email: true,
  notify_threshold: 0.75,
};

interface MatchedGrant {
  id: string;
  name: string;
  provider: string;
  description: string;
  amount_max: number | null;
  closes_at: string | null;
  categories: string[];
  url: string | null;
  grant_type: string;
  fit_score: number;
}

export function ProfileClient() {
  const [profile, setProfile] = useState<OrgProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState<MatchedGrant[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [savingGrant, setSavingGrant] = useState<string | null>(null);
  const [claims, setClaims] = useState<ClaimedCharity[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setProfile({
            ...EMPTY_PROFILE,
            ...data,
            annual_revenue: data.annual_revenue?.toString() || '',
            team_size: data.team_size?.toString() || '',
            projects: data.projects || [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load claimed charities
    fetch('/api/charities/claim')
      .then(r => r.ok ? r.json() : [])
      .then((data: ClaimedCharity[]) => setClaims(data))
      .catch(() => {});
  }, []);

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true);
    try {
      const r = await fetch('/api/profile/matches?threshold=0.6&limit=50');
      if (r.ok) {
        const data = await r.json();
        setMatches(data.matches || []);
      }
    } catch {
      // ignore
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const r = await fetch('/api/team');
      if (r.ok) {
        const data = await r.json();
        setTeamMembers(data.members || []);
        setCurrentUserRole(data.currentUserRole || null);
      }
    } catch {
      // ignore
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile.id) loadTeam();
  }, [profile.id, loadTeam]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMessage('');
    try {
      const r = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await r.json();
      if (!r.ok) {
        setInviteMessage(data.error || 'Failed to invite');
      } else {
        setInviteMessage(data.message || 'Team member added');
        setInviteEmail('');
        loadTeam();
      }
    } catch {
      setInviteMessage('Failed to invite');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    setRemovingMember(memberId);
    try {
      const r = await fetch('/api/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (r.ok) {
        loadTeam();
      }
    } catch {
      // ignore
    } finally {
      setRemovingMember(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    setSaved(false);

    try {
      const body = {
        ...profile,
        annual_revenue: profile.annual_revenue ? parseFloat(profile.annual_revenue) : null,
        team_size: profile.team_size ? parseInt(profile.team_size, 10) : null,
      };

      const r = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await r.json();
      setProfile(prev => ({ ...prev, id: data.id }));
      setSaved(true);

      // Auto-load matches after save
      loadMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function toggleArray(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
  }

  function addProject() {
    setProfile(prev => ({
      ...prev,
      projects: [...prev.projects, { name: '', description: '', status: 'active' }],
    }));
  }

  function updateProject(index: number, field: keyof Project, value: string) {
    setProfile(prev => ({
      ...prev,
      projects: prev.projects.map((p, i) => i === index ? { ...p, [field]: value } : p),
    }));
  }

  function removeProject(index: number) {
    setProfile(prev => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }));
  }

  async function saveToTracker(grantId: string) {
    setSavingGrant(grantId);
    try {
      await fetch(`/api/tracker/${grantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'discovered', stars: 0, color: 'none' }),
      });
    } catch {
      // ignore
    } finally {
      setSavingGrant(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black uppercase tracking-widest text-bauhaus-muted animate-pulse">
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-bauhaus-black">
          Organisation Profile
        </h1>
        <p className="text-sm text-bauhaus-muted mt-1">
          Describe your organisation to find grants matched to your mission
        </p>
      </div>

      {/* Claimed Charities */}
      {claims.length > 0 && (
        <section className="border-4 border-bauhaus-black bg-white">
          <div className="bg-green-600 px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Claimed Profiles</h2>
            <Link href="/charities/claim" className="text-xs font-black text-white/80 uppercase tracking-widest hover:text-white">
              View All
            </Link>
          </div>
          <div className="divide-y-2 divide-bauhaus-black/10">
            {claims.map(claim => (
              <div key={claim.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-bauhaus-black truncate">
                      {claim.organisation_name || `ABN ${claim.abn}`}
                    </span>
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black ${
                      claim.status === 'verified' ? 'bg-green-500 text-white' :
                      claim.status === 'rejected' ? 'bg-bauhaus-red text-white' :
                      'bg-bauhaus-yellow text-bauhaus-black'
                    }`}>
                      {claim.status}
                    </span>
                  </div>
                  <div className="text-xs text-bauhaus-muted font-medium mt-0.5">ABN {claim.abn}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {claim.status === 'verified' && (
                    <Link
                      href={`/charities/${claim.abn}/edit`}
                      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-bauhaus-red text-white hover:bg-bauhaus-black transition-colors border-2 border-bauhaus-black"
                    >
                      Edit Profile
                    </Link>
                  )}
                  <Link
                    href={`/charities/${claim.abn}`}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-bauhaus-black text-white hover:bg-bauhaus-red transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Profile Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {error && (
          <div className="bg-danger-light border-4 border-bauhaus-red p-3 text-sm font-bold text-bauhaus-red">
            {error}
          </div>
        )}

        {/* Identity */}
        <section className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black px-5 py-3">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Identity</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                Organisation Name *
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                required
                className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                placeholder="A Curious Tractor"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                Mission Statement
              </label>
              <input
                type="text"
                value={profile.mission}
                onChange={e => setProfile(p => ({ ...p, mission: e.target.value }))}
                className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                placeholder="Communities own their narratives, land, and economic futures"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                Description
              </label>
              <textarea
                value={profile.description}
                onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
                rows={4}
                className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue resize-y"
                placeholder="What does your organisation do? What communities do you serve?"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                  ABN
                </label>
                <input
                  type="text"
                  value={profile.abn}
                  onChange={e => setProfile(p => ({ ...p, abn: e.target.value }))}
                  className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                  placeholder="21 591 780 066"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={profile.website}
                  onChange={e => setProfile(p => ({ ...p, website: e.target.value }))}
                  className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                  placeholder="https://act.place"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Focus Areas */}
        <section className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-blue px-5 py-3">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Focus Areas</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-3">
                Domains
              </label>
              <div className="flex flex-wrap gap-2">
                {DOMAIN_OPTIONS.map(domain => (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => setProfile(p => ({ ...p, domains: toggleArray(p.domains, domain) }))}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-3 transition-colors ${
                      profile.domains.includes(domain)
                        ? 'bg-bauhaus-blue text-white border-bauhaus-black'
                        : 'bg-white text-bauhaus-black border-bauhaus-black/30 hover:border-bauhaus-black'
                    }`}
                  >
                    {domain}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-3">
                Geographic Focus
              </label>
              <div className="flex flex-wrap gap-2">
                {GEO_OPTIONS.map(geo => (
                  <button
                    key={geo}
                    type="button"
                    onClick={() => setProfile(p => ({ ...p, geographic_focus: toggleArray(p.geographic_focus, geo) }))}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-3 transition-colors ${
                      profile.geographic_focus.includes(geo)
                        ? 'bg-bauhaus-yellow text-bauhaus-black border-bauhaus-black'
                        : 'bg-white text-bauhaus-black border-bauhaus-black/30 hover:border-bauhaus-black'
                    }`}
                  >
                    {geo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Organisation Details */}
        <section className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-red px-5 py-3">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Details</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                Organisation Type
              </label>
              <select
                value={profile.org_type}
                onChange={e => setProfile(p => ({ ...p, org_type: e.target.value }))}
                className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue bg-white"
              >
                <option value="">Select type</option>
                {ORG_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                  Annual Revenue ($)
                </label>
                <input
                  type="number"
                  value={profile.annual_revenue}
                  onChange={e => setProfile(p => ({ ...p, annual_revenue: e.target.value }))}
                  className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                  placeholder="250000"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                  Team Size
                </label>
                <input
                  type="number"
                  value={profile.team_size}
                  onChange={e => setProfile(p => ({ ...p, team_size: e.target.value }))}
                  className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                  placeholder="12"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Projects */}
        <section className="border-4 border-bauhaus-black bg-white">
          <div className="bg-bauhaus-black px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Projects</h2>
            <button
              type="button"
              onClick={addProject}
              className="text-xs font-black text-bauhaus-yellow uppercase tracking-widest hover:text-white"
            >
              + Add
            </button>
          </div>
          <div className="p-5 space-y-4">
            {profile.projects.length === 0 && (
              <p className="text-sm text-bauhaus-muted">
                Add your projects to improve grant matching accuracy
              </p>
            )}
            {profile.projects.map((project, i) => (
              <div key={i} className="border-2 border-bauhaus-black/20 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={project.name}
                      onChange={e => updateProject(i, 'name', e.target.value)}
                      placeholder="Project name"
                      className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProject(i)}
                    className="text-xs font-black text-bauhaus-red uppercase tracking-widest hover:text-bauhaus-black mt-2"
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  value={project.description}
                  onChange={e => updateProject(i, 'description', e.target.value)}
                  placeholder="What does this project do?"
                  rows={2}
                  className="w-full border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue resize-y"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Team Management */}
        {profile.id && (
          <section className="border-4 border-bauhaus-black bg-white">
            <div className="bg-green-600 px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Team</h2>
              <span className="text-xs font-black text-white/80 uppercase tracking-widest">
                {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="p-5 space-y-4">
              {/* Member List */}
              {teamLoading ? (
                <div className="text-sm font-black uppercase tracking-widest text-bauhaus-muted animate-pulse">
                  Loading team...
                </div>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-bauhaus-muted">
                  No team members yet. Invite colleagues to share your grant tracker.
                </p>
              ) : (
                <div className="divide-y-2 divide-bauhaus-black/10">
                  {teamMembers.map(member => {
                    const isPending = !member.user_id;
                    return (
                      <div key={member.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <span className={`text-sm font-black truncate block ${isPending ? 'text-bauhaus-muted' : 'text-bauhaus-black'}`}>
                            {member.email || member.invited_email || (member.user_id ? member.user_id.slice(0, 8) + '...' : 'Unknown')}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isPending ? (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black bg-gray-200 text-bauhaus-muted">
                                Pending
                              </span>
                            ) : (
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black ${
                                member.role === 'admin' ? 'bg-bauhaus-red text-white' :
                                member.role === 'editor' ? 'bg-bauhaus-blue text-white' :
                                'bg-bauhaus-yellow text-bauhaus-black'
                              }`}>
                                {member.role}
                              </span>
                            )}
                            {member.accepted_at && (
                              <span className="text-[10px] text-bauhaus-muted">
                                Joined {new Date(member.accepted_at).toLocaleDateString('en-AU')}
                              </span>
                            )}
                          </div>
                        </div>
                        {currentUserRole === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={removingMember === member.id}
                            className="text-xs font-black text-bauhaus-red uppercase tracking-widest hover:text-bauhaus-black disabled:opacity-50"
                          >
                            {removingMember === member.id ? '...' : isPending ? 'Cancel' : 'Remove'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Invite Form (admin only) */}
              {currentUserRole === 'admin' && (
                <div className="border-t-2 border-bauhaus-black/10 pt-4">
                  <label className="block text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">
                    Invite Team Member
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="colleague@org.au"
                      className="flex-1 border-4 border-bauhaus-black px-3 py-2 text-sm font-medium focus:outline-none focus:border-bauhaus-blue"
                    />
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      className="border-4 border-bauhaus-black px-2 py-2 text-xs font-black uppercase tracking-widest bg-white focus:outline-none focus:border-bauhaus-blue"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleInvite}
                      disabled={inviting || !inviteEmail.trim()}
                      className="px-4 py-2 text-xs font-black uppercase tracking-widest bg-bauhaus-black text-white hover:bg-bauhaus-blue disabled:opacity-50 border-4 border-bauhaus-black"
                    >
                      {inviting ? '...' : 'Invite'}
                    </button>
                  </div>
                  {inviteMessage && (
                    <p className={`text-xs font-bold mt-2 ${inviteMessage.includes('Failed') || inviteMessage.includes('error') ? 'text-bauhaus-red' : 'text-green-700'}`}>
                      {inviteMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-bauhaus-red text-white font-black uppercase tracking-widest px-8 py-3 text-sm border-4 border-bauhaus-black hover:bg-bauhaus-black disabled:opacity-50 bauhaus-shadow-sm"
          >
            {saving ? 'Saving & Matching...' : 'Save & Find Matches'}
          </button>
          {saved && (
            <span className="text-sm font-black text-green-700 uppercase tracking-widest">
              Saved
            </span>
          )}
        </div>
      </form>

      {/* Matches Section */}
      {(matches.length > 0 || matchesLoading) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase tracking-tight text-bauhaus-black">
              Matched Grants
            </h2>
            <Link
              href="/profile/matches"
              className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-black"
            >
              View All
            </Link>
          </div>

          {matchesLoading ? (
            <div className="text-sm font-black uppercase tracking-widest text-bauhaus-muted animate-pulse py-8 text-center">
              Finding matches...
            </div>
          ) : (
            <div className="space-y-3">
              {matches.slice(0, 10).map(grant => (
                <div key={grant.id} className="border-4 border-bauhaus-black bg-white p-4 flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 h-14 bg-bauhaus-blue border-3 border-bauhaus-black flex items-center justify-center">
                    <span className="text-lg font-black text-white">{grant.fit_score}%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/grants/${grant.id}`}
                      className="text-sm font-black text-bauhaus-black hover:text-bauhaus-blue uppercase tracking-wide"
                    >
                      {grant.name}
                    </Link>
                    <div className="text-xs text-bauhaus-muted mt-1">{grant.provider}</div>
                    {grant.description && (
                      <p className="text-xs text-bauhaus-black/70 mt-1 line-clamp-2">{grant.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {grant.amount_max && (
                        <span className="text-xs font-bold text-bauhaus-black">
                          Up to ${grant.amount_max.toLocaleString()}
                        </span>
                      )}
                      {grant.closes_at && (
                        <span className="text-xs text-bauhaus-red font-bold">
                          Closes {new Date(grant.closes_at).toLocaleDateString('en-AU')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => saveToTracker(grant.id)}
                    disabled={savingGrant === grant.id}
                    className="flex-shrink-0 text-xs font-black uppercase tracking-widest px-3 py-2 border-3 border-bauhaus-black hover:bg-bauhaus-black hover:text-white disabled:opacity-50"
                  >
                    {savingGrant === grant.id ? '...' : 'Track'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
