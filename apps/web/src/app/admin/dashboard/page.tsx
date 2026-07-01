'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';

interface Status {
  time: string;
  services: { api: boolean; dbApp: boolean; synapse: boolean; push: boolean };
  counts: { tenants: number; invitationsPending: number; botErrors24h: number };
}

export default function DashboardPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setStatus(await adminFetch<Status>('/api/admin/status'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-800 dark:text-slate-100">
        Estado del sistema
      </h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Service label="API" ok={status?.services.api} />
        <Service label="Base de datos" ok={status?.services.dbApp} />
        <Service label="Synapse (Matrix)" ok={status?.services.synapse} />
        <Service label="Web Push" ok={status?.services.push} optional />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Organizaciones" value={status?.counts.tenants} />
        <Stat label="Invitaciones pendientes" value={status?.counts.invitationsPending} />
        <Stat label="Errores del bot (24h)" value={status?.counts.botErrors24h} danger />
      </div>

      {status && (
        <p className="mt-6 text-xs text-slate-400">
          Actualizado: {new Date(status.time).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

function Service({ label, ok, optional }: { label: string; ok?: boolean; optional?: boolean }) {
  const color =
    ok === undefined
      ? 'bg-slate-300'
      : ok
        ? 'bg-emerald-500'
        : optional
          ? 'bg-amber-400'
          : 'bg-red-500';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {ok === undefined ? '…' : ok ? 'Operativo' : optional ? 'No configurado' : 'Caído'}
      </p>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value?: number; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`mt-1 text-3xl font-bold ${
          danger && (value ?? 0) > 0 ? 'text-red-600' : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {value ?? '—'}
      </p>
    </div>
  );
}
