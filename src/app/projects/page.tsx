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
  }

  async function handleArchive(project: ProjectWithClient) {
    const newStatus = project.status === 'active' ? 'archived' : 'active';
    const action = newStatus === 'archived' ? 'archive' : 'restore';

    if (!confirm(`Are you sure you want to ${action} "${project.name}"?`)) {
      return;
    }

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
        <h1 className="text-2xl font-semibold text-text">Projects</h1>
        <button
          onClick={openAddForm}
          disabled={clients.length === 0}
          className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Project
        </button>
      </div>

      {/* No Clients Warning */}
      {clients.length === 0 && !loading && (
        <div className="rounded-button bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          You need to create a client first before adding projects.{' '}
          <a href="/clients" className="underline font-medium">
            Add a client
          </a>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-button bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
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
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <label htmlFor="showArchived" className="text-sm text-text-muted">
          Show archived projects
        </label>
      </div>

      {/* Project List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading projects...</div>
      ) : projects.length === 0 ? (
        <EmptyState title={showArchived ? 'No projects found' : 'No active projects'}>
          {showArchived ? 'Try disabling the archived filter.' : 'Add your first project to get started!'}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className={`rounded-card bg-background p-4 shadow-card border-l-4 ${
                project.status === 'archived' ? 'opacity-60' : ''
              }`}
              style={{ borderLeftColor: project.clients?.color || '#3A7D44' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-text">{project.name}</h3>
                  <p className="text-sm text-text-muted">{project.clients?.name || 'Unknown Client'}</p>
                  <p className="text-sm text-text-muted mt-1">
                    ${getEffectiveRate(project).toFixed(2)}/hr
                    {project.hourly_rate_override !== null && (
                      <span className="ml-1 text-xs text-primary">(override)</span>
                    )}
                  </p>
                  {project.status === 'archived' && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      Archived
                    </span>
                  )}
                </div>
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: project.clients?.color || '#3A7D44' }}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openEditForm(project)}
                  className="rounded-button px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleArchive(project)}
                  className={`rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${
                    project.status === 'active'
                      ? 'text-text-muted hover:bg-gray-100'
                      : 'text-primary hover:bg-primary-light'
                  }`}
                >
                  {project.status === 'active' ? 'Archive' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-card bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-text">
              {editingProject ? 'Edit Project' : 'Add New Project'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Client Selection */}
              <div>
                <label htmlFor="client" className="block text-sm font-medium text-text">
                  Client
                </label>
                <select
                  id="client"
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-button border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} (${client.hourly_rate.toFixed(2)}/hr)
                    </option>
                  ))}
                </select>
              </div>

              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text">
                  Project Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-button border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Enter project name"
                />
              </div>

              {/* Hourly Rate Override */}
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useRateOverride"
                    checked={useRateOverride}
                    onChange={(e) => setUseRateOverride(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="useRateOverride" className="text-sm font-medium text-text">
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
                    className="mt-2 w-full rounded-button border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="0.00"
                  />
                ) : (
                  <p className="mt-2 text-sm text-text-muted">
                    Uses client rate: ${getSelectedClientRate().toFixed(2)}/hr
                  </p>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-button px-4 py-2 text-sm font-medium text-text-muted hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                >
                  {editingProject ? 'Save Changes' : 'Add Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
