'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMatrix } from '@/lib/matrix-provider';

export function UserProfile() {
  const router = useRouter();
  const { session, logout } = useMatrix();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  if (!session) return null;
  const localpart = session.userId.replace(/^@/, '').split(':')[0] ?? session.userId;

  async function onLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800/60"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
          {localpart.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {localpart}
          </p>
          <p className="truncate text-xs text-slate-400">{session.userId}</p>
        </div>
      </button>

      {open && (
        <div className="absolute bottom-14 left-2 right-2 z-10 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => router.push('/settings')}
            className="block w-full rounded px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Configuración
          </button>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="block w-full rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
