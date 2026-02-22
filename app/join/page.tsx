'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function JoinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [invite, setInvite] = useState<{ spaceName: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }
    api<{ spaceName: string; role: string }>(`/api/join?token=${token}`)
      .then(setInvite)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
    api<{ id: string }>('/api/auth/me').then(setUser).catch(() => setUser(null));
  }, [token]);

  const join = async () => {
    if (!token || !user) return;
    setJoining(true);
    setError('');
    try {
      const { spaceId } = await api<{ spaceId: string; spaceName: string }>('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      router.push(`/dashboard/${spaceId}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (error && !invite) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg)]">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href="/" className="text-[var(--accent)] underline">Go to home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg)]">
      <div className="w-full max-w-sm p-6 rounded-xl bg-[var(--card)] border border-[var(--border)]">
        <h1 className="text-xl font-semibold text-center mb-2">Join space</h1>
        {invite && (
          <p className="text-center text-[var(--muted)] mb-6">
            You&apos;ve been invited to join <strong>{invite.spaceName}</strong> as <strong>{invite.role}</strong>
          </p>
        )}
        {user ? (
          <>
            {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
            <button
              onClick={join}
              disabled={joining}
              className="w-full py-2 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-50"
            >
              {joining ? 'Joining...' : 'Join space'}
            </button>
          </>
        ) : (
          <p className="text-center text-sm text-[var(--muted)] mb-4">
            Sign in to join this space
          </p>
        )}
        <Link href={user ? '/dashboard' : `/?redirect=${encodeURIComponent(`/join?token=${token}`)}`} className="block text-center text-sm text-[var(--muted)] mt-4 hover:text-[var(--text)]">
          {user ? 'Back to dashboard' : 'Sign in'}
        </Link>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <JoinPageContent />
    </Suspense>
  );
}
