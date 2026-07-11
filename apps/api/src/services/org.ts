import type { Tenant as PrismaTenant } from '@prisma/client';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { createSpace, forceJoinRoom, listUsers } from './synapse-admin.js';
import { resolveTenantByCode } from './tenant.js';

/**
 * Ingreso y aislamiento de organizaciones (multitenant híbrido).
 *
 * La "organización" es el Tenant. Regla de producto:
 *   - Registro SIN código  -> se une al espacio de la organización general
 *     (el tenant resuelto por dominio, normalmente Whalabi).
 *   - Registro CON código   -> se une SOLO al espacio de esa organización.
 *
 * Con `search_all_users:false` en Synapse, compartir espacio es lo único que
 * permite descubrirse; y el módulo de aislamiento (vía mayContact) bloquea el
 * contacto entre organizaciones distintas. Los espacios se crean vía la Synapse
 * Admin API y la unión se hace con force-join.
 *
 * IMPORTANTE: las operaciones administrativas (crear espacio, listar usuarios,
 * force-join) van SIEMPRE al Synapse INTERNO (env.MATRIX_DEFAULT_HOMESERVER_URL,
 * p. ej. http://synapse:8008), NO al `matrixBaseUrl` del tenant. Ese puede ser la
 * URL pública, y el reverse proxy (Caddy) no expone `/_synapse/admin/*` por
 * seguridad → daría 404. La Admin API solo está disponible en el puerto interno.
 */
const ADMIN_HS = env.MATRIX_DEFAULT_HOMESERVER_URL;

function botUserIdForTenant(tenant: PrismaTenant): string | null {
  const configured = tenant.botUserId?.trim();
  if (configured) return configured;
  const serverName = tenant.matrixServerName || env.MATRIX_DEFAULT_SERVER_NAME;
  return serverName ? `@whalabi-bot:${serverName}` : null;
}

async function isTenantBotUser(userId: string): Promise<boolean> {
  const fallbackBotId = `@whalabi-bot:${env.MATRIX_DEFAULT_SERVER_NAME}`;
  if (userId === fallbackBotId) return true;
  const tenant = await prisma.tenant.findFirst({
    where: { botUserId: userId },
    select: { id: true },
  });
  return Boolean(tenant);
}

async function ensureBotInSpace(tenant: PrismaTenant, spaceId: string): Promise<void> {
  if (!tenant.botEnabled) return;
  const botUserId = botUserIdForTenant(tenant);
  if (!botUserId) return;
  try {
    await forceJoinRoom(ADMIN_HS, spaceId, botUserId);
  } catch (err) {
    logger.warn(
      { err, tenantId: tenant.id, spaceId, botUserId },
      'No se pudo unir el bot al espacio',
    );
  }
}

/** Asegura el espacio Matrix de una organización; lo crea la primera vez. */
export async function ensureTenantSpace(tenant: PrismaTenant): Promise<string> {
  if (tenant.spaceId) {
    await ensureBotInSpace(tenant, tenant.spaceId);
    return tenant.spaceId;
  }
  const spaceId = await createSpace(ADMIN_HS, tenant.name);
  const updated = await prisma.tenant.update({ where: { id: tenant.id }, data: { spaceId } });
  await ensureBotInSpace(updated, spaceId);
  logger.info({ tenantId: tenant.id, spaceId }, 'Espacio de organización creado');
  return spaceId;
}

/** Guarda/actualiza a qué organización (tenant) pertenece un usuario. */
async function recordMembership(tenantId: string, userId: string): Promise<void> {
  await prisma.orgMembership.upsert({
    where: { userId },
    update: { tenantId },
    create: { tenantId, userId },
  });
}

/**
 * ¿Pueden contactarse dos usuarios? Regla: solo si pertenecen a la misma
 * organización. Lo consulta el módulo de Synapse en cada invitación. Un usuario
 * sin registro de membresía se trata como "sin organización" (null).
 */
export async function mayContact(from: string, to: string): Promise<boolean> {
  if (from === to) return true;
  if ((await isTenantBotUser(from)) || (await isTenantBotUser(to))) return true;
  const [a, b] = await Promise.all([
    prisma.orgMembership.findUnique({ where: { userId: from } }),
    prisma.orgMembership.findUnique({ where: { userId: to } }),
  ]);
  return (a?.tenantId ?? null) === (b?.tenantId ?? null);
}

export interface JoinResult {
  spaceId: string;
  scope: 'general' | 'organization';
  organization: { id: string; name: string; code: string | null };
}

/**
 * Une a un usuario a la organización que le corresponde según su código:
 *   - código vacío  -> organización general (el `hostTenant`, resuelto por dominio).
 *   - código válido  -> esa organización.
 *   - código inválido -> error (no cae a la general; el usuario lo tecleó a propósito).
 */
export async function joinUserByCode(
  hostTenant: PrismaTenant,
  userId: string,
  code?: string | null,
): Promise<JoinResult> {
  const trimmed = (code ?? '').trim();
  let target = hostTenant;
  let scope: 'general' | 'organization' = 'general';

  if (trimmed) {
    const org = await resolveTenantByCode(trimmed);
    if (!org) {
      const err = new Error('Código de organización no válido.') as Error & { code?: string };
      err.code = 'INVALID_ORG_CODE';
      throw err;
    }
    target = org;
    scope = 'organization';
  }

  const spaceId = await ensureTenantSpace(target);
  await forceJoinRoom(ADMIN_HS, spaceId, userId);
  await recordMembership(target.id, userId);
  return {
    spaceId,
    scope,
    organization: { id: target.id, name: target.name, code: target.code },
  };
}

/**
 * Une a TODOS los usuarios existentes del homeserver a la organización general
 * (este tenant) y registra su membresía. Se usa al activar el multitenant para
 * que las cuentas creadas antes sigan pudiéndose descubrir. No pisa a quien ya
 * tenga una membresía (p. ej. de otra organización).
 */
export async function backfillTenant(
  tenant: PrismaTenant,
): Promise<{ spaceId: string; joined: number; total: number }> {
  const spaceId = await ensureTenantSpace(tenant);
  let from = 0;
  let joined = 0;
  let total = 0;
  for (let page = 0; page < 1000; page++) {
    const { users, total: count } = await listUsers(ADMIN_HS, { limit: 100, from });
    total = count;
    if (users.length === 0) break;
    for (const u of users) {
      if (u.deactivated) continue;
      try {
        await forceJoinRoom(ADMIN_HS, spaceId, u.userId);
        const existing = await prisma.orgMembership.findUnique({ where: { userId: u.userId } });
        if (!existing) await recordMembership(tenant.id, u.userId);
        joined += 1;
      } catch (err) {
        logger.warn({ err, userId: u.userId }, 'No se pudo unir usuario (backfill)');
      }
    }
    from += users.length;
    if (from >= total) break;
  }
  logger.info({ tenantId: tenant.id, spaceId, joined, total }, 'Backfill de organización general');
  return { spaceId, joined, total };
}
