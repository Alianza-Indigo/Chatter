'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMatrix } from '@/lib/matrix-provider';
import { useTenant } from '@/lib/tenant-provider';
import { config } from '@/lib/config';
import { TenantBrand } from './TenantBrand';

export function RegisterForm() {
  const router = useRouter();
  const { register } = useMatrix();
  const { tenant } = useTenant();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const homeserver = tenant?.matrixBaseUrl ?? config.defaultHomeserver;

  if (tenant && !tenant.allowRegistration) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex justify-center">
          <TenantBrand />
        </div>
        <h1 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
          Registro no disponible
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          El registro está controlado por tu organización.
        </p>
        <Link href="/login" className="mt-6 inline-block font-medium text-brand hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(homeserver, username.trim(), password, token || undefined);
      router.push('/chat');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear la cuenta.';
      setError(
        msg.includes('M_FORBIDDEN')
          ? 'El registro no está permitido en este homeserver o requiere un token.'
          : msg,
      );
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
        Crear cuenta
      </h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Tu identidad será{' '}
        <span className="font-mono text-brand">
          @{username || 'usuario'}:{tenant?.matrixServerName ?? config.defaultServerName}
        </span>
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Usuario
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            pattern="[a-z0-9._=\-/]+"
            required
            className="input"
            placeholder="usuario"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Contraseña
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className="input"
            autoComplete="new-password"
          />
        </label>
        <details className="text-xs text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer select-none">Token de registro (si aplica)</summary>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="input mt-2"
            placeholder="Token proporcionado por tu organización"
          />
        </details>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
