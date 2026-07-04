'use client';

import { useEffect, useState } from 'react';
import type { Organization, Tenant } from '@whalabi/shared';
import { adminFetch } from '@/lib/admin';

/**
 * Gestión de organizaciones (códigos). Nivel superior del panel: cada
 * organización es un Espacio Matrix aislado; quien se registra con su código
 * solo se descubre y contacta con su organización. Sin código, el usuario entra
 * al espacio Global (todos entre sí).
 *
 * Las organizaciones viven dentro de un "dominio" (tenant). En la mayoría de las
 * instalaciones hay un solo dominio, así que se selecciona automáticamente; si
 * hay varios, aparece un selector.
 */
export default function OrganizationsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await adminFetch<Tenant[]>('/api/admin/tenants');
        setTenants(list);
        const preferred = list.find((t) => t.slug === 'default') ?? list[0];
        if (preferred) setTenantId(preferred.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Organizaciones</h1>
        {tenants.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-slate-500">
            Dominio:
            <select
              className="input w-auto"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.publicDomain})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {tenantId ? (
        <OrgManager tenantId={tenantId} />
      ) : (
        !error && <p className="text-sm text-slate-400">Cargando…</p>
      )}
    </div>
  );
}

function OrgManager({ tenantId }: { tenantId: string }) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setOrgs(await adminFetch<Organization[]>(`/api/admin/tenants/${tenantId}/orgs`));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await adminFetch(`/api/admin/tenants/${tenantId}/orgs`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), code: code.trim() || undefined }),
      });
      setName('');
      setCode('');
      setMsg('Organización creada ✓');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Al crear una organización se genera su Espacio Matrix aislado. Comparte el
        código con sus integrantes: quien lo use al registrarse solo verá y podrá
        contactar a su organización. Sin código, el usuario entra al espacio general.
      </p>

      {/* Crear */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Nueva organización
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-40 flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Nombre</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Clínica San Rafael" />
          </label>
          <label className="min-w-40 flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Código (opcional)</span>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="se genera del nombre" autoCapitalize="none" />
          </label>
          <button type="button" onClick={create} disabled={busy || !name.trim()} className="btn-primary shrink-0 text-sm">
            {busy ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Organizaciones existentes
        </h2>
        {orgs.length > 0 ? (
          <div className="space-y-2">
            {orgs.map((o) => (
              <OrgRow key={o.id} tenantId={tenantId} org={o} onChanged={load} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Aún no hay organizaciones con código.</p>
        )}
      </div>

      {/* Backfill */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              const r = await adminFetch<{ joined: number; total: number }>(
                `/api/admin/tenants/${tenantId}/global/backfill`,
                { method: 'POST' },
              );
              setMsg(`Unidos ${r.joined}/${r.total} usuarios al espacio Global ✓`);
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'Error');
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Unir usuarios existentes al espacio Global
        </button>
        <span className="text-xs text-slate-400">Úsalo una vez al activar el multitenant.</span>
      </div>

      {msg && <p className="text-sm text-slate-500">{msg}</p>}
    </div>
  );
}

/**
 * Fila editable de una organización: renombrar, cambiar el código, copiarlo y
 * borrarla. Cambiar el código no afecta a los miembros actuales; solo cambia lo
 * que teclean los nuevos al registrarse.
 */
function OrgRow({
  tenantId,
  org,
  onChanged,
}: {
  tenantId: string;
  org: Organization;
  onChanged: () => void;
}) {
  const [name, setName] = useState(org.name);
  const [code, setCode] = useState(org.code);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setName(org.name);
    setCode(org.code);
  }, [org.name, org.code]);

  const dirty = name.trim() !== org.name || code.trim() !== org.code;

  async function copy() {
    try {
      await navigator.clipboard.writeText(org.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard no disponible */
    }
  }

  async function save() {
    if (!dirty || !name.trim() || !code.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await adminFetch(`/api/admin/tenants/${tenantId}/orgs/${org.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), code: code.trim() }),
      });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`¿Borrar la organización "${org.name}"? El código dejará de funcionar. El espacio y sus miembros permanecen en Matrix.`)) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await adminFetch(`/api/admin/tenants/${tenantId}/orgs/${org.id}`, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-32 flex-1">
          <span className="mb-1 block text-[11px] font-medium text-slate-400">Nombre</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="min-w-32 flex-1">
          <span className="mb-1 block text-[11px] font-medium text-slate-400">Código</span>
          <div className="flex gap-1">
            <input
              className="input font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoCapitalize="none"
            />
            <button
              type="button"
              onClick={copy}
              title="Copiar código"
              className="shrink-0 rounded-lg border border-slate-300 px-2 text-sm text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {copied ? '✓' : 'Copiar'}
            </button>
          </div>
        </label>
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty || !name.trim() || !code.trim()}
          className="btn-primary shrink-0 text-sm disabled:opacity-40"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          title="Borrar organización"
          className="shrink-0 rounded-lg border border-red-200 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900/50 dark:hover:bg-red-950/30"
        >
          Borrar
        </button>
      </div>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
