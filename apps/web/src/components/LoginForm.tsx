'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMatrix } from '@/lib/matrix-provider';
import { useTenant } from '@/lib/tenant-provider';
import { config } from '@/lib/config';
import { TenantBrand } from './TenantBrand';

export function LoginForm() {
  const router = useRouter();
  const { login } = useMatrix();
  const { tenant } = useTenant();

  const [homeserver, setHomeserver] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const effectiveHomeserver = homeserver || tenant?.matrixBaseUrl || config.defaultHomeserver;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(effectiveHomeserver, user.trim(), password);
      router.push('/chat');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar sesión.';
      setError(msg.includes('M_FORBIDDEN') ? 'Usuario o contraseña incorrectos.' : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6">
        <TenantBrand />
      </div>
      <h1 className="mb-1 text-xl font-semibold text-slate-800 dark:text-slate-100">
        Iniciar sesión
      </h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Accede con tu identidad Matrix de la organización.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Usuario">
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder={`usuario  o  @usuario:${tenant?.matrixServerName ?? config.defaultServerName}`}
            autoComplete="username"
            required
            className="input"
          />
        </Field>
        <Field label="Contraseña">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="input"
          />
        </Field>
        <details className="text-xs text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer select-none">Homeserver avanzado</summary>
          <input
            value={homeserver}
            onChange={(e) => setHomeserver(e.target.value)}
            placeholder={effectiveHomeserver}
            className="input mt-2"
          />
        </details>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      {tenant?.allowRegistration ? (
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="font-medium text-brand hover:underline">
            Crear cuenta
          </Link>
        </p>
      ) : (
        <p className="mt-6 text-center text-xs text-slate-400">
          El registro está controlado por tu organización.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}
