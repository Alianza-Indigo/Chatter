/** Configuración derivada de variables NEXT_PUBLIC_* (disponibles en cliente). */
export const config = {
  // Vacío = mismo origen (relativo): las peticiones a /api las reenvía Next.js al
  // contenedor de la API (ver rewrites en next.config.mjs). Así el navegador solo
  // usa el puerto de la web y no hay problemas de puerto/CORS.
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  defaultHomeserver:
    process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL ?? 'http://localhost:8008',
  defaultServerName: process.env.NEXT_PUBLIC_MATRIX_SERVER_NAME ?? 'whalabi.local',
  defaultTenantSlug: process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG ?? 'default',
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
};
