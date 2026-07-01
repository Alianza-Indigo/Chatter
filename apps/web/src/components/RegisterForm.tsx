'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMatrix } from '@/lib/matrix-provider';
import { useTenant } from '@/lib/tenant-provider';
import { useTheme } from '@/lib/theme-provider';
import { config } from '@/lib/config';
import { TenantBrand } from './TenantBrand';
import { Recaptcha } from './Recaptcha';

export function RegisterForm() {
  const router = useRouter();
  const { register } = useMatrix();
  const { tenant } = useTenant();
  const { theme } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const homeserver = tenant?.matrixBaseUrl ?? config.defaultHomeserver;
  const siteKey = config.recaptchaSiteKey;

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

    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (siteKey && !captcha) {
      setError('Por favor confirma que no eres un robot.');
      return;
    }

    setLoading(true);
    try {
      await register({
        homeserverUrl: homeserver,
        username: username.trim(),
        password,
        captchaResponse: captcha ?? undefined,
      });
      router.push('/chat');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo crear la cuenta.';
      setError(
        msg.includes('M_FORBIDDEN')
          ? 'El registro no está permitido en este homeserver.'
          : msg.includes('M_USER_IN_USE')
            ? 'Ese usuario ya está en uso. Elige otro.'
            : msg,
      );
      setCaptcha(null);
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

        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Contraseña
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="input pr-12"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </label>
          <p className="mt-1 text-xs text-slate-400">Mínimo 8 caracteres.</p>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Confirmar contraseña
          </span>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
            className={`input ${confirm && confirm !== password ? 'border-red-400 focus:border-red-400 focus:ring-red-300' : ''}`}
            autoComplete="new-password"
          />
          {confirm && confirm !== password && (
            <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
              Las contraseñas no coinciden.
            </span>
          )}
        </label>

        {siteKey && (
          <div className="pt-1">
            <Recaptcha siteKey={siteKey} onChange={setCaptcha} theme={theme === 'dark' ? 'dark' : 'light'} />
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || (!!confirm && confirm !== password)}
          className="btn-primary w-full"
        >
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
