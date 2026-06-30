/** Utilidades comunes, sin dependencias externas. */

/** Prompt base del bot, usado cuando el tenant no define uno propio. */
export const DEFAULT_BOT_SYSTEM_PROMPT =
  'Eres el asistente interno de la organización. Responde con claridad, ' +
  'brevedad y utilidad. No inventes políticas internas. Si no sabes algo, dilo. ' +
  'No reveles información de otros rooms o usuarios.';

export const DEFAULT_BRANDING = {
  primaryColor: '#4f46e5', // índigo
  accentColor: '#a78bfa', // lavanda
  logoUrl: null as string | null,
  tagline: 'El chat privado de tu organización.' as string | null,
};

/** Normaliza un dominio: minúsculas, sin protocolo, sin puerto, sin barra final. */
export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.split('/')[0] ?? d;
  d = d.split(':')[0] ?? d; // quita puerto
  return d;
}

/** Extrae el server_name de un Matrix ID (@user:server -> server). */
export function serverNameFromUserId(userId: string): string | null {
  const idx = userId.indexOf(':');
  if (idx === -1) return null;
  return userId.slice(idx + 1) || null;
}

/** Construye un Matrix ID a partir de localpart y server_name. */
export function buildMatrixId(localpart: string, serverName: string): string {
  const lp = localpart.replace(/^@/, '').split(':')[0] ?? localpart;
  return `@${lp}:${serverName}`;
}

/** Comprueba si un texto menciona a un usuario por su localpart o display name. */
export function mentionsUser(
  text: string,
  opts: { userId: string; displayName?: string | null },
): boolean {
  const lower = text.toLowerCase();
  if (lower.includes(opts.userId.toLowerCase())) return true;
  const localpart = opts.userId.replace(/^@/, '').split(':')[0];
  if (localpart && lower.includes(`@${localpart.toLowerCase()}`)) return true;
  if (opts.displayName && lower.includes(opts.displayName.toLowerCase())) return true;
  return false;
}

/** Trunca texto de forma segura para logs. */
export function truncate(text: string, max = 280): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

/** Sleep basado en promesa. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
