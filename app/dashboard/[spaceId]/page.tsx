'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSpaceSocket } from '@/lib/socket-client';
import {
  Upload,
  Download,
  Trash2,
  Edit2,
  Users,
  Activity,
  File,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

type FileItem = { id: string; name: string; mimeType: string; size: number; createdAt: string; updatedAt: string; uploadedById: string | null };
type Member = { id: string; userId: string; role: string; user: { id: string; name: string; rollNo: string } };
type ActivityItem = { id: string; action: string; target: string | null; user: { name: string }; createdAt: string };
type SpaceState = { name: string; myRole: string; myUserId?: string; membersOwnFilesOnly?: boolean };

export default function SpacePage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;
  const [space, setSpace] = useState<SpaceState | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const canUpload = space?.myRole === 'admin' || space?.myRole === 'member';
  const canManageFile = (file: FileItem) => {
    if (!space) return false;
    if (space.myRole === 'admin') return true;
    if (space.membersOwnFilesOnly) return file.uploadedById === space.myUserId;
    return space.myRole === 'member';
  };
  const canDelete = space?.myRole === 'admin' || space?.myRole === 'member';

  const fetchSpace = useCallback(() => {
    api<SpaceState>(`/api/spaces/${spaceId}`).then(setSpace);
  }, [spaceId]);

  const fetchFiles = useCallback(() => {
    api<FileItem[]>(`/api/spaces/${spaceId}/files`).then(setFiles);
  }, [spaceId]);

  const fetchMembers = useCallback(() => {
    api<Member[]>(`/api/spaces/${spaceId}/members`).then(setMembers);
  }, [spaceId]);

  const fetchActivity = useCallback(() => {
    api<{ items: ActivityItem[]; nextCursor: string | null }>(`/api/spaces/${spaceId}/activity`).then((r) => setActivity(r.items));
  }, [spaceId]);

  useEffect(() => {
    Promise.all([fetchSpace(), fetchFiles(), fetchMembers(), fetchActivity()]).finally(() => setLoading(false));
  }, [fetchSpace, fetchFiles, fetchMembers, fetchActivity]);

  const refetchAll = useCallback(() => {
    fetchSpace();
    fetchFiles();
    fetchMembers();
    fetchActivity();
  }, [fetchSpace, fetchFiles, fetchMembers, fetchActivity]);

  useSpaceSocket(spaceId, {
    files: (data: unknown) => {
      const fileData = data as FileItem;
      setFiles((f) => {
        const idx = f.findIndex((x) => x.id === fileData.id);
        if (idx >= 0) return f.map((x, i) => (i === idx ? fileData : x));
        return [fileData, ...f];
      });
    },
    fileDeleted: (data) => setFiles((f) => f.filter((x) => x.id !== data.id)),
    members: () => fetchMembers(),
    activity: () => fetchActivity(),
  }, { refetch: refetchAll });

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api<FileItem>(`/api/spaces/${spaceId}/files`, {
        method: 'POST',
        body: form,
      });
      await fetchFiles();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const download = (file: FileItem) => {
    window.open(`/api/spaces/${spaceId}/files/${file.id}`, '_blank');
  };

  const remove = async (file: FileItem) => {
    if (!confirm(`Delete "${file.name}"?`)) return;
    try {
      await api(`/api/spaces/${spaceId}/files/${file.id}`, { method: 'DELETE' });
      setFiles((f) => f.filter((x) => x.id !== file.id));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const startRename = (file: FileItem) => {
    setEditing(file.id);
    setEditName(file.name);
  };

  const saveRename = async () => {
    if (!editing || !editName.trim()) return;
    try {
      const updated = await api<FileItem>(`/api/spaces/${spaceId}/files/${editing}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      setFiles((f) => f.map((x) => (x.id === editing ? updated : x)));
      setEditing(null);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const actionLabel = (a: ActivityItem) => {
    const u = a.user?.name || 'Someone';
    switch (a.action) {
      case 'upload': return `${u} uploaded ${a.target}`;
      case 'delete': return `${u} deleted ${a.target}`;
      case 'rename': return `${u} renamed to ${a.target}`;
      case 'member_add': return `${u} added ${a.target}`;
      case 'member_remove': return `${u} removed ${a.target}`;
      case 'member_role': return `${u} changed role for ${a.target}`;
      case 'space_rename': return `${u} renamed space to ${a.target}`;
      default: return `${u} ${a.action} ${a.target || ''}`;
    }
  };

  if (loading) return <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto" size={32} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="p-2 rounded-lg hover:bg-[var(--border)] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold">{space?.name}</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium flex items-center gap-2"><File size={18} /> Files</h2>
            {canUpload && (
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm cursor-pointer hover:opacity-90">
                <Upload size={16} />
                {uploading ? 'Uploading...' : 'Upload'}
                <input type="file" className="hidden" onChange={upload} disabled={uploading} />
              </label>
            )}
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
            {files.length === 0 ? (
              <div className="p-8 text-center text-[var(--muted)]">No files yet</div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg)]/50 transition-colors">
                    {editing === f.id ? (
                      <>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 rounded border border-[var(--border)] bg-transparent"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                        />
                        <button onClick={saveRename} className="text-sm text-[var(--accent)]">Save</button>
                        <button onClick={() => setEditing(null)} className="text-sm text-[var(--muted)]">Cancel</button>
                      </>
                    ) : (
                      <>
                        <File size={18} className="text-[var(--muted)] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{f.name}</p>
                          <p className="text-sm text-[var(--muted)]">{formatSize(f.size)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {canManageFile(f) && (
                            <>
                              <button onClick={() => download(f)} className="p-2 rounded hover:bg-[var(--border)]" title="Download">
                                <Download size={16} />
                              </button>
                              {canDelete && (
                                <>
                                  <button onClick={() => startRename(f)} className="p-2 rounded hover:bg-[var(--border)]" title="Rename">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => remove(f)} className="p-2 rounded hover:bg-red-500/20 text-red-500" title="Delete">
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="font-medium flex items-center gap-2 mb-3"><Users size={18} /> Members</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-2 max-h-48 overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium">{m.user.name}</p>
                    <p className="text-[var(--muted)]">{m.user.rollNo}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-[var(--border)]">{m.role}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-medium flex items-center gap-2 mb-3"><Activity size={18} /> Activity</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-2 max-h-64 overflow-y-auto">
              {activity.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No activity yet</p>
              ) : (
                activity.map((a) => (
                  <p key={a.id} className="text-sm">
                    {actionLabel(a)}
                    <span className="text-[var(--muted)] ml-1">{new Date(a.createdAt).toLocaleDateString()}</span>
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
