'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Plus, FolderOpen } from 'lucide-react';

type Space = {
  id: string;
  name: string;
  role: string;
  owner: { id: string; name: string; email: string };
  fileCount: number;
  memberCount: number;
  createdAt: string;
};

export default function DashboardPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchSpaces = () => api<Space[]>('/api/spaces').then(setSpaces).finally(() => setLoading(false));

  useEffect(() => {
    fetchSpaces();
  }, []);

  const createSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const space = await api<Space>('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setSpaces((s) => [space, ...s]);
      setNewName('');
      setShowForm(false);
      window.location.href = `/dashboard/${space.id}`;
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-[var(--muted)]">Loading spaces...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Your Spaces</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          New Space
        </button>
      </div>
      {showForm && (
        <form onSubmit={createSpace} className="mb-6 p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] flex gap-2">
          <input
            type="text"
            placeholder="Space name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent focus:ring-2 focus:ring-[var(--accent)] outline-none"
            autoFocus
          />
          <button type="submit" disabled={creating} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm disabled:opacity-50">
            Create
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm">
            Cancel
          </button>
        </form>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {spaces.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/${s.id}`}
            className="block p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                <FolderOpen size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-medium truncate group-hover:text-[var(--accent)] transition-colors">{s.name}</h2>
                <p className="text-sm text-[var(--muted)] mt-0.5">
                  {s.fileCount} files · {s.memberCount} members
                </p>
                <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-[var(--border)]">{s.role}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {spaces.length === 0 && !showForm && (
        <div className="text-center py-16 text-[var(--muted)]">
          <FolderOpen size={48} className="mx-auto mb-4 opacity-50" />
          <p>No spaces yet. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}
