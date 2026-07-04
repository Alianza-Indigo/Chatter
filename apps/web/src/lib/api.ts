import type { PublicTenantConfig } from '@whalabi/shared';
import { config } from './config';

/** Resuelve la configuración pública del tenant según el dominio actual. */
export async function fetchTenantConfig(domain?: string): Promise<PublicTenantConfig> {
  const host = domain ?? (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  // Concatenación de string (no `new URL`): config.apiUrl puede ser '' (mismo
  // origen, proxy), y `new URL(path, '')` lanzaría excepción.
  const qs = new URLSearchParams({ domain: host }).toString();
  const res = await fetch(`${config.apiUrl}/api/config/public?${qs}`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`No se pudo resolver el tenant (${res.status}).`);
  }
  return (await res.json()) as PublicTenantConfig;
}

/**
 * Comprueba un código de organización ANTES de crear la cuenta.
 * Vacío = espacio Global (siempre válido). Devuelve el nombre si es una org.
 */
export async function checkOrgCode(
  code: string,
): Promise<{ valid: boolean; scope?: 'global' | 'organization'; name?: string }> {
  const qs = new URLSearchParams({ code }).toString();
  const res = await fetch(`${config.apiUrl}/api/org/check?${qs}`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) return { valid: false };
  return (await res.json()) as { valid: boolean; scope?: 'global' | 'organization'; name?: string };
}

/**
 * Une al usuario recién registrado a su espacio (Global o el de su organización).
 * Se autentica con su propio access token de Matrix. Lanza si el código es
 * inválido o la unión falla, para que el flujo de registro lo muestre.
 */
export async function joinOrgSpace(accessToken: string, code?: string): Promise<void> {
  const res = await fetch(`${config.apiUrl}/api/org/join`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ code: code ?? '' }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    if (data.error === 'invalid_org_code') {
      throw new Error('El código de organización no es válido.');
    }
    throw new Error(data.message ?? 'No se pudo unir a tu organización. Intenta de nuevo.');
  }
}

/**
 * Fallback de configuración cuando la API no responde (modo offline / dev sin
 * backend). Usa las variables NEXT_PUBLIC_*.
 */
export function fallbackTenantConfig(): PublicTenantConfig {
  return {
    id: 'default',
    name: 'Whalabi',
    slug: config.defaultTenantSlug,
    publicDomain: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
    matrixBaseUrl: config.defaultHomeserver,
    matrixServerName: config.defaultServerName,
    botEnabled: false,
    botUserId: null,
    allowRegistration: true,
    branding: {
      primaryColor: '#4f46e5',
      accentColor: '#a78bfa',
      logoUrl: null,
      tagline: 'El chat privado de tu organización.',
    },
  };
}
