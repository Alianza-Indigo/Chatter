'use client';

import { useEffect, useState } from 'react';
import type { Tenant } from '@whalabi/shared';
import { adminFetch } from '@/lib/admin';

interface Invitation {
  id: string;
  email: string;
  localpart: string;
  role: string;
  status: string;
  expiresAt: string;
  activationUrl: string;
}

export default function InvitationsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ tenantId: '', email: '', localpart: '', role: 'user', expiresInHours: 72 });
  const [lastLink, setLastLink] = useState<string | null>(null);

  async function load() {
    try {
      const [ts, invs] = await Promise.all([
        adminFetch<Tenant[]>('/api/admin/tenants'),
        adminFetch<Invitation[]>('/api/admin/invitations'),
      ]);
      setTenants(ts);
      setInvitations(invs);
      if (!form.tenantId && ts[0]) setForm((f) => ({ ...f, tenantId: ts[0]!.id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await adminFetch<{ activationUrl: string }>('/api/admin/invitations', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setLastLink(r.activationUrl);
      setForm((f) => ({ ...f, email: '', localpart: '' }));
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Error');
    }
  }

  async function revoke(id: string) {
    try {
      await adminFetch(`/api/admin/invitations/${id}/revoke`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800 dark:text-slate-100">Invitaciones</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={create} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-5">
        <select className="input" value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} required>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className="input" type="email" placeholder="correo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="input" placeholder="usuario" value={form.localpart} onChange={(e) => setForm({ ...form, localpart: e.target.value.toLowerCase() })} required />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="user">user</option>
          <option value="admin">admin</option>
          <option value="owner">owner</option>
        </select>
        <button type="submit" className="btn-primary text-sm">Invitar</button>
      </form>

      {lastLink && (
        <div className="mb-6 rounded-lg border border-brand/30 bg-brand/5 p-3 text-sm">
          <p className="mb-1 font-medium text-brand">Liga de activación (compártela):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs dark:bg-slate-800">{lastLink}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(lastLink)} className="text-xs text-brand hover:underline">Copiar</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60">
            <tr><th className="px-4 py-2">Correo</th><th className="px-4 py-2">Usuario</th><th className="px-4 py-2">Rol</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {invitations.map((i) => (
              <tr key={i.id} className="bg-white dark:bg-slate-900">
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{i.email}</td>
                <td className="px-4 py-2 font-mono text-xs">{i.localpart}</td>
                <td className="px-4 py-2">{i.role}</td>
                <td className="px-4 py-2"><StatusBadge status={i.status} /></td>
                <td className="px-4 py-2 text-right">
                  <button type="button" onClick={() => navigator.clipboard?.writeText(i.activationUrl)} className="text-xs text-brand hover:underline">Copiar liga</button>
                  {i.status === 'pending' && (
                    <button type="button" onClick={() => revoke(i.id)} className="ml-3 text-xs text-red-600 hover:underline">Revocar</button>
                  )}
                </td>
              </tr>
            ))}
            {invitations.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin invitaciones.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    expired: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    revoked: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${map[status] ?? ''}`}>{status}</span>;
}
