'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ArrowLeft, Trash2, UserPlus, Link2, Copy } from 'lucide-react';

type Member = { id: string; userId: string; role: string; user: { id: string; name: string; rollNo: string } };

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;
  const [space, setSpace] = useState<{ name: string; myRole: string; membersOwnFilesOnly?: boolean; inviteToken?: string | null; defaultJoinRole?: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteRollNo, setInviteRollNo] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [membersOwnFilesOnly, setMembersOwnFilesOnly] = useState(false);
  const [defaultJoinRole, setDefaultJoinRole] = useState<'member' | 'viewer'>('member');
  const [deleting, setDeleting] = useState(false);

  const isAdmin = space?.myRole === 'admin';
  const inviteUrl = space?.inviteToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join?token=${space.inviteToken}`
    : '';

  useEffect(() => {
    if (space?.membersOwnFilesOnly !== undefined) setMembersOwnFilesOnly(space.membersOwnFilesOnly);
    if (space?.defaultJoinRole) setDefaultJoinRole(space.defaultJoinRole as 'member' | 'viewer');
  }, [space?.membersOwnFilesOnly, space?.defaultJoinRole]);

  useEffect(() => {
    api<{ name: string; myRole: string; membersOwnFilesOnly?: boolean; inviteToken?: string | null; defaultJoinRole?: string }>(`/api/spaces/${spaceId}`).then((s) => {
      setSpace(s);
      setSpaceName(s.name);
      if (s.defaultJoinRole) setDefaultJoinRole(s.defaultJoinRole as 'member' | 'viewer');
    });
    api<Member[]>(`/api/spaces/${spaceId}/members`).then(setMembers);
  }, [spaceId]);

  useEffect(() => {
    if (space && members.length) setLoading(false);
  }, [space, members]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteRollNo.trim()) return;
    setInviting(true);
    try {
      const list = await api<Member[]>(`/api/spaces/${spaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNo: inviteRollNo.trim(), role: inviteRole }),
      });
      setMembers(list);
      setInviteRollNo('');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setInviting(false);
    }
  };

  const updateRole = async (memberId: string, role: string) => {
    try {
      await api(`/api/spaces/${spaceId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      setMembers((m) => m.map((x) => (x.id === memberId ? { ...x, role } : x)));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const copyInviteLink = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      alert('Link copied to clipboard');
    }
  };

  const saveDefaultJoinRole = async (role: 'member' | 'viewer') => {
    setDefaultJoinRole(role);
    setSaving(true);
    try {
      await api(`/api/spaces/${spaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultJoinRole: role }),
      });
      setSpace((s) => (s ? { ...s, defaultJoinRole: role } : null));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Remove this member?')) return;
    try {
      await api(`/api/spaces/${spaceId}/members/${memberId}`, { method: 'DELETE' });
      setMembers((m) => m.filter((x) => x.id !== memberId));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const saveSpace = async () => {
    if (!spaceName.trim() || spaceName === space?.name) return;
    setSaving(true);
    try {
      await api(`/api/spaces/${spaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: spaceName.trim() }),
      });
      setSpace((s) => (s ? { ...s, name: spaceName.trim() } : null));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveMembersOwnFilesOnly = async (value: boolean) => {
    setSaving(true);
    try {
      await api(`/api/spaces/${spaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membersOwnFilesOnly: value }),
      });
      setMembersOwnFilesOnly(value);
      setSpace((s) => (s ? { ...s, membersOwnFilesOnly: value } : null));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSpace = async () => {
    if (!confirm('Delete this space? All files will be removed.')) return;
    setDeleting(true);
    try {
      await api(`/api/spaces/${spaceId}`, { method: 'DELETE' });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="py-12 text-center">Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/${spaceId}`} className="p-2 rounded-lg hover:bg-[var(--border)] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold">Space Settings</h1>
      </div>

      {isAdmin && (
        <>
          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-medium mb-3">Space Name</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent"
              />
              <button onClick={saveSpace} disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm disabled:opacity-50">
                Save
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-medium mb-3">File access</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={membersOwnFilesOnly}
                onChange={(e) => saveMembersOwnFilesOnly(e.target.checked)}
                disabled={saving}
                className="rounded"
              />
              <span className="text-sm">Members can only download, rename, and delete their own files (admins have full access)</span>
            </label>
          </div>

          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-medium mb-3 flex items-center gap-2"><Link2 size={18} /> Invite link</h2>
            <p className="text-sm text-[var(--muted)] mb-3">This link is created with the space. Share it—anyone with it can join after signing in. No expiration or join limit.</p>
            <div className="flex gap-2 items-center flex-wrap mb-2">
              <span className="text-sm text-[var(--muted)]">New joiners get role:</span>
              <select
                value={defaultJoinRole}
                onChange={(e) => saveDefaultJoinRole(e.target.value as 'member' | 'viewer')}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-transparent text-sm"
              >
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            {inviteUrl ? (
              <div className="flex gap-2">
                <input type="text" readOnly value={inviteUrl} className="flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-transparent text-sm" />
                <button onClick={copyInviteLink} className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--border)]" title="Copy">
                  <Copy size={18} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Loading link...</p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
            <h2 className="font-medium mb-3 flex items-center gap-2"><UserPlus size={18} /> Invite by roll number</h2>
            <form onSubmit={invite} className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Roll number"
                value={inviteRollNo}
                onChange={(e) => setInviteRollNo(e.target.value)}
                className="flex-1 min-w-[180px] px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'member' | 'viewer')}
                className="px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent"
              >
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" disabled={inviting} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm disabled:opacity-50">
                Invite
              </button>
            </form>
          </div>
        </>
      )}

      <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)]">
        <h2 className="font-medium mb-3">Members</h2>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
              <div>
                <p className="font-medium">{m.user.name}</p>
                <p className="text-sm text-[var(--muted)]">{m.user.rollNo}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && m.role !== 'admin' ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => updateRole(m.id, e.target.value)}
                      className="text-sm px-2 py-1 rounded border border-[var(--border)] bg-transparent"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button onClick={() => removeMember(m.id)} className="p-2 rounded hover:bg-red-500/20 text-red-500" title="Remove">
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <span className="text-sm px-2 py-0.5 rounded bg-[var(--border)]">{m.role}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
          <h2 className="font-medium text-red-500 mb-2">Danger Zone</h2>
          <p className="text-sm text-[var(--muted)] mb-3">Deleting this space will remove all files and members.</p>
          <button onClick={deleteSpace} disabled={deleting} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm disabled:opacity-50">
            {deleting ? 'Deleting...' : 'Delete Space'}
          </button>
        </div>
      )}
    </div>
  );
}
