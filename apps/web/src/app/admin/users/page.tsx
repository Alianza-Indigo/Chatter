'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';

interface SynapseUser {
  userId: string;
  displayName: string | null;
  deactivated: boolean;
  admin: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<SynapseUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ localpart: '', password: '', displayName: '' });

  async function load() {
    try {
      const r = await adminFetch<{ users: SynapseUser[] }>('/api/admin/users');
      setUsers(r.users);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await adminFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ localpart: '', password: '', displayName: '' });
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Error');
    } finally {
      setCreating(false);
    }
  }

  async function deactivate(userId: string) {
    if (!window.confirm(`¿Dar de baja a ${userId}? Esta acción cierra su acceso.`)) return;
    try {
      await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/deactivate`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  async function resetPw(userId: string) {
    const pw = window.prompt(`Nueva contraseña para ${userId} (mín. 8):`);
    if (!pw) return;
    try {
      await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password: pw }),
      });
      window.alert('Contraseña actualizada.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800 dark:text-slate-100">Usuarios</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={createUser} className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Usuario (localpart)</span>
          <input className="input" value={form.localpart} onChange={(e) => setForm({ ...form, localpart: e.target.value.toLowerCase() })} required />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Contraseña</span>
          <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Nombre visible</span>
          <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        </label>
        <button type="submit" disabled={creating} className="btn-primary text-sm">
          {creating ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className="px-4 py-2">Usuario</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <tr key={u.userId} className="bg-white dark:bg-slate-900">
                <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">{u.userId}</td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{u.displayName ?? '—'}</td>
                <td className="px-4 py-2">
                  {u.deactivated ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">Baja</span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Activo</span>
                  )}
                  {u.admin && <span className="ml-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">admin</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  {!u.deactivated && (
                    <>
                      <button type="button" onClick={() => resetPw(u.userId)} className="text-xs text-brand hover:underline">Reset pass</button>
                      <button type="button" onClick={() => deactivate(u.userId)} className="ml-3 text-xs text-red-600 hover:underline">Dar de baja</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Sin usuarios (o Synapse Admin API no configurada).</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
