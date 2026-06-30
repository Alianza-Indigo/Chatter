/** Configuración derivada de variables NEXT_PUBLIC_* (disponibles en cliente). */
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  defaultHomeserver:
    process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL ?? 'http://localhost:8008',
  defaultServerName: process.env.NEXT_PUBLIC_MATRIX_SERVER_NAME ?? 'whalabi.local',
  defaultTenantSlug: process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'default',
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
};
