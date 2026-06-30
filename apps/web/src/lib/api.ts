import type { PublicTenantConfig } from '@whalabi/shared';
import { config } from './config';

/** Resuelve la configuración pública del tenant según el dominio actual. */
export async function fetchTenantConfig(domain?: string): Promise<PublicTenantConfig> {
  const host = domain ?? (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
  const url = new URL('/api/config/public', config.apiUrl);
  url.searchParams.set('domain', host);

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`No se pudo resolver el tenant (${res.status}).`);
  }
  return (await res.json()) as PublicTenantConfig;
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
