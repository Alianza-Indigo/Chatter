'use client';

import { config } from './config';

const TOKEN_KEY = 'whalabi.admin.jwt';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

/** Login admin: cambia el ADMIN_API_TOKEN por un JWT de 12h. */
export async function adminLogin(token: string): Promise<void> {
  const res = await fetch(`${config.apiUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error('Token de administración inválido.');
  const data = (await res.json()) as { token: string };
  setAdminToken(data.token);
}

export class AdminAuthError extends Error {}

/** fetch autenticado contra /api/admin/*. Lanza AdminAuthError en 401. */
export async function adminFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearAdminToken();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('whalabi:admin-unauth'));
    }
    throw new AdminAuthError('Sesión expirada');
  }
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (res.status === 204 ? (undefined as T) : ((await res.json()) as T));
}
