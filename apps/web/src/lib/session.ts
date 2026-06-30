import type { WhalabiSession } from '@whalabi/matrix';

/**
 * Persistencia de sesión Matrix en el cliente.
 *
 * Nota de seguridad: el access token se guarda en localStorage para soportar
 * PWA instalable y recargas. Esto es estándar en clientes Matrix web, pero
 * implica que el token es accesible vía JS (riesgo XSS). En despliegues de alta
 * seguridad conviene usar cookies httpOnly emitidas por un proxy de sesión.
 */
const KEY = 'whalabi.session.v1';

export function saveSession(session: WhalabiSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadSession(): WhalabiSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WhalabiSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
}
