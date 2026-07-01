import { buildMatrixId } from '@whalabi/shared';
import { env } from '../env.js';
import { logger } from '../logger.js';

/**
 * Integración con la Synapse Admin API para gestión de usuarios Matrix.
 *
 * Autentica como el usuario administrador de Matrix (MATRIX_ADMIN_USER/PASSWORD)
 * y cachea su access token. Todas las operaciones se hacen contra el homeserver
 * indicado (por defecto el del tenant default).
 *
 * Docs: https://element-hq.github.io/synapse/latest/admin_api/
 */

interface AdminSession {
  token: string;
  baseUrl: string;
}

let cached: AdminSession | null = null;

async function login(baseUrl: string): Promise<AdminSession> {
  if (cached && cached.baseUrl === baseUrl) return cached;
  if (!env.MATRIX_ADMIN_USER || !env.MATRIX_ADMIN_PASSWORD) {
    throw new Error(
      'Faltan MATRIX_ADMIN_USER / MATRIX_ADMIN_PASSWORD para la Synapse Admin API.',
    );
  }
  const localpart = env.MATRIX_ADMIN_USER.replace(/^@/, '').split(':')[0] ?? env.MATRIX_ADMIN_USER;
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: localpart },
      password: env.MATRIX_ADMIN_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`Login admin Matrix falló (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  cached = { token: data.access_token, baseUrl };
  return cached;
}

async function adminFetch(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const session = await login(baseUrl);
  const doFetch = (token: string) =>
    fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });

  let res = await doFetch(session.token);
  if (res.status === 401) {
    // Token expirado: re-login una vez.
    cached = null;
    const fresh = await login(baseUrl);
    res = await doFetch(fresh.token);
  }
  if (!res.ok) {
    throw new Error(`Synapse Admin API ${res.status}: ${await res.text()}`);
  }
  return res.status === 204 ? null : await res.json();
}

export interface SynapseUser {
  userId: string;
  displayName: string | null;
  deactivated: boolean;
  admin: boolean;
  creationTs: number | null;
}

interface RawUser {
  name: string;
  displayname?: string | null;
  deactivated?: boolean | number;
  admin?: boolean | number;
  creation_ts?: number;
}

function toUser(u: RawUser): SynapseUser {
  return {
    userId: u.name,
    displayName: u.displayname ?? null,
    deactivated: Boolean(u.deactivated),
    admin: Boolean(u.admin),
    creationTs: u.creation_ts ? u.creation_ts * 1000 : null,
  };
}

/** Lista usuarios del homeserver (paginado simple). */
export async function listUsers(
  baseUrl: string,
  opts: { limit?: number; from?: number } = {},
): Promise<{ users: SynapseUser[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(opts.limit ?? 100),
    from: String(opts.from ?? 0),
    guests: 'false',
  });
  const data = (await adminFetch(baseUrl, `/_synapse/admin/v2/users?${params}`)) as {
    users: RawUser[];
    total: number;
  };
  return { users: (data.users ?? []).map(toUser), total: data.total ?? 0 };
}

/** Crea (o actualiza) un usuario en el homeserver. */
export async function createUser(
  baseUrl: string,
  serverName: string,
  input: { localpart: string; password: string; displayName?: string; admin?: boolean },
): Promise<SynapseUser> {
  const userId = buildMatrixId(input.localpart, serverName);
  const data = (await adminFetch(baseUrl, `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      password: input.password,
      displayname: input.displayName,
      admin: input.admin ?? false,
      deactivated: false,
    }),
  })) as RawUser;
  return toUser(data);
}

/** Cambia el display name de un usuario. */
export async function setDisplayName(
  baseUrl: string,
  userId: string,
  displayName: string,
): Promise<void> {
  await adminFetch(baseUrl, `/_synapse/admin/v2/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({ displayname: displayName }),
  });
}

/** Restablece la contraseña de un usuario (opción: cerrar sesiones). */
export async function resetPassword(
  baseUrl: string,
  userId: string,
  newPassword: string,
  logoutDevices = true,
): Promise<void> {
  await adminFetch(baseUrl, `/_synapse/admin/v1/reset_password/${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: JSON.stringify({ new_password: newPassword, logout_devices: logoutDevices }),
  });
}

/** Desactiva (da de baja) un usuario y borra sus datos personales. */
export async function deactivateUser(baseUrl: string, userId: string): Promise<void> {
  await adminFetch(baseUrl, `/_synapse/admin/v1/deactivate/${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: JSON.stringify({ erase: false }),
  });
}

/** Une (fuerza) a un usuario a un room. Útil para asignar rooms al invitar. */
export async function joinUserToRoom(
  baseUrl: string,
  roomIdOrAlias: string,
  userId: string,
): Promise<void> {
  try {
    await adminFetch(baseUrl, `/_synapse/admin/v1/join/${encodeURIComponent(roomIdOrAlias)}`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  } catch (err) {
    // No romper el flujo de alta por un room que no exista.
    logger.warn({ err, roomIdOrAlias, userId }, 'No se pudo unir el usuario al room');
  }
}
