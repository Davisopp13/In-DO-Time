'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Client, ClientInsert, ClientUpdate } from '@/types/database';
import EmptyState from '@/components/EmptyState';

// Default colors for client color picker
const CLIENT_COLORS = [
  '#3A7D44', // Primary green
  '#1B5E20', // Dark green
  '#D97706', // Amber
  '#2563EB', // Blue
  '#7C3AED', // Purple
  '#DC2626', // Red
  '#059669', // Emerald
  '#D946EF', // Fuchsia
];

async function loadClients(showArchived: boolean) {
  let query = supabase
    .from('clients')
    .select('*')
    .order('name');

  if (!showArchived) {
    query = query.eq('status', 'active');
  }

  return query;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [saving, setSaving] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formRate, setFormRate] = useState('');
  const [formColor, setFormColor] = useState(CLIENT_COLORS[0]);

  useEffect(() => {
    let cancelled = false;

    loadClients(showArchived).then(({ data, error: fetchError }) => {
      if (cancelled) return;

      if (fetchError) {
        console.error('Error fetching clients:', fetchError);
        setError('Failed to load clients');
      } else {
        setClients(data || []);
        setError(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [showArchived, refreshTrigger]);

  function refreshClients() {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  }

  function openAddForm() {
    setEditingClient(null);
    setFormName('');
    setFormRate('');
    setFormColor(CLIENT_COLORS[0]);
    setShowForm(true);
  }

  function openEditForm(client: Client) {
    setEditingClient(client);
    setFormName(client.name);
    setFormRate(client.hourly_rate.toString());
    setFormColor(client.color);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingClient(null);
    setFormName('');
    setFormRate('');
    setFormColor(CLIENT_COLORS[0]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const hourlyRate = parseFloat(formRate) || 0;

      if (editingClient) {
        // Update existing client
        const updates: ClientUpdate = {
          name: formName,
          hourly_rate: hourlyRate,
          color: formColor,
        };

        const { error } = await supabase
          .from('clients')
          .update(updates)
          .eq('id', editingClient.id);

        if (error) {
          setError('Failed to update client');
          console.error('Error updating client:', error);
          return;
        }
      } else {
        // Create new client
        const newClient: ClientInsert = {
          name: formName,
          hourly_rate: hourlyRate,
          color: formColor,
        };

        const { error } = await supabase.from('clients').insert(newClient);

        if (error) {
          setError('Failed to create client');
          console.error('Error creating client:', error);
          return;
        }
      }

      closeForm();
      refreshClients();
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(client: Client) {
    const newStatus = client.status === 'active' ? 'archived' : 'active';
    const action = newStatus === 'archived' ? 'archive' : 'restore';

    if (!confirm(`Are you sure you want to ${action} "${client.name}"?`)) {
      return;
    }

    setArchivingId(client.id);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ status: newStatus })
        .eq('id', client.id);

      if (error) {
        setError(`Failed to ${action} client`);
        console.error(`Error ${action}ing client:`, error);
        return;
      }

      refreshClients();
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text dark:text-white">Clients</h1>
        <button
          onClick={openAddForm}
          className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 shadow-lg shadow-primary/20"
        >
          + Add Client
        </button>
      </div>

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
          className="h-4 w-4 rounded border-border bg-surface/50 dark:bg-black/20 text-primary focus:ring-primary"
        />
        <label htmlFor="showArchived" className="text-sm font-medium text-text-muted">
          Show archived clients
        </label>
      </div>

      {/* Client List */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-6 border-l-4 border-border animate-pulse">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-28 rounded bg-surface/20 dark:bg-white/10" />
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
      ) : clients.length === 0 ? (
        <EmptyState title={showArchived ? 'No clients found' : 'No active clients'}>
          {showArchived ? 'Try disabling the archived filter.' : 'Add your first client to get started!'}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className={`glass-card p-6 shadow-card border-l-4 transition-all duration-300 hover:scale-[1.01] hover:bg-surface-foreground/5 dark:hover:bg-white/5 ${client.status === 'archived' ? 'opacity-60 grayscale' : ''
                }`}
              style={{ borderLeftColor: client.color }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-text dark:text-white group-hover:text-primary transition-colors">{client.name}</h3>
                  <p className="text-sm text-text-muted mt-1">
                    ${client.hourly_rate.toFixed(2)}<span className="text-xs text-text-muted/70">/hr</span>
                  </p>
                  {client.status === 'archived' && (
                    <span className="inline-block mt-2 px-2 py-0.5 text-[10px] uppercase font-bold bg-surface-foreground/10 dark:bg-white/10 text-text-muted/70 dark:text-white/50 rounded">
                      Archived
                    </span>
                  )}
                </div>
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: client.color }}
                />
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => openEditForm(client)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text dark:text-white/70 bg-surface-foreground/5 dark:bg-white/5 hover:bg-surface-foreground/10 dark:hover:bg-white/10 dark:hover:text-white transition-colors border border-border dark:border-white/5"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleArchive(client)}
                  disabled={archivingId === client.id}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border border-border dark:border-white/5 disabled:opacity-50 disabled:cursor-not-allowed ${client.status === 'active'
                    ? 'text-text-muted hover:text-text dark:text-white/70 bg-surface-foreground/5 dark:bg-white/5 hover:bg-surface-foreground/10 dark:hover:bg-white/10 dark:hover:text-white'
                    : 'text-primary bg-primary/10 hover:bg-primary/20'
                    }`}
                >
                  {archivingId === client.id
                    ? 'Processing...'
                    : client.status === 'active' ? 'Archive' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md glass-card bg-surface dark:bg-[#0F172A] p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold text-text dark:text-white">
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text">
                  Client Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                  placeholder="Enter client name"
                />
              </div>

              {/* Hourly Rate Field */}
              <div>
                <label htmlFor="rate" className="block text-sm font-medium text-text">
                  Hourly Rate ($)
                </label>
                <input
                  type="number"
                  id="rate"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-border bg-surface/50 dark:bg-black/20 px-3 py-2 text-sm text-text dark:text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent placeholder:text-text-muted/50 dark:placeholder:text-white/20"
                  placeholder="0.00"
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-sm font-medium text-text">Color</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CLIENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormColor(color)}
                      className={`h-8 w-8 rounded-full transition-transform ${formColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
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
                  className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : editingClient ? 'Save Changes' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
