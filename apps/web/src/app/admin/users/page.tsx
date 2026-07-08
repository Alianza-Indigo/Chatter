'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';

interface UserOrg {
  id: string;
  name: string;
  slug: string;
  code: string | null;
}

interface SynapseUser {
  userId: string;
  displayName: string | null;
  deactivated: boolean;
  admin: boolean;
  org: UserOrg | null;
}

export default function UsersPage() {
  const [users, setUsers] = useState<SynapseUser[]>([]);
  const [orgFilter, setOrgFilter] = useState<string>('all');
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

  // Solo activos: al dar de baja, el usuario desaparece de la lista.
  const active = users.filter((u) => !u.deactivated);
  // Organizaciones presentes, general (sin código) primero, luego por nombre.
  const orgs = Array.from(
    new Map(active.filter((u) => u.org).map((u) => [u.org!.id, u.org!])).values(),
  ).sort((a, b) => (a.code === null ? 0 : 1) - (b.code === null ? 0 : 1) || a.name.localeCompare(b.name));

  const noOrg = active.filter((u) => !u.org);
  const allGroups: { key: string; org: UserOrg | null; users: SynapseUser[] }[] = [
    ...orgs.map((o) => ({ key: o.id, org: o, users: active.filter((u) => u.org?.id === o.id) })),
    ...(noOrg.length ? [{ key: 'none', org: null, users: noOrg }] : []),
  ];
  const groups = orgFilter === 'all' ? allGroups : allGroups.filter((g) => g.key === orgFilter);

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
    if (!window.confirm(`¿Dar de baja a ${userId}? Cierra su acceso y lo saca de su organización.`)) return;
    setError(null);
    try {
      await adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/deactivate`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? `No se pudo dar de baja: ${e.message}` : 'Error');
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Usuarios</h1>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          Organización:
          <select className="input w-auto" value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}>
            <option value="all">Todas ({active.length})</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.code ? ` · ${o.code}` : ' · general'} (
                {active.filter((u) => u.org?.id === o.id).length})
              </option>
            ))}
            {noOrg.length > 0 && <option value="none">Sin organización ({noOrg.length})</option>}
          </select>
        </label>
      </div>
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

      {groups.length === 0 && (
        <p className="text-sm text-slate-400">Sin usuarios (o Synapse Admin API no configurada).</p>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.key}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {g.org ? g.org.name : 'Sin organización'}
              </h2>
              {g.org?.code ? (
                <span className="rounded bg-brand/10 px-2 py-0.5 font-mono text-[11px] text-brand">{g.org.code}</span>
              ) : g.org ? (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400 dark:bg-slate-800">general</span>
              ) : null}
              <span className="text-xs text-slate-400">{g.users.length}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-4 py-2">Usuario</th>
                    <th className="px-4 py-2">Nombre</th>
                    <th className="px-4 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {g.users.map((u) => (
                    <tr key={u.userId} className="bg-white dark:bg-slate-900">
                      <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                        {u.userId}
                        {u.admin && <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand">admin</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{u.displayName ?? '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={() => resetPw(u.userId)} className="text-xs text-brand hover:underline">Reset pass</button>
                        <button type="button" onClick={() => deactivate(u.userId)} className="ml-3 text-xs text-red-600 hover:underline">Dar de baja</button>
                      </td>
                    </tr>
                  ))}
                  {g.users.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Sin usuarios.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
