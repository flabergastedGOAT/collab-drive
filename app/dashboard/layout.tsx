'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import { Sun, Moon, LogOut, FolderOpen } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [user, setUser] = useState<{ name: string; rollNo: string } | null>(null);

  useEffect(() => {
    api<{ name: string; rollNo: string }>('/api/auth/me')
      .then(setUser)
      .catch(() => router.push('/'));
  }, [router]);

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const spaceId = pathname.split('/')[2];
  const isSettings = pathname.includes('/settings');

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-[var(--text)] hover:opacity-80 transition-opacity">
            <FolderOpen size={20} />
            CollabDrive
          </Link>
          <div className="flex items-center gap-2">
            {spaceId && !isSettings && (
              <Link
                href={`/dashboard/${spaceId}/settings`}
                className="text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors"
              >
                Settings
              </Link>
            )}
            <span className="text-sm text-[var(--muted)] hidden sm:inline">{user.rollNo}</span>
            <button onClick={toggle} className="p-2 rounded-lg hover:bg-[var(--border)] transition-colors" aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={logout} className="p-2 rounded-lg hover:bg-[var(--border)] transition-colors" aria-label="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
