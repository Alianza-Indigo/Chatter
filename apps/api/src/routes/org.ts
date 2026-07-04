import type { FastifyInstance } from 'fastify';
import { createOrganizationSchema, joinOrgSchema } from '@whalabi/shared';
import { requireAdmin } from '../middleware/auth.js';
import { getTenantById, resolveTenantByDomain } from '../services/tenant.js';
import {
  backfillGlobalSpace,
  createOrganization,
  joinUserToOrgSpace,
  listOrganizations,
  resolveOrgByCode,
} from '../services/org.js';
import { whoami } from '../services/synapse-admin.js';
import { toOrganization } from '../mappers.js';
import { logger } from '../logger.js';

function hostOf(req: { headers: Record<string, unknown> }): string {
  return (
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers.host as string) ||
    'localhost'
  );
}

/**
 * Ruta pública de multitenant híbrido.
 *   POST /api/org/join   Authorization: Bearer <access token Matrix>  { code? }
 *
 * El usuario recién registrado se autentica con su propio access token; la API
 * confirma su identidad (whoami) y lo une al espacio que le corresponde:
 * Global si no hay código, o el de la organización si el código es válido.
 */
export async function orgPublicRoutes(app: FastifyInstance): Promise<void> {
  // Comprueba un código ANTES de crear la cuenta, para no dejar cuentas
  // huérfanas si está mal escrito. Devuelve el nombre para confirmar al usuario.
  app.get('/api/org/check', async (req, reply) => {
    const code = ((req.query as { code?: string }).code ?? '').trim();
    if (!code) return reply.send({ valid: true, scope: 'global' });
    const tenant = await resolveTenantByDomain(hostOf(req));
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });
    const org = await resolveOrgByCode(tenant.id, code);
    return reply.send(
      org ? { valid: true, scope: 'organization', name: org.name } : { valid: false },
    );
  });

  app.post('/api/org/join', async (req, reply) => {
    const parsed = joinOrgSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }

    const auth = (req.headers.authorization as string) || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Falta el token de acceso.' });
    }

    const tenant = await resolveTenantByDomain(hostOf(req));
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });

    const userId = await whoami(tenant.matrixBaseUrl, token);
    if (!userId) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Token de acceso inválido.' });
    }

    try {
      const result = await joinUserToOrgSpace(tenant, userId, parsed.data.code);
      return reply.send(result);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'INVALID_ORG_CODE') {
        return reply.code(422).send({
          error: 'invalid_org_code',
          message: 'El código de organización no es válido.',
        });
      }
      logger.error({ err, userId }, 'Fallo al unir al usuario a su espacio');
      return reply.code(502).send({
        error: 'join_failed',
        message: 'No se pudo unir al espacio. Intenta de nuevo.',
      });
    }
  });
}

/**
 * Rutas administrativas de organizaciones (protegidas por x-admin-token).
 *   GET  /api/admin/tenants/:id/orgs
 *   POST /api/admin/tenants/:id/orgs   { name, code? }
 */
export async function orgAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdmin);

  app.get('/api/admin/tenants/:id/orgs', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = await getTenantById(id);
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });
    const orgs = await listOrganizations(tenant.id);
    return reply.send(orgs.map(toOrganization));
  });

  // Une a los usuarios existentes al Espacio Global (rollout de multitenant).
  app.post('/api/admin/tenants/:id/global/backfill', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = await getTenantById(id);
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });
    try {
      const result = await backfillGlobalSpace(tenant);
      return reply.send(result);
    } catch (err) {
      return reply.code(502).send({
        error: 'backfill_failed',
        message: err instanceof Error ? err.message : 'No se pudo hacer el backfill.',
      });
    }
  });

  app.post('/api/admin/tenants/:id/orgs', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = createOrganizationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const tenant = await getTenantById(id);
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });
    try {
      const org = await createOrganization(tenant, parsed.data);
      return reply.code(201).send(toOrganization(org));
    } catch (err) {
      return reply.code(409).send({
        error: 'conflict',
        message: err instanceof Error ? err.message : 'No se pudo crear la organización.',
      });
    }
  });
}
