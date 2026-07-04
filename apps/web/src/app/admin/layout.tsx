'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminLogin, getAdminToken, clearAdminToken } from '@/lib/admin';

const NAV = [
  { href: '/admin/dashboard', label: 'Estado' },
  { href: '/admin/tenants', label: 'Organizaciones' },
  { href: '/admin/users', label: 'Usuarios' },
  { href: '/admin/invitations', label: 'Invitaciones' },
  { href: '/admin/logs', label: 'Logs' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setAuthed(Boolean(getAdminToken()));
    const onAuthError = () => setAuthed(false);
    window.addEventListener('whalabi:admin-unauth', onAuthError);
    return () => window.removeEventListener('whalabi:admin-unauth', onAuthError);
  }, []);

  if (authed === null) return null;
  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />;

  return (
    <div className="flex min-h-[100dvh] bg-slate-100 dark:bg-slate-950">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-bold text-white">
            W
          </div>
          <span className="font-semibold text-slate-800 dark:text-slate-100">Whalabi Admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                pathname === item.href
                  ? 'bg-brand/10 font-medium text-brand'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => {
            clearAdminToken();
            setAuthed(false);
          }}
          className="mt-4 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          Cerrar sesión
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await adminLogin(token.trim());
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h1 className="mb-1 text-xl font-semibold text-slate-800 dark:text-slate-100">
          Panel de administración
        </h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Introduce el token de administración (ADMIN_API_TOKEN).
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ADMIN_API_TOKEN"
          className="input mb-3"
          required
        />
        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
