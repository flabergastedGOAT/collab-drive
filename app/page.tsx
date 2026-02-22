'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const setupError = searchParams.get('error');
    if (setupError) setError(decodeURIComponent(setupError));
  }, [searchParams]);

  const redirectTo = searchParams.get('redirect') || '/dashboard';

  useEffect(() => {
    api('/api/auth/me').then(() => router.push(redirectTo)).catch(() => {});
  }, [router, redirectTo]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await api('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rollNo, password }),
        });
      } else {
        await api('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rollNo, password, name }),
        });
      }
      router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg)]">
      <button
        onClick={toggle}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[var(--border)] transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">CollabDrive</h1>
        {searchParams.get('setup') === 'success' && (
          <p className="mb-4 p-3 rounded-lg bg-green-500/20 text-green-600 dark:text-green-400 text-sm text-center">
            Google Drive connected! Restart the server and try uploading.
          </p>
        )}
        <p className="text-center text-sm text-[var(--muted)] mb-2">
          <a href="/api/auth/google/setup" className="underline hover:text-[var(--accent)]">
            Connect Google Drive
          </a>{' '}
          (one-time setup)
        </p>
        <form onSubmit={submit} className="space-y-4 p-6 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all"
              required
            />
          )}
          <input
            type="text"
            placeholder="Roll number"
            value={rollNo}
            onChange={(e) => setRollNo(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-[var(--border)] bg-transparent focus:ring-2 focus:ring-[var(--accent)] outline-none transition-all"
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? '...' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="w-full text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
