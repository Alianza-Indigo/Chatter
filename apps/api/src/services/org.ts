import type { Organization as PrismaOrg, Tenant as PrismaTenant } from '@prisma/client';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '@whalabi/shared';
import { prisma } from '../db.js';
import { logger } from '../logger.js';
import { createSpace, forceJoinRoom, listUsers } from './synapse-admin.js';

/**
 * Organizaciones del multitenant híbrido.
 *
 * Regla de producto:
 *   - Registro SIN código  -> el usuario se une al Espacio "Global" del tenant.
 *   - Registro CON código   -> el usuario se une SOLO al Espacio de esa org.
 *
 * Con `search_all_users: false` en Synapse, compartir espacio es lo único que
 * permite descubrirse; así el Global se comporta como WhatsApp (todos) y cada
 * organización queda aislada. Los espacios se crean vía la Synapse Admin API y
 * la unión se hace con force-join (el usuario no tiene que aceptar nada).
 */

/** Normaliza un código para comparar/guardar (minúsculas, sin espacios). */
export function normalizeOrgCode(input: string): string {
  return input.trim().toLowerCase();
}

/** Deriva un código a partir de un nombre cuando el admin no da uno explícito. */
function codeFromName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'org';
}

/**
 * Asegura el Espacio "Global" del tenant. Idempotente: si ya está en el tenant
 * lo devuelve; si no, lo crea en Synapse y lo persiste.
 */
export async function ensureGlobalSpace(tenant: PrismaTenant): Promise<string> {
  if (tenant.globalSpaceId) return tenant.globalSpaceId;
  const spaceId = await createSpace(tenant.matrixBaseUrl, `${tenant.name} · Global`);
  await prisma.tenant.update({ where: { id: tenant.id }, data: { globalSpaceId: spaceId } });
  logger.info({ tenantId: tenant.id, spaceId }, 'Espacio Global creado');
  return spaceId;
}

/**
 * Une a TODOS los usuarios existentes del homeserver al Espacio Global. Se usa
 * al activar el multitenant (search_all_users:false) para que las cuentas
 * creadas antes sigan pudiéndose descubrir entre sí. Idempotente y tolerante a
 * fallos por usuario (deactivados, etc.). No toca a quienes ya están en una org.
 */
export async function backfillGlobalSpace(
  tenant: PrismaTenant,
): Promise<{ spaceId: string; joined: number; total: number }> {
  const spaceId = await ensureGlobalSpace(tenant);
  let from = 0;
  let joined = 0;
  let total = 0;
  // Paginación simple del listado de usuarios de la Admin API.
  for (let page = 0; page < 1000; page++) {
    const { users, total: count } = await listUsers(tenant.matrixBaseUrl, { limit: 100, from });
    total = count;
    if (users.length === 0) break;
    for (const u of users) {
      if (u.deactivated) continue;
      try {
        await forceJoinRoom(tenant.matrixBaseUrl, spaceId, u.userId);
        joined += 1;
      } catch (err) {
        logger.warn({ err, userId: u.userId }, 'No se pudo unir usuario al Global (backfill)');
      }
    }
    from += users.length;
    if (from >= total) break;
  }
  logger.info({ tenantId: tenant.id, spaceId, joined, total }, 'Backfill del espacio Global');
  return { spaceId, joined, total };
}

export async function listOrganizations(tenantId: string): Promise<PrismaOrg[]> {
  return prisma.organization.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
}

/**
 * Crea una organización: genera/valida el código, crea su Espacio en Synapse y
 * lo persiste. Si el código ya existe en el tenant, lanza error.
 */
export async function createOrganization(
  tenant: PrismaTenant,
  input: CreateOrganizationInput,
  createdBy?: string,
): Promise<PrismaOrg> {
  const code = normalizeOrgCode(input.code ?? codeFromName(input.name));
  const existing = await prisma.organization.findUnique({
    where: { tenantId_code: { tenantId: tenant.id, code } },
  });
  if (existing) throw new Error(`Ya existe una organización con el código "${code}".`);

  const spaceId = await createSpace(tenant.matrixBaseUrl, input.name);
  return prisma.organization.create({
    data: { tenantId: tenant.id, name: input.name, code, spaceId, createdBy: createdBy ?? null },
  });
}

/**
 * Actualiza el nombre y/o el código de una organización. Al cambiar el código
 * NO se toca el Espacio ni sus miembros actuales: solo cambia qué texto deben
 * teclear los NUEVOS integrantes al registrarse. Valida unicidad del código.
 */
export async function updateOrganization(
  tenantId: string,
  orgId: string,
  input: UpdateOrganizationInput,
): Promise<PrismaOrg> {
  const org = await prisma.organization.findFirst({ where: { id: orgId, tenantId } });
  if (!org) throw new Error('Organización no encontrada.');

  const code = input.code !== undefined ? normalizeOrgCode(input.code) : undefined;
  if (code && code !== org.code) {
    const clash = await prisma.organization.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (clash) throw new Error(`Ya existe una organización con el código "${code}".`);
  }

  return prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(code !== undefined ? { code } : {}),
    },
  });
}

/**
 * Borra el registro de una organización de Whalabi. NO borra el Espacio Matrix
 * (sus miembros e historial siguen en Synapse); solo deja de ofrecer el código.
 */
export async function deleteOrganization(tenantId: string, orgId: string): Promise<void> {
  const org = await prisma.organization.findFirst({ where: { id: orgId, tenantId } });
  if (!org) throw new Error('Organización no encontrada.');
  await prisma.organization.delete({ where: { id: orgId } });
}

/** Resuelve una organización por su código dentro de un tenant. */
export async function resolveOrgByCode(
  tenantId: string,
  code: string,
): Promise<PrismaOrg | null> {
  return prisma.organization.findUnique({
    where: { tenantId_code: { tenantId, code: normalizeOrgCode(code) } },
  });
}

export interface JoinResult {
  spaceId: string;
  scope: 'global' | 'organization';
  organization?: { id: string; name: string; code: string };
}

/**
 * Une a un usuario al espacio que le corresponde según su código:
 *   - código vacío / ausente -> Espacio Global (se crea si hace falta).
 *   - código válido           -> Espacio de esa organización.
 *   - código inválido         -> error (no cae al Global; el usuario lo tecleó a propósito).
 */
export async function joinUserToOrgSpace(
  tenant: PrismaTenant,
  userId: string,
  code?: string | null,
): Promise<JoinResult> {
  const trimmed = (code ?? '').trim();

  if (!trimmed) {
    const spaceId = await ensureGlobalSpace(tenant);
    await forceJoinRoom(tenant.matrixBaseUrl, spaceId, userId);
    return { spaceId, scope: 'global' };
  }

  const org = await resolveOrgByCode(tenant.id, trimmed);
  if (!org) {
    const err = new Error('Código de organización no válido.') as Error & { code?: string };
    err.code = 'INVALID_ORG_CODE';
    throw err;
  }
  await forceJoinRoom(tenant.matrixBaseUrl, org.spaceId, userId);
  return {
    spaceId: org.spaceId,
    scope: 'organization',
    organization: { id: org.id, name: org.name, code: org.code },
  };
}
