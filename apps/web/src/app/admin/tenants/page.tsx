'use client';

import { useEffect, useState } from 'react';
import type { Tenant } from '@whalabi/shared';
import { adminFetch } from '@/lib/admin';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const list = await adminFetch<Tenant[]>('/api/admin/tenants');
      setTenants(list);
      if (selected) setSelected(list.find((t) => t.id === selected.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex gap-6">
      <div className="w-64 shrink-0">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Organizaciones
          </h1>
          <button
            type="button"
            onClick={() => setSelected(emptyTenant())}
            className="text-sm font-medium text-brand hover:underline"
          >
            + Nueva
          </button>
        </div>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="flex flex-col gap-1">
          {tenants.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t)}
              className={`rounded-lg px-3 py-2 text-left text-sm ${
                selected?.id === t.id
                  ? 'bg-brand/10 text-brand'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="font-medium">{t.name}</span>
              <span className="block text-xs text-slate-400">
                {t.code ? `código: ${t.code}` : 'general · sin código'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        {selected ? (
          <TenantForm tenant={selected} onSaved={load} onCancel={() => setSelected(null)} />
        ) : (
          <p className="text-sm text-slate-400">Selecciona o crea una organización.</p>
        )}
      </div>
    </div>
  );
}

function emptyTenant(): Tenant {
  return {
    id: '',
    name: '',
    slug: '',
    publicDomain: null,
    code: null,
    spaceId: null,
    matrixBaseUrl: '',
    matrixServerName: '',
    botUserId: null,
    botEnabled: false,
    botSystemPrompt: null,
    botResponseMode: 'mention',
    llmProvider: 'dummy',
    llmModel: null,
    llmBaseUrl: null,
    branding: { primaryColor: '#4f46e5', accentColor: '#a78bfa', logoUrl: null, tagline: null },
    primaryColor: '#4f46e5',
    logoUrl: null,
    allowRegistration: false,
    createdAt: '',
    updatedAt: '',
  };
}

function TenantForm({
  tenant,
  onSaved,
  onCancel,
}: {
  tenant: Tenant;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isNew = !tenant.id;
  const [form, setForm] = useState(tenant);
  const [requiresCode, setRequiresCode] = useState(tenant.code !== null);
  const [code, setCode] = useState(tenant.code ?? '');
  const [apiKey, setApiKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState('Hola, ¿qué eres?');
  const [testOut, setTestOut] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(tenant);
    setRequiresCode(tenant.code !== null);
    setCode(tenant.code ?? '');
    setApiKey('');
    setMsg(null);
    setTestOut(null);
  }, [tenant]);

  function set<K extends keyof Tenant>(key: K, value: Tenant[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setBrand<K extends keyof Tenant['branding']>(key: K, value: Tenant['branding'][K]) {
    setForm((f) => ({ ...f, branding: { ...f.branding, [key]: value } }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    // slug automático desde el nombre si es nueva y no se puso uno.
    const slug =
      form.slug.trim() ||
      form.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    const body: Record<string, unknown> = {
      name: form.name,
      slug,
      requiresCode,
      // Con código: manda el código (o vacío para autogenerar). Sin código: se ignora.
      ...(requiresCode ? { code: code.trim() || undefined } : {}),
      publicDomain: form.publicDomain || null,
      // Matrix opcional: si va vacío, el servidor usa el homeserver del despliegue.
      ...(form.matrixBaseUrl ? { matrixBaseUrl: form.matrixBaseUrl } : {}),
      ...(form.matrixServerName ? { matrixServerName: form.matrixServerName } : {}),
      botUserId: form.botUserId,
      botEnabled: form.botEnabled,
      botSystemPrompt: form.botSystemPrompt,
      botResponseMode: form.botResponseMode,
      llmProvider: form.llmProvider,
      llmModel: form.llmModel,
      llmBaseUrl: form.llmBaseUrl,
      allowRegistration: form.allowRegistration,
      branding: form.branding,
    };
    if (apiKey) body.llmApiKey = apiKey;
    try {
      if (isNew) {
        await adminFetch('/api/admin/tenants', { method: 'POST', body: JSON.stringify(body) });
      } else {
        await adminFetch(`/api/admin/tenants/${tenant.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      setMsg('Guardado ✓');
      onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function testBot() {
    setTestOut('…');
    try {
      const r = await adminFetch<{ ok: boolean; output?: string; error?: string; model: string }>(
        '/api/admin/bot/test',
        { method: 'POST', body: JSON.stringify({ tenantId: tenant.id, prompt: testPrompt }) },
      );
      setTestOut(r.ok ? `[${r.model}] ${r.output}` : `Error: ${r.error}`);
    } catch (e) {
      setTestOut(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          {isNew ? 'Nueva organización' : form.name}
        </h2>
        <button type="button" onClick={onCancel} className="text-sm text-slate-400 hover:underline">
          Cerrar
        </button>
      </div>

      <Section title="Identidad">
        <Field label="Nombre"><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Clínica San Rafael" /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={form.allowRegistration} onChange={(e) => set('allowRegistration', e.target.checked)} />
          Permitir registro abierto
        </label>
      </Section>

      <Section title="Acceso">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setRequiresCode(true)}
            className={`rounded-lg border p-3 text-left text-sm transition ${
              requiresCode
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <span className="block font-medium">Con código (aislada)</span>
            <span className="block text-xs opacity-80">Se registran con el código y solo se ven entre ellos.</span>
          </button>
          <button
            type="button"
            onClick={() => setRequiresCode(false)}
            className={`rounded-lg border p-3 text-left text-sm transition ${
              !requiresCode
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <span className="block font-medium">Sin código (general)</span>
            <span className="block text-xs opacity-80">Entran sin código al espacio general; se ven con todos.</span>
          </button>
        </div>
        {requiresCode && (
          <Field label="Código (opcional; se genera del nombre)">
            <input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="none" placeholder="clinica" />
          </Field>
        )}
      </Section>

      <Section title="Avanzado (opcional)">
        <Field label="Slug (id interno; se genera del nombre)"><input className="input" value={form.slug} onChange={(e) => set('slug', e.target.value)} /></Field>
        <Field label="Dominio propio (para subdominio futuro)"><input className="input" value={form.publicDomain ?? ''} onChange={(e) => set('publicDomain', e.target.value)} placeholder="(vacío)" /></Field>
        <Field label="Matrix base URL (URL pública; vacío = la del sitio)"><input className="input" value={form.matrixBaseUrl} onChange={(e) => set('matrixBaseUrl', e.target.value)} placeholder="https://whalabi.app" /></Field>
        <Field label="Matrix server name (vacío = por defecto)"><input className="input" value={form.matrixServerName} onChange={(e) => set('matrixServerName', e.target.value)} placeholder="(por defecto)" /></Field>
      </Section>

      <Section title="Branding">
        <Field label="Color primario"><input type="color" value={form.branding.primaryColor} onChange={(e) => setBrand('primaryColor', e.target.value)} className="h-10 w-16 rounded" /></Field>
        <Field label="Color acento"><input type="color" value={form.branding.accentColor ?? '#a78bfa'} onChange={(e) => setBrand('accentColor', e.target.value)} className="h-10 w-16 rounded" /></Field>
        <Field label="Logo URL"><input className="input" value={form.branding.logoUrl ?? ''} onChange={(e) => setBrand('logoUrl', e.target.value || null)} /></Field>
        <Field label="Tagline"><input className="input" value={form.branding.tagline ?? ''} onChange={(e) => setBrand('tagline', e.target.value || null)} /></Field>
      </Section>

      <Section title="Bot & LLM">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={form.botEnabled} onChange={(e) => set('botEnabled', e.target.checked)} />
          Bot habilitado
        </label>
        <Field label="Bot user ID"><input className="input" value={form.botUserId ?? ''} onChange={(e) => set('botUserId', e.target.value || null)} /></Field>
        <Field label="Modo de respuesta">
          <select className="input" value={form.botResponseMode} onChange={(e) => set('botResponseMode', e.target.value as Tenant['botResponseMode'])}>
            <option value="mention">Mención o DM</option>
            <option value="dm">Solo DM</option>
            <option value="always">Siempre</option>
          </select>
        </Field>
        <Field label="Prompt del sistema"><textarea className="input min-h-24" value={form.botSystemPrompt ?? ''} onChange={(e) => set('botSystemPrompt', e.target.value || null)} /></Field>
        <Field label="Proveedor LLM">
          <select className="input" value={form.llmProvider} onChange={(e) => set('llmProvider', e.target.value as Tenant['llmProvider'])}>
            <option value="dummy">Dummy (demo)</option>
            <option value="gemini">Gemini + búsqueda web (tiempo real)</option>
            <option value="openai">OpenAI-compatible (incl. Gemini sin web)</option>
            <option value="ollama">Ollama / local</option>
          </select>
        </Field>
        <Field label="Modelo"><input className="input" value={form.llmModel ?? ''} onChange={(e) => set('llmModel', e.target.value || null)} placeholder="gemini-3.1-flash-lite" /></Field>
        <Field label="LLM base URL"><input className="input" value={form.llmBaseUrl ?? ''} onChange={(e) => set('llmBaseUrl', e.target.value || null)} placeholder="https://generativelanguage.googleapis.com/v1beta/openai" /></Field>
        <Field label="API key (BYOK, se cifra)"><input type="password" className="input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={isNew ? '' : '•••••• (dejar vacío para no cambiar)'} /></Field>
      </Section>

      {!isNew && (
        <Section title="Probar bot">
          <div className="flex gap-2">
            <input className="input" value={testPrompt} onChange={(e) => setTestPrompt(e.target.value)} />
            <button type="button" onClick={testBot} className="btn-primary shrink-0 text-sm">Probar</button>
          </div>
          {testOut && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{testOut}</p>}
        </Section>
      )}

      {!isNew && !requiresCode && (
        <Section title="Usuarios existentes">
          <p className="text-xs text-slate-400">
            Une a las cuentas ya creadas a esta organización general. Úsalo una vez
            al activar el multitenant para que se sigan descubriendo entre sí.
          </p>
          <button
            type="button"
            onClick={async () => {
              setMsg(null);
              try {
                const r = await adminFetch<{ joined: number; total: number }>(
                  `/api/admin/tenants/${tenant.id}/backfill`,
                  { method: 'POST' },
                );
                setMsg(`Unidos ${r.joined}/${r.total} usuarios ✓`);
              } catch (e) {
                setMsg(e instanceof Error ? e.message : 'Error');
              }
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Unir usuarios existentes a esta organización
          </button>
        </Section>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar cambios'}
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}
