'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Check, Flag, Plus, X } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { Z_INDEX } from '@/lib/constants';
import { parseTaskInput } from '@/lib/parseTaskInput';
import type { Json, Trail, TrailUpdate, Project, ProjectInsert, ProjectUpdate, Rate, TimeEntry, OpenLoop, OpenLoopInsert, OpenLoopUpdate } from '@/types/database';
import { formatDuration } from '@/lib/timer';

const KIND_LABELS: Record<Trail['kind'], string> = {
  client: 'Client',
  employer: 'Employer',
  personal: 'Personal',
  project: 'Project',
};

const TRAIL_COLORS = [
  '#3A7D44', '#1B5E20', '#D97706', '#2563EB', '#7C3AED',
  '#DC2626', '#059669', '#D946EF', '#8B4513', '#003D6B',
  '#6B46C1', '#6B7280',
];

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function getOneDayBefore(dateISO: string): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatEntryDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type ProjectPhase = {
  id: string;
  name: string;
  completed: boolean;
};

function getProjectPhases(project: Project): ProjectPhase[] {
  if (!Array.isArray(project.phases)) return [];
  return project.phases.filter((phase): phase is ProjectPhase => {
    return typeof phase === 'object' && phase !== null && 'id' in phase && 'name' in phase && 'completed' in phase;
  });
}

function parsedTagsFor(input: string): Json {
  const parsed = parseTaskInput(input);
  return {
    tags: parsed.tags,
    project: parsed.project,
    priority: parsed.priority,
    assignee: parsed.assignee,
    due_date: parsed.due_date,
  };
}

export default function TrailDetailPage() {
  const params = useParams();
  const trailId = params.id as string;

  const [trail, setTrail] = useState<Trail | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [openLoopsByProject, setOpenLoopsByProject] = useState<Record<string, OpenLoop[]>>({});
  const [projectMap, setProjectMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Edit trail modal
  const [showEditTrail, setShowEditTrail] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Add project modal
  const [showAddProject, setShowAddProject] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectSaving, setProjectSaving] = useState(false);
  const [archivingProjectId, setArchivingProjectId] = useState<string | null>(null);
  const [newLoopTitleByProject, setNewLoopTitleByProject] = useState<Record<string, string>>({});
  const [loopSavingProjectId, setLoopSavingProjectId] = useState<string | null>(null);
  const [loopBusyId, setLoopBusyId] = useState<string | null>(null);
  const [batchProject, setBatchProject] = useState<Project | null>(null);
  const [batchText, setBatchText] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);
  const [phaseSavingProjectId, setPhaseSavingProjectId] = useState<string | null>(null);
  const [newPhaseByProject, setNewPhaseByProject] = useState<Record<string, string>>({});

  // Add rate modal
  const [showAddRate, setShowAddRate] = useState(false);
  const [rateAmount, setRateAmount] = useState('');
  const [rateEffectiveFrom, setRateEffectiveFrom] = useState(getTodayISO());
  const [rateSaving, setRateSaving] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: trailData, error: trailError } = await supabase
        .from('trails')
        .select('*')
        .eq('id', trailId)
        .single();

      if (cancelled) return;

      if (trailError || !trailData) {
        setError('Trail not found');
        setLoading(false);
        return;
      }

      const loadedTrail = trailData as Trail;
      setTrail(loadedTrail);
      setError(null);

      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('trail_id', trailId)
        .order('name');

      if (cancelled) return;

      const loadedProjects = (projectsData as Project[]) || [];
      setProjects(loadedProjects);

      const pMap: Record<string, string> = {};
      for (const p of loadedProjects) pMap[p.id] = p.name;
      setProjectMap(pMap);

      const loopsByProject: Record<string, OpenLoop[]> = {};
      for (const project of loadedProjects) {
        if (cancelled) return;
        const { data: loopData } = await supabase
          .from('open_loops')
          .select('*')
          .eq('project_id', project.id)
          .order('order', { ascending: true });
        loopsByProject[project.id] = ((loopData as OpenLoop[]) || []).sort((a, b) => a.order - b.order);
      }
      setOpenLoopsByProject(loopsByProject);

      if (loadedTrail.is_billable) {
        const { data: ratesData } = await supabase
          .from('rates')
          .select('*')
          .eq('trail_id', trailId)
          .order('effective_from', { ascending: false });

        if (cancelled) return;

        const loadedRates = ((ratesData as Rate[]) || []).filter(r => r.project_id === null);
        loadedRates.sort((a, b) => b.effective_from.localeCompare(a.effective_from));
        setRates(loadedRates);
      } else {
        setRates([]);
      }

      // Fetch recent entries one project at a time (compatible with mock client)
      const allEntries: TimeEntry[] = [];
      for (const project of loadedProjects) {
        if (cancelled) return;
        const { data: entryData } = await supabase
          .from('time_entries')
          .select('*')
          .eq('project_id', project.id)
          .order('start_time', { ascending: false })
          .limit(10);
        if (entryData) allEntries.push(...(entryData as TimeEntry[]));
      }

      if (cancelled) return;

      allEntries.sort(
        (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );
      setRecentEntries(allEntries.slice(0, 20));

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [trailId, refreshTrigger]);

  function refresh() {
    setRefreshTrigger((prev) => prev + 1);
  }

  function openEditTrail() {
    if (!trail) return;
    setEditName(trail.name);
    setEditDescription(trail.description || '');
    setEditColor(trail.color || '#3A7D44');
    setShowEditTrail(true);
  }

  async function handleEditTrail(e: React.FormEvent) {
    e.preventDefault();
    if (!trail) return;
    setEditSaving(true);
    const supabase = getSupabase();
    try {
      const update: TrailUpdate = {
        name: editName,
        description: editDescription || null,
        color: editColor,
      };
      const { error: updateError } = await supabase
        .from('trails')
        .update(update)
        .eq('id', trail.id);
      if (updateError) {
        setError('Failed to update trail');
        return;
      }
      setShowEditTrail(false);
      refresh();
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault();
    setProjectSaving(true);
    const supabase = getSupabase();
    try {
      const newProject: ProjectInsert = {
        trail_id: trailId,
        name: projectName,
        description: projectDescription || null,
      };
      const { error: insertError } = await supabase.from('projects').insert(newProject);
      if (insertError) {
        setError('Failed to create project');
        return;
      }
      setProjectName('');
      setProjectDescription('');
      setShowAddProject(false);
      refresh();
    } finally {
      setProjectSaving(false);
    }
  }

  async function handleArchiveProject(project: Project) {
    const newStatus = project.status === 'active' ? 'archived' : 'active';
    const action = newStatus === 'archived' ? 'archive' : 'restore';
    if (!confirm(`Are you sure you want to ${action} "${project.name}"?`)) return;
    setArchivingProjectId(project.id);
    const supabase = getSupabase();
    try {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', project.id);
      if (updateError) {
        setError(`Failed to ${action} project`);
        return;
      }
      refresh();
    } finally {
      setArchivingProjectId(null);
    }
  }

  async function updateProjectPhases(project: Project, phases: ProjectPhase[]) {
    setPhaseSavingProjectId(project.id);
    try {
      const { error: updateError } = await getSupabase()
        .from('projects')
        .update({ phases: phases as unknown as Json } satisfies ProjectUpdate)
        .eq('id', project.id);
      if (updateError) {
        setError('Failed to update project phases');
        return;
      }
      setProjects((current) => current.map((item) => item.id === project.id ? { ...item, phases: phases as unknown as Json } : item));
    } finally {
      setPhaseSavingProjectId(null);
    }
  }

  async function handleAddPhase(project: Project) {
    const name = (newPhaseByProject[project.id] || '').trim();
    if (!name) return;
    const phases = getProjectPhases(project);
    await updateProjectPhases(project, [...phases, { id: crypto.randomUUID(), name, completed: false }]);
    setNewPhaseByProject((current) => ({ ...current, [project.id]: '' }));
  }

  async function handleRenamePhase(project: Project, phase: ProjectPhase) {
    const name = prompt('Rename phase', phase.name)?.trim();
    if (!name) return;
    const phases = getProjectPhases(project).map((item) => item.id === phase.id ? { ...item, name } : item);
    await updateProjectPhases(project, phases);
  }

  async function handleTogglePhase(project: Project, phase: ProjectPhase) {
    const phases = getProjectPhases(project).map((item) => item.id === phase.id ? { ...item, completed: !item.completed } : item);
    await updateProjectPhases(project, phases);
  }

  async function handleMovePhase(project: Project, phaseId: string, direction: -1 | 1) {
    const phases = getProjectPhases(project);
    const index = phases.findIndex((phase) => phase.id === phaseId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= phases.length) return;
    const reordered = [...phases];
    const [phase] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, phase);
    await updateProjectPhases(project, reordered);
  }

  async function handleDeletePhase(project: Project, phaseId: string) {
    const phases = getProjectPhases(project).filter((phase) => phase.id !== phaseId);
    await updateProjectPhases(project, phases);
  }

  async function createOpenLoop(projectId: string, rawTitle: string, order: number) {
    const parsed = parseTaskInput(rawTitle);
    const row: OpenLoopInsert = {
      project_id: projectId,
      title: parsed.title || rawTitle.trim(),
      order,
      parsed_tags: parsedTagsFor(rawTitle),
    };
    return getSupabase().from('open_loops').insert(row);
  }

  async function handleAddOpenLoop(project: Project) {
    const rawTitle = (newLoopTitleByProject[project.id] || '').trim();
    if (!rawTitle) return;
    setLoopSavingProjectId(project.id);
    try {
      const nextOrder = (openLoopsByProject[project.id] || []).length;
      const { error: insertError } = await createOpenLoop(project.id, rawTitle, nextOrder);
      if (insertError) {
        setError('Failed to create open loop');
        return;
      }
      setNewLoopTitleByProject((current) => ({ ...current, [project.id]: '' }));
      refresh();
    } finally {
      setLoopSavingProjectId(null);
    }
  }

  async function handleEditOpenLoop(loop: OpenLoop) {
    const title = prompt('Edit open loop', loop.title)?.trim();
    if (!title) return;
    setLoopBusyId(loop.id);
    try {
      const update: OpenLoopUpdate = { title, parsed_tags: parsedTagsFor(title) };
      const { error: updateError } = await getSupabase().from('open_loops').update(update).eq('id', loop.id);
      if (updateError) {
        setError('Failed to update open loop');
        return;
      }
      refresh();
    } finally {
      setLoopBusyId(null);
    }
  }

  async function handleSetLoopStatus(loop: OpenLoop, status: OpenLoop['status']) {
    setLoopBusyId(loop.id);
    try {
      const now = new Date().toISOString();
      const update: OpenLoopUpdate = {
        status,
        completed_at: status === 'completed' ? now : null,
        abandoned_at: status === 'abandoned' ? now : null,
      };
      const { error: updateError } = await getSupabase().from('open_loops').update(update).eq('id', loop.id);
      if (updateError) {
        setError('Failed to update open loop');
        return;
      }
      refresh();
    } finally {
      setLoopBusyId(null);
    }
  }

  async function handleDeleteOpenLoop(loop: OpenLoop) {
    if (!confirm(`Delete "${loop.title}"?`)) return;
    setLoopBusyId(loop.id);
    try {
      const { error: deleteError } = await getSupabase().from('open_loops').delete().eq('id', loop.id);
      if (deleteError) {
        setError('Failed to delete open loop');
        return;
      }
      refresh();
    } finally {
      setLoopBusyId(null);
    }
  }

  async function handleMoveOpenLoop(projectId: string, loopId: string, direction: -1 | 1) {
    const loops = [...(openLoopsByProject[projectId] || [])];
    const index = loops.findIndex((loop) => loop.id === loopId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= loops.length) return;
    const [loop] = loops.splice(index, 1);
    loops.splice(nextIndex, 0, loop);
    setOpenLoopsByProject((current) => ({ ...current, [projectId]: loops.map((item, order) => ({ ...item, order })) }));
    await Promise.all(loops.map((item, order) => getSupabase().from('open_loops').update({ order } satisfies OpenLoopUpdate).eq('id', item.id)));
    refresh();
  }

  async function handleBatchPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!batchProject) return;
    const lines = batchText.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setBatchSaving(true);
    try {
      const currentCount = (openLoopsByProject[batchProject.id] || []).length;
      const results = await Promise.all(lines.map((line, index) => createOpenLoop(batchProject.id, line, currentCount + index)));
      if (results.some((result: { error: unknown }) => result.error)) {
        setError('Some open loops could not be created');
        return;
      }
      setBatchProject(null);
      setBatchText('');
      refresh();
    } finally {
      setBatchSaving(false);
    }
  }

  async function handleAddRate(e: React.FormEvent) {
    e.preventDefault();
    const rateValue = parseFloat(rateAmount);
    if (isNaN(rateValue) || rateValue <= 0) {
      setError('Enter a valid rate amount');
      return;
    }
    setRateSaving(true);
    const supabase = getSupabase();
    try {
      // Close off the previous open rate
      const openRate = rates.find((r) => r.project_id === null && r.effective_until === null);
      if (openRate) {
        const until = getOneDayBefore(rateEffectiveFrom);
        await supabase
          .from('rates')
          .update({ effective_until: until })
          .eq('id', openRate.id);
      }

      await supabase.from('rates').insert({
        trail_id: trailId,
        project_id: null,
        hourly_rate: rateValue,
        effective_from: rateEffectiveFrom,
        effective_until: null,
      });

      setRateAmount('');
      setRateEffectiveFrom(getTodayISO());
      setShowAddRate(false);
      refresh();
    } finally {
      setRateSaving(false);
    }
  }

  const trailColor = trail?.color ?? '#3A7D44';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-text-muted animate-pulse">
          <span>Trails</span>
          <span>/</span>
          <span className="h-4 w-24 rounded bg-surface/20 dark:bg-white/10 inline-block" />
        </div>
        <div className="glass-card p-6 border-l-4 border-border animate-pulse space-y-3">
          <div className="h-7 w-48 rounded bg-surface/20 dark:bg-white/10" />
          <div className="h-4 w-24 rounded bg-surface/20 dark:bg-white/10" />
        </div>
      </div>
    );
  }

  if (error && !trail) {
    return (
      <div className="space-y-6">
        <Link href="/trails" className="text-sm text-text-muted hover:text-text dark:hover:text-white transition-colors">
          ← Back to Trails
        </Link>
        <div className="rounded-button bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!trail) return null;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted">
        <Link href="/trails" className="hover:text-text dark:hover:text-white transition-colors">
          Trails
        </Link>
        <span>/</span>
        <span className="text-text dark:text-white font-medium">{trail.name}</span>
      </nav>

      {error && (
        <div className="rounded-button bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Trail header */}
      <div
        className="glass-card p-6 border-l-4 shadow-card"
        style={{ borderLeftColor: trailColor }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className="mt-1 h-5 w-5 shrink-0 rounded-full"
              style={{ backgroundColor: trailColor }}
            />
            <div>
              <h1 className="text-2xl font-bold text-text dark:text-white">{trail.name}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold bg-surface-foreground/10 dark:bg-white/10 text-text-muted dark:text-white/60 rounded">
                  {KIND_LABELS[trail.kind]}
                </span>
                {trail.is_billable && (
                  <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold bg-primary/10 text-primary rounded">
                    Billable
                  </span>
                )}
                {trail.status === 'archived' && (
                  <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-bold bg-surface-foreground/10 dark:bg-white/10 text-text-muted/70 dark:text-white/50 rounded">
                    Archived
                  </span>
                )}
              </div>
              {trail.description && (
                <p className="mt-2 text-sm text-text-muted">{trail.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={openEditTrail}
            className="self-start rounded-full px-4 py-1.5 text-xs font-medium text-text-muted hover:text-text dark:text-white/70 dark:hover:text-white bg-surface-foreground/5 dark:bg-white/5 hover:bg-surface-foreground/10 dark:hover:bg-white/10 border border-border dark:border-white/5 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Projects section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text dark:text-white">Projects</h2>
          <button
            onClick={() => {
              setProjectName('');
              setProjectDescription('');
              setShowAddProject(true);
            }}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary/90 shadow-sm shadow-primary/20"
          >
            + Add project
          </button>
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-text-muted py-4">
            No projects yet. Add one to start tracking time.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const phases = getProjectPhases(project);
              const loops = openLoopsByProject[project.id] || [];
              return (
                <div
                  key={project.id}
                  className={`glass-card p-4 border-l-4 shadow-card transition-all duration-200 hover:scale-[1.01] hover:bg-surface-foreground/5 dark:hover:bg-white/5 ${
                    project.status === 'archived' ? 'opacity-60 grayscale' : ''
                  }`}
                  style={{ borderLeftColor: trailColor }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text dark:text-white truncate">
                        {project.name}
                      </h3>
                      {project.description && (
                        <p className="mt-1 text-xs text-text-muted truncate">{project.description}</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[10px] uppercase font-bold rounded ${
                            project.status === 'active'
                              ? 'bg-primary/10 text-primary'
                              : project.status === 'completed'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-surface-foreground/10 dark:bg-white/10 text-text-muted/70 dark:text-white/50'
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleArchiveProject(project)}
                      disabled={archivingProjectId === project.id}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors border border-border dark:border-white/5 disabled:opacity-50 disabled:cursor-not-allowed ${
                        project.status === 'active'
                          ? 'text-text-muted hover:text-text dark:text-white/60 bg-surface-foreground/5 dark:bg-white/5 hover:bg-surface-foreground/10 dark:hover:bg-white/10 dark:hover:text-white'
                          : 'text-primary bg-primary/10 hover:bg-primary/20'
                      }`}
                    >
                      {archivingProjectId === project.id
                        ? '...'
                        : project.status === 'active'
                        ? 'Archive'
                        : 'Restore'}
                    </button>
                  </div>

                  <div className="mt-4 space-y-3 border-t border-border pt-4 dark:border-white/5">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Phases</h4>
                        {phaseSavingProjectId === project.id && <span className="text-[10px] text-text-muted">Saving...</span>}
                      </div>
                      <div className="space-y-1.5">
                        {phases.map((phase, index) => (
                          <div key={phase.id} className="flex items-center gap-1 rounded-lg bg-surface-foreground/5 px-2 py-1.5 dark:bg-white/5">
                            <button
                              type="button"
                              onClick={() => handleTogglePhase(project, phase)}
                              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                                phase.completed ? 'border-primary bg-primary text-white' : 'border-border text-text-muted dark:border-white/10'
                              }`}
                              aria-label={phase.completed ? 'Mark phase incomplete' : 'Mark phase complete'}
                            >
                              {phase.completed && <Check className="h-3 w-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRenamePhase(project, phase)}
                              className={`min-w-0 flex-1 truncate text-left text-xs ${phase.completed ? 'text-text-muted line-through' : 'text-text dark:text-white'}`}
                            >
                              {phase.name}
                            </button>
                            <button type="button" onClick={() => handleMovePhase(project, phase.id, -1)} disabled={index === 0} className="rounded p-1 text-text-muted hover:text-text disabled:opacity-30 dark:hover:text-white" aria-label="Move phase up">
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => handleMovePhase(project, phase.id, 1)} disabled={index === phases.length - 1} className="rounded p-1 text-text-muted hover:text-text disabled:opacity-30 dark:hover:text-white" aria-label="Move phase down">
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => handleDeletePhase(project, phase.id)} className="rounded p-1 text-text-muted hover:text-red-500" aria-label="Delete phase">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {phases.length === 0 && <p className="text-xs text-text-muted">No phases yet.</p>}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input
                          value={newPhaseByProject[project.id] || ''}
                          onChange={(event) => setNewPhaseByProject((current) => ({ ...current, [project.id]: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleAddPhase(project);
                            }
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-surface/50 px-2 py-1.5 text-xs text-text outline-none focus:border-accent dark:border-white/10 dark:bg-black/20 dark:text-white"
                          placeholder="Add phase"
                        />
                        <button type="button" onClick={() => handleAddPhase(project)} className="rounded-full bg-surface-foreground/10 p-2 text-text hover:bg-surface-foreground/20 dark:bg-white/10 dark:text-white" aria-label="Add phase">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Open loops</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setBatchProject(project);
                            setBatchText('');
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent hover:bg-accent/20"
                        >
                          <Flag className="h-3 w-3" />
                          Plan
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {loops.map((loop, index) => (
                          <div key={loop.id} className={`rounded-lg border border-border bg-surface/40 p-2 text-xs dark:border-white/5 dark:bg-black/20 ${loop.status !== 'open' ? 'opacity-60' : ''}`}>
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => handleSetLoopStatus(loop, loop.status === 'completed' ? 'open' : 'completed')}
                                disabled={loopBusyId === loop.id}
                                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                                  loop.status === 'completed' ? 'border-primary bg-primary text-white' : 'border-border text-text-muted dark:border-white/10'
                                }`}
                                aria-label="Toggle complete"
                              >
                                {loop.status === 'completed' && <Check className="h-3 w-3" />}
                              </button>
                              <button type="button" onClick={() => handleEditOpenLoop(loop)} className="min-w-0 flex-1 text-left leading-5 text-text dark:text-white">
                                {loop.title}
                              </button>
                            </div>
                            <div className="mt-2 flex items-center justify-end gap-1">
                              <button type="button" onClick={() => handleMoveOpenLoop(project.id, loop.id, -1)} disabled={index === 0 || loopBusyId === loop.id} className="rounded p-1 text-text-muted hover:text-text disabled:opacity-30 dark:hover:text-white" aria-label="Move loop up">
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => handleMoveOpenLoop(project.id, loop.id, 1)} disabled={index === loops.length - 1 || loopBusyId === loop.id} className="rounded p-1 text-text-muted hover:text-text disabled:opacity-30 dark:hover:text-white" aria-label="Move loop down">
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" onClick={() => handleSetLoopStatus(loop, 'abandoned')} disabled={loopBusyId === loop.id} className="rounded px-2 py-1 text-[10px] text-text-muted hover:text-amber-500">Abandon</button>
                              <button type="button" onClick={() => handleDeleteOpenLoop(loop)} disabled={loopBusyId === loop.id} className="rounded p-1 text-text-muted hover:text-red-500" aria-label="Delete loop">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {loops.length === 0 && <p className="text-xs text-text-muted">No loops yet.</p>}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input
                          value={newLoopTitleByProject[project.id] || ''}
                          onChange={(event) => setNewLoopTitleByProject((current) => ({ ...current, [project.id]: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleAddOpenLoop(project);
                            }
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-surface/50 px-2 py-1.5 text-xs text-text outline-none focus:border-accent dark:border-white/10 dark:bg-black/20 dark:text-white"
                          placeholder="Add open loop"
                        />
                        <button type="button" onClick={() => handleAddOpenLoop(project)} disabled={loopSavingProjectId === project.id} className="rounded-full bg-primary p-2 text-white disabled:opacity-50" aria-label="Add open loop">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Rate history section (billable trails only) */}
      {trail.is_billable && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text dark:text-white">Rate History</h2>
            <button
              onClick={() => {
                setRateAmount('');
                setRateEffectiveFrom(getTodayISO());
                setShowAddRate(true);
              }}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary/90 shadow-sm shadow-primary/20"
            >
              + New rate
            </button>
          </div>

          {rates.length === 0 ? (
            <p className="text-sm text-text-muted py-4">
              No rates set. Add a rate to track billable earnings.
            </p>
          ) : (
            <div className="overflow-hidden rounded-card border border-border dark:border-white/5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border dark:border-white/5 bg-surface-foreground/5 dark:bg-white/5">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Effective from
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Until
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-white/5">
                  {rates.map((rate) => (
                    <tr
                      key={rate.id}
                      className="transition-colors hover:bg-surface-foreground/5 dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-3 font-semibold text-text dark:text-white">
                        ${Number(rate.hourly_rate).toFixed(2)}
                        <span className="ml-0.5 text-xs font-normal text-text-muted">/hr</span>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{formatDate(rate.effective_from)}</td>
                      <td className="px-4 py-3 text-text-muted">
                        {rate.effective_until ? (
                          formatDate(rate.effective_until)
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 text-[10px] uppercase font-bold bg-primary/10 text-primary rounded">
                            Current
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Recent time entries section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text dark:text-white">Recent Time Entries</h2>
          <Link
            href="/time-log"
            className="text-xs text-text-muted hover:text-text dark:hover:text-white transition-colors"
          >
            View all →
          </Link>
        </div>

        {recentEntries.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No time entries yet.</p>
        ) : (
          <div className="overflow-hidden rounded-card border border-border dark:border-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border dark:border-white/5 bg-surface-foreground/5 dark:bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Start
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Duration
                  </th>
                  <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-white/5">
                {recentEntries.map((entry) => {
                  const durationSec =
                    entry.duration_seconds ??
                    (entry.end_time
                      ? Math.round(
                          (new Date(entry.end_time).getTime() -
                            new Date(entry.start_time).getTime()) /
                            1000
                        )
                      : null);
                  return (
                    <tr
                      key={entry.id}
                      className="transition-colors hover:bg-surface-foreground/5 dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-3 font-medium text-text dark:text-white">
                        {projectMap[entry.project_id] || 'Unknown'}
                        {entry.is_running && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] uppercase font-bold bg-primary/10 text-primary rounded animate-pulse">
                            Running
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {formatEntryDateTime(entry.start_time)}
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {durationSec != null ? formatDuration(durationSec) : '—'}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-text-muted truncate max-w-[200px]">
                        {entry.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit trail modal */}
      {showEditTrail && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" style={{ zIndex: Z_INDEX.modal }}>
          <div className="w-full max-w-md glass-card bg-surface dark:bg-[#0F172A] p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-text dark:text-white">Edit trail</h2>
            <form onSubmit={handleEditTrail} className="space-y-4">
              <div>
                <label htmlFor="editName" className="block text-sm font-medium text-text">
                  Trail name
                </label>
                <input
                  type="text"
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                />
              </div>
              <div>
                <label htmlFor="editDescription" className="block text-sm font-medium text-text">
                  Description (optional)
                </label>
                <textarea
                  id="editDescription"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20 resize-none"
                  placeholder="What is this trail for?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text">Color</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TRAIL_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setEditColor(color)}
                      className={`h-8 w-8 rounded-full transition-transform ${
                        editColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditTrail(false)}
                  className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:text-text dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add project modal */}
      {showAddProject && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" style={{ zIndex: Z_INDEX.modal }}>
          <div className="w-full max-w-md glass-card bg-surface dark:bg-[#0F172A] p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-text dark:text-white">Add project</h2>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label htmlFor="projectName" className="block text-sm font-medium text-text">
                  Project name
                </label>
                <input
                  type="text"
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                  placeholder="e.g. Website redesign"
                />
              </div>
              <div>
                <label htmlFor="projectDesc" className="block text-sm font-medium text-text">
                  Description (optional)
                </label>
                <textarea
                  id="projectDesc"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20 resize-none"
                  placeholder="What does this project cover?"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddProject(false)}
                  className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:text-text dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={projectSaving}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {projectSaving ? 'Saving...' : 'Add project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add rate modal */}
      {showAddRate && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" style={{ zIndex: Z_INDEX.modal }}>
          <div className="w-full max-w-md glass-card bg-surface dark:bg-[#0F172A] p-6 shadow-2xl">
            <h2 className="mb-1 text-xl font-bold text-text dark:text-white">New rate</h2>
            <p className="mb-4 text-sm text-text-muted">
              Adding a new rate will close off the current rate on the day before the new effective
              date.
            </p>
            <form onSubmit={handleAddRate} className="space-y-4">
              <div>
                <label htmlFor="rateAmount" className="block text-sm font-medium text-text">
                  Hourly rate ($/hr)
                </label>
                <input
                  type="number"
                  id="rateAmount"
                  value={rateAmount}
                  onChange={(e) => setRateAmount(e.target.value)}
                  required
                  min="0"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label htmlFor="rateFrom" className="block text-sm font-medium text-text">
                  Effective from
                </label>
                <input
                  type="date"
                  id="rateFrom"
                  value={rateEffectiveFrom}
                  onChange={(e) => setRateEffectiveFrom(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddRate(false)}
                  className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:text-text dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rateSaving}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rateSaving ? 'Saving...' : 'Add rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch planning modal */}
      {batchProject && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" style={{ zIndex: Z_INDEX.modal }}>
          <div className="w-full max-w-lg glass-card bg-surface dark:bg-[#0F172A] p-6 shadow-2xl">
            <h2 className="mb-1 text-xl font-bold text-text dark:text-white">Plan this project</h2>
            <p className="mb-4 text-sm text-text-muted">
              One loop per line. Inline tags, priorities, dates, and @project hints are parsed on save.
            </p>
            <form onSubmit={handleBatchPlan} className="space-y-4">
              <textarea
                value={batchText}
                onChange={(event) => setBatchText(event.target.value)}
                rows={8}
                className="w-full resize-none rounded-lg border border-border bg-surface/50 px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-black/20 dark:text-white"
                placeholder={'Sketch discovery questions #scope\nDraft API contract !!\nReview phase checklist tomorrow'}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBatchProject(null);
                    setBatchText('');
                  }}
                  className="rounded-full px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={batchSaving}
                  className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {batchSaving ? 'Saving...' : 'Create loops'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
