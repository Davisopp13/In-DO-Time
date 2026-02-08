'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Client, Project, ProjectInsert, ProjectUpdate } from '@/types/database';
import EmptyState from '@/components/EmptyState';

// Extended project type with client info for display
type ProjectWithClient = Project & {
  clients: Pick<Client, 'id' | 'name' | 'color' | 'hourly_rate'> | null;
};

async function loadProjects(showArchived: boolean) {
  let query = supabase
    .from('projects')
    .select('*, clients(id, name, color, hourly_rate)')
    .order('name');

  if (!showArchived) {
    query = query.eq('status', 'active');
  }

  return query;
}

async function loadActiveClients() {
  return supabase
    .from('clients')
    .select('id, name, color, hourly_rate')
    .eq('status', 'active')
    .order('name');
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithClient[]>([]);
  const [clients, setClients] = useState<Pick<Client, 'id' | 'name' | 'color' | 'hourly_rate'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithClient | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formRateOverride, setFormRateOverride] = useState('');
  const [useRateOverride, setUseRateOverride] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadProjects(showArchived), loadActiveClients()]).then(
      ([projectsResult, clientsResult]) => {
        if (cancelled) return;

        if (projectsResult.error) {
          console.error('Error fetching projects:', projectsResult.error);
          setError('Failed to load projects');
        } else {
          setProjects((projectsResult.data as ProjectWithClient[]) || []);
          setError(null);
        }

        if (clientsResult.error) {
          console.error('Error fetching clients:', clientsResult.error);
        } else {
          setClients(clientsResult.data || []);
        }

        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [showArchived, refreshTrigger]);

  function refreshProjects() {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  }

  function openAddForm() {
    setEditingProject(null);
    setFormName('');
    setFormClientId(clients.length > 0 ? clients[0].id : '');
    setFormRateOverride('');
    setUseRateOverride(false);
    setShowForm(true);
  }

  function openEditForm(project: ProjectWithClient) {
    setEditingProject(project);
    setFormName(project.name);
    setFormClientId(project.client_id);
    if (project.hourly_rate_override !== null) {
      setFormRateOverride(project.hourly_rate_override.toString());
      setUseRateOverride(true);
    } else {
      setFormRateOverride('');
      setUseRateOverride(false);
    }
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingProject(null);
    setFormName('');
    setFormClientId('');
    setFormRateOverride('');
    setUseRateOverride(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!formClientId) {
      setError('Please select a client');
      return;
    }

    setSaving(true);
    try {
      const rateOverride = useRateOverride ? parseFloat(formRateOverride) || null : null;

      if (editingProject) {
        // Update existing project
        const updates: ProjectUpdate = {
          name: formName,
          client_id: formClientId,
          hourly_rate_override: rateOverride,
        };

        const { error } = await supabase
          .from('projects')
          .update(updates)
          .eq('id', editingProject.id);

        if (error) {
          setError('Failed to update project');
          console.error('Error updating project:', error);
          return;
        }
      } else {
        // Create new project
        const newProject: ProjectInsert = {
          name: formName,
          client_id: formClientId,
          hourly_rate_override: rateOverride,
        };

        const { error } = await supabase.from('projects').insert(newProject);

        if (error) {
          setError('Failed to create project');
          console.error('Error creating project:', error);
          return;
        }
      }

      closeForm();
      refreshProjects();
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(project: ProjectWithClient) {
    const newStatus = project.status === 'active' ? 'archived' : 'active';
    const action = newStatus === 'archived' ? 'archive' : 'restore';

    if (!confirm(`Are you sure you want to ${action} "${project.name}"?`)) {
      return;
    }

    setArchivingId(project.id);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', project.id);

      if (error) {
        setError(`Failed to ${action} project`);
        console.error(`Error ${action}ing project:`, error);
        return;
      }

      refreshProjects();
    } finally {
      setArchivingId(null);
    }
  }

  // Get effective hourly rate for a project
  function getEffectiveRate(project: ProjectWithClient): number {
    if (project.hourly_rate_override !== null) {
      return project.hourly_rate_override;
    }
    return project.clients?.hourly_rate || 0;
  }

  // Get selected client's rate for form preview
  function getSelectedClientRate(): number {
    const client = clients.find((c) => c.id === formClientId);
    return client?.hourly_rate || 0;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text dark:text-white">Projects</h1>
        <button
          onClick={openAddForm}
          disabled={clients.length === 0}
          className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/20"
        >
          + Add Project
        </button>
      </div>

      {/* No Clients Warning */}
      {clients.length === 0 && !loading && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-500">
          You need to create a client first before adding projects.{' '}
          <a href="/clients" className="underline font-medium hover:text-amber-400">
            Add a client
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-6 border-l-4 border-border animate-pulse">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-surface/20 dark:bg-white/10" />
                  <div className="h-3 w-20 rounded bg-surface/20 dark:bg-white/10" />
                  <div className="h-3 w-16 rounded bg-surface/20 dark:bg-white/10" />
                </div>
                <div className="h-4 w-4 rounded-full bg-surface/20 dark:bg-white/10" />
              </div>
              <div className="mt-4 flex gap-2">
                <div className="h-7 w-12 rounded bg-surface/20 dark:bg-white/10" />
                <div className="h-7 w-16 rounded bg-surface/20 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState title={showArchived ? 'No projects found' : 'No active projects'}>
          {showArchived ? 'Try disabling the archived filter.' : 'Add your first project to get started!'}
        </EmptyState>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`glass-card p-6 shadow-card border-l-4 transition-all duration-300 hover:scale-[1.01] hover:bg-surface-foreground/5 dark:hover:bg-white/5 ${project.status === 'archived' ? 'opacity-60 grayscale' : ''
                }`}
              style={{ borderLeftColor: project.clients?.color || '#3A7D44' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-text dark:text-white group-hover:text-accent transition-colors">{project.name}</h3>
                  <p className="text-sm text-text-muted font-medium uppercase tracking-wide mt-1">{project.clients?.name || 'Unknown Client'}</p>
                  <p className="text-sm text-text/70 dark:text-white/70 mt-3">
                    ${getEffectiveRate(project).toFixed(2)}<span className="text-xs text-text-muted/70 dark:text-white/50">/hr</span>
                    {project.hourly_rate_override !== null && (
                      <span className="ml-1 text-xs text-accent">(override)</span>
                    )}
                  </p>
                  {project.status === 'archived' && (
                    <span className="inline-block mt-2 px-2 py-0.5 text-[10px] uppercase font-bold bg-surface-foreground/10 dark:bg-white/10 text-text-muted/70 dark:text-white/50 rounded">
                      Archived
                    </span>
                  )}
                </div>
                <div
                  className="h-3 w-3 rounded-full mt-1"
                  style={{ backgroundColor: project.clients?.color || '#3A7D44' }}
                />
              </div>
              <div className="mt-6 flex gap-2">
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
                  {archivingId === project.id
                    ? 'Processing...'
                    : project.status === 'active' ? 'Archive' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-card bg-surface dark:bg-[#0F172A] p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-text dark:text-white">
              {editingProject ? 'Edit Project' : 'Add New Project'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Client Selection */}
              <div>
                <label htmlFor="client" className="block text-sm font-medium text-text-muted mb-1">
                  Client
                </label>
                <select
                  id="client"
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="" className="bg-surface dark:bg-slate-900">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id} className="bg-surface dark:bg-slate-900">
                      {client.name} (${client.hourly_rate.toFixed(2)}/hr)
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

              {/* Hourly Rate Override */}
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
                    Override hourly rate
                  </label>
                </div>
                {useRateOverride ? (
                  <input
                    type="number"
                    id="rateOverride"
                    value={formRateOverride}
                    onChange={(e) => setFormRateOverride(e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                    placeholder="0.00"
                  />
                ) : (
                  <p className="text-sm text-text-muted/70 dark:text-white/50 pl-6">
                    Uses client rate: <span className="text-text dark:text-white">${getSelectedClientRate().toFixed(2)}/hr</span>
                  </p>
                )}
              </div>

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
