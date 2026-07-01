'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { config } from '@/lib/config';

interface InviteInfo {
  status: string;
  email: string;
  localpart: string;
  role: string;
  tenantName: string;
  matrixServerName: string;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${config.apiUrl}/api/invitations/${token}`);
        if (!res.ok) throw new Error('Invitación no encontrada.');
        setInfo((await res.json()) as InviteInfo);
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : 'Error');
      }
    })();
  }, [token]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${config.apiUrl}/api/invitations/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password, displayName: displayName || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string; message?: string };
        throw new Error(body.message ?? body.error ?? 'No se pudo aceptar la invitación.');
      }
      setDone(true);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-indigo-50 to-lavender-300/30 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loadErr && <p className="text-sm text-red-600">{loadErr}</p>}

        {!loadErr && !info && <p className="text-sm text-slate-400">Cargando…</p>}

        {info && info.status !== 'pending' && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Esta invitación ya no está disponible (estado: {info.status}).
          </p>
        )}

        {info && info.status === 'pending' && !done && (
          <>
            <h1 className="mb-1 text-xl font-semibold text-slate-800 dark:text-slate-100">
              Únete a {info.tenantName}
            </h1>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              Tu identidad será{' '}
              <span className="font-mono text-brand">@{info.localpart}:{info.matrixServerName}</span>
            </p>
            <form onSubmit={accept} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre visible (opcional)</span>
                <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Contraseña</span>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              </label>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Activando…' : 'Crear mi cuenta'}
              </button>
            </form>
          </>
        )}

        {done && (
          <div className="text-center">
            <h1 className="mb-2 text-xl font-semibold text-slate-800 dark:text-slate-100">¡Cuenta creada! 🎉</h1>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Ya puedes iniciar sesión con tu usuario y contraseña.</p>
            <button type="button" onClick={() => router.push('/login')} className="btn-primary w-full">Ir a iniciar sesión</button>
          </div>
        )}
      </div>
    </div>
  );
}
