'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Client, ClientInsert, ClientUpdate } from '@/types/database';

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
  }

  async function handleArchive(client: Client) {
    const newStatus = client.status === 'active' ? 'archived' : 'active';
    const action = newStatus === 'archived' ? 'archive' : 'restore';

    if (!confirm(`Are you sure you want to ${action} "${client.name}"?`)) {
      return;
    }

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
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text">Clients</h1>
        <button
          onClick={openAddForm}
          className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
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
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
        <label htmlFor="showArchived" className="text-sm text-text-muted">
          Show archived clients
        </label>
      </div>

      {/* Client List */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Loading clients...</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-muted">
            {showArchived ? 'No clients found.' : 'No active clients. Add your first client!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <div
              key={client.id}
              className={`rounded-card bg-background p-4 shadow-card border-l-4 ${
                client.status === 'archived' ? 'opacity-60' : ''
              }`}
              style={{ borderLeftColor: client.color }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-text">{client.name}</h3>
                  <p className="text-sm text-text-muted">
                    ${client.hourly_rate.toFixed(2)}/hr
                  </p>
                  {client.status === 'archived' && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                      Archived
                    </span>
                  )}
                </div>
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: client.color }}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openEditForm(client)}
                  className="rounded-button px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleArchive(client)}
                  className={`rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${
                    client.status === 'active'
                      ? 'text-text-muted hover:bg-gray-100'
                      : 'text-primary hover:bg-primary-light'
                  }`}
                >
                  {client.status === 'active' ? 'Archive' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-card bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-text">
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
                  className="mt-1 w-full rounded-button border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                  className="mt-1 w-full rounded-button border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                      className={`h-8 w-8 rounded-full transition-transform ${
                        formColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
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
                  className="rounded-button px-4 py-2 text-sm font-medium text-text-muted hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                >
                  {editingClient ? 'Save Changes' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
