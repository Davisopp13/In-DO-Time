'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { Trail, Project, ProjectInsert, ProjectUpdate, RateInsert } from '@/types/database';
import EmptyState from '@/components/EmptyState';

type ProjectWithTrail = Project & {
  trail: Pick<Trail, 'id' | 'name' | 'color' | 'is_billable' | 'kind'> | null;
};

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function slugifyForTrail(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithTrail[]>([]);
  const [trails, setTrails] = useState<Pick<Trail, 'id' | 'name' | 'color' | 'is_billable' | 'kind'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Add / Edit modal
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithTrail | null>(null);
  const [formTrailId, setFormTrailId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRate, setFormRate] = useState('');
  const [useRateOverride, setUseRateOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    Promise.all([
      supabase.from('trails').select('id, name, color, is_billable, kind').eq('status', 'active').order('display_order'),
      supabase.from('projects').select('*').order('name'),
    ]).then(([trailsResult, projectsResult]: [{ data: Trail[] | null; error: unknown }, { data: Project[] | null; error: unknown }]) => {
      if (cancelled) return;

      const trailList: Pick<Trail, 'id' | 'name' | 'color' | 'is_billable' | 'kind'>[] = trailsResult.data || [];
      setTrails(trailList);

      const trailMap = new Map(trailList.map((t) => [t.id, t]));
      const allProjects: ProjectWithTrail[] = (projectsResult.data || []).map((p) => ({
        ...p,
        trail: trailMap.get(p.trail_id) ?? null,
      }));

      const filtered = showArchived ? allProjects : allProjects.filter((p) => p.status === 'active');
      setProjects(filtered);

      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [showArchived, refreshTrigger]);

  function refresh() {
    setLoading(true);
    setRefreshTrigger((n) => n + 1);
  }

  function openAddForm() {
    setEditingProject(null);
    setFormTrailId(trails.length > 0 ? trails[0].id : '');
    setFormName('');
    setFormDescription('');
    setFormRate('');
    setUseRateOverride(false);
    setShowForm(true);
  }

  function openEditForm(project: ProjectWithTrail) {
    setEditingProject(project);
    setFormTrailId(project.trail_id);
    setFormName(project.name);
    setFormDescription(project.description ?? '');
    setFormRate('');
    setUseRateOverride(false);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingProject(null);
    setFormTrailId('');
    setFormName('');
    setFormDescription('');
    setFormRate('');
    setUseRateOverride(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formTrailId) {
      setError('Please select a trail');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabase();

      if (editingProject) {
        const updates: ProjectUpdate = {
          trail_id: formTrailId,
          name: formName,
          description: formDescription || null,
        };
        const { error: updateError } = await supabase.from('projects').update(updates).eq('id', editingProject.id);
        if (updateError) {
          setError('Failed to update project');
          return;
        }
      } else {
        const projectId = crypto.randomUUID();
        const newProject: ProjectInsert = {
          id: projectId,
          trail_id: formTrailId,
          name: formName,
          description: formDescription || null,
        };
        const { error: insertError } = await supabase.from('projects').insert(newProject);
        if (insertError) {
          setError('Failed to create project');
          return;
        }

        const selectedTrail = trails.find((t) => t.id === formTrailId);
        if (selectedTrail?.is_billable && useRateOverride && formRate) {
          const rate = parseFloat(formRate);
          if (!isNaN(rate) && rate > 0) {
            const rateRow: RateInsert = {
              trail_id: formTrailId,
              project_id: projectId,
              hourly_rate: rate,
              effective_from: getTodayISO(),
            };
            await supabase.from('rates').insert(rateRow);
          }
        }
      }

      closeForm();
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(project: ProjectWithTrail) {
    const newStatus = project.status === 'active' ? 'archived' : 'active';
    const action = newStatus === 'archived' ? 'archive' : 'restore';
    if (!confirm(`Are you sure you want to ${action} "${project.name}"?`)) return;

    setArchivingId(project.id);
    try {
      const { error: archiveError } = await getSupabase()
        .from('projects')
        .update({ status: newStatus } satisfies ProjectUpdate)
        .eq('id', project.id);
      if (archiveError) {
        setError(`Failed to ${action} project`);
        return;
      }
      refresh();
    } finally {
      setArchivingId(null);
    }
  }

  // Group projects by trail
  const groupedByTrail = projects.reduce<Map<string, { trail: ProjectWithTrail['trail']; projects: ProjectWithTrail[] }>>(
    (acc, project) => {
      const key = project.trail_id;
      if (!acc.has(key)) {
        acc.set(key, { trail: project.trail, projects: [] });
      }
      acc.get(key)!.projects.push(project);
      return acc;
    },
    new Map()
  );

  const selectedTrail = trails.find((t) => t.id === formTrailId);

  void slugifyForTrail; // utility kept for potential future use

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-text dark:text-white">Projects</h1>
        <button
          onClick={openAddForm}
          disabled={trails.length === 0}
          className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto shadow-lg shadow-primary/20"
        >
          + Add Project
        </button>
      </div>

      {/* No Trails Warning */}
      {trails.length === 0 && !loading && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-500">
          You need to create a trail first before adding projects.{' '}
          <a href="/trails" className="underline font-medium hover:text-amber-400">
            Add a trail
          </a>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Show Archived Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="showArchived"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-surface/50 dark:bg-black/20 text-accent focus:ring-accent"
        />
        <label htmlFor="showArchived" className="text-sm font-medium text-text-muted">
          Show archived projects
        </label>
      </div>

      {/* Project List */}
      {loading ? (
        <div className="space-y-8">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-3">
              <div className="h-5 w-40 rounded bg-surface/20 dark:bg-white/10 animate-pulse" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2].map((j) => (
                  <div key={j} className="glass-card p-5 border-l-4 border-border animate-pulse">
                    <div className="h-4 w-32 rounded bg-surface/20 dark:bg-white/10" />
                    <div className="mt-3 h-3 w-20 rounded bg-surface/20 dark:bg-white/10" />
                    <div className="mt-4 flex gap-2">
                      <div className="h-7 w-12 rounded bg-surface/20 dark:bg-white/10" />
                      <div className="h-7 w-16 rounded bg-surface/20 dark:bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState title={showArchived ? 'No projects found' : 'No active projects'}>
          {showArchived ? 'Try disabling the archived filter.' : 'Add your first project to get started.'}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {Array.from(groupedByTrail.entries()).map(([trailId, group]) => (
            <div key={trailId} className="space-y-3">
              {/* Trail group header */}
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: group.trail?.color || '#3A7D44' }}
                />
                <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
                  {group.trail?.name || 'Unknown Trail'}
                </h2>
                {group.trail?.is_billable && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-accent/10 text-accent">
                    Billable
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.projects.map((project) => (
                  <div
                    key={project.id}
                    className={`glass-card p-5 shadow-card border-l-4 transition-all duration-300 hover:scale-[1.01] hover:bg-surface-foreground/5 dark:hover:bg-white/5 ${project.status === 'archived' ? 'opacity-60 grayscale' : ''}`}
                    style={{ borderLeftColor: group.trail?.color || '#3A7D44' }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base text-text dark:text-white truncate">{project.name}</h3>
                        {project.description && (
                          <p className="mt-1 text-xs text-text-muted/70 dark:text-white/50 line-clamp-2">{project.description}</p>
                        )}
                        {project.status === 'archived' && (
                          <span className="inline-block mt-2 px-2 py-0.5 text-[10px] uppercase font-bold bg-surface-foreground/10 dark:bg-white/10 text-text-muted/70 dark:text-white/50 rounded">
                            Archived
                          </span>
                        )}
                      </div>
                      <div
                        className="h-2.5 w-2.5 rounded-full mt-1 ml-2 shrink-0"
                        style={{ backgroundColor: group.trail?.color || '#3A7D44' }}
                      />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => openEditForm(project)}
                        className="rounded-full px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text dark:text-white/70 bg-surface-foreground/5 dark:bg-white/5 hover:bg-surface-foreground/10 dark:hover:bg-white/10 dark:hover:text-white transition-colors border border-border dark:border-white/5"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleArchive(project)}
                        disabled={archivingId === project.id}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border border-border dark:border-white/5 disabled:opacity-50 disabled:cursor-not-allowed ${project.status === 'active'
                          ? 'text-text-muted hover:text-text dark:text-white/70 bg-surface-foreground/5 dark:bg-white/5 hover:bg-surface-foreground/10 dark:hover:bg-white/10 dark:hover:text-white'
                          : 'text-accent bg-accent/10 hover:bg-accent/20'
                          }`}
                      >
                        {archivingId === project.id ? 'Processing...' : project.status === 'active' ? 'Archive' : 'Restore'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-card bg-surface dark:bg-[#0F172A] p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-text dark:text-white">
              {editingProject ? 'Edit Project' : 'Add New Project'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Trail Selection */}
              <div>
                <label htmlFor="trail" className="block text-sm font-medium text-text-muted mb-1">
                  Trail
                </label>
                <select
                  id="trail"
                  value={formTrailId}
                  onChange={(e) => { setFormTrailId(e.target.value); setUseRateOverride(false); setFormRate(''); }}
                  required
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="" className="bg-surface dark:bg-slate-900">Select a trail...</option>
                  {trails.map((trail) => (
                    <option key={trail.id} value={trail.id} className="bg-surface dark:bg-slate-900">
                      {trail.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text-muted mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                  placeholder="Enter project name"
                />
              </div>

              {/* Description Field */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-text-muted mb-1">
                  Description <span className="text-text-muted/50">(optional)</span>
                </label>
                <textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20 resize-none"
                  placeholder="Brief description of this project"
                />
              </div>

              {/* Project-level rate override (add only, billable trail only) */}
              {!editingProject && selectedTrail?.is_billable && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="useRateOverride"
                      checked={useRateOverride}
                      onChange={(e) => setUseRateOverride(e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-surface/50 dark:bg-black/20 text-accent focus:ring-accent"
                    />
                    <label htmlFor="useRateOverride" className="text-sm font-medium text-text-muted">
                      Set project-level rate override
                    </label>
                  </div>
                  {useRateOverride && (
                    <input
                      type="number"
                      id="rateOverride"
                      value={formRate}
                      onChange={(e) => setFormRate(e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                    />
                  )}
                  {!useRateOverride && (
                    <p className="text-sm text-text-muted/70 dark:text-white/50 pl-6">
                      Uses trail-level rate by default.
                    </p>
                  )}
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:text-text dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : editingProject ? 'Save Changes' : 'Add Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
