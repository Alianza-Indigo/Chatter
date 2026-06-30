import type { FastifyInstance } from 'fastify';
import { resolveTenantQuerySchema } from '@whalabi/shared';
import { resolveTenantByDomain } from '../services/tenant.js';
import { toPublicConfig } from '../mappers.js';

/**
 * Endpoints públicos de resolución de tenant.
 *   GET /api/tenant/resolve?domain=...
 *   GET /api/tenant/current   (usa el Host de la petición)
 *   GET /api/config/public?domain=...
 *
 * Todos devuelven SOLO configuración pública (sin secretos).
 */
export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/tenant/resolve', async (req, reply) => {
    const parsed = resolveTenantQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const tenant = await resolveTenantByDomain(parsed.data.domain);
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });
    return reply.send(toPublicConfig(tenant));
  });

  app.get('/api/tenant/current', async (req, reply) => {
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
    const tenant = await resolveTenantByDomain(host);
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });
    return reply.send(toPublicConfig(tenant));
  });

  app.get('/api/config/public', async (req, reply) => {
    const q = req.query as { domain?: string };
    const host =
      q.domain || (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
    const tenant = await resolveTenantByDomain(host);
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });
    return reply.send(toPublicConfig(tenant));
  });
}
