'use client';

import { useRouter } from 'next/navigation';
import { useMatrix } from '@/lib/matrix-provider';
import { useTenant } from '@/lib/tenant-provider';
import { useTheme } from '@/lib/theme-provider';
import { TenantBrand } from './TenantBrand';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

export function SettingsPanel() {
  const router = useRouter();
  const { session } = useMatrix();
  const { tenant } = useTenant();
  const { theme, setTheme } = useTheme();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <button
        type="button"
        onClick={() => router.push('/chat')}
        className="mb-6 text-sm text-brand hover:underline"
      >
        ← Volver al chat
      </button>

      <div className="mb-8">
        <TenantBrand />
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">
          Tu identidad
        </h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <Row label="Matrix ID" value={session?.userId ?? '—'} />
          <Row label="Dispositivo" value={session?.deviceId || '—'} />
          <Row label="Homeserver" value={session?.homeserverUrl ?? '—'} />
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">
          Organización
        </h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <Row label="Nombre" value={tenant?.name ?? '—'} />
          <Row label="Dominio" value={tenant?.publicDomain ?? '—'} />
          <Row label="Server name" value={tenant?.matrixServerName ?? '—'} />
          <Row label="Bot habilitado" value={tenant?.botEnabled ? 'Sí' : 'No'} />
          <Row label="Registro abierto" value={tenant?.allowRegistration ? 'Sí' : 'No'} />
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-100">
          Apariencia
        </h2>
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`rounded-lg border px-4 py-2 text-sm transition ${
                theme === t
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              {t === 'light' ? 'Claro' : 'Oscuro'}
            </button>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Whalabi usa identidades Matrix. Los mensajes pertenecen al homeserver de tu organización.
        Whalabi no usa número telefónico y no guarda tus mensajes como fuente de verdad.
      </p>
    </div>
  );
}
