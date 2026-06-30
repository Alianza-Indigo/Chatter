import type { FastifyInstance } from 'fastify';
import {
  createTenantSchema,
  updateTenantSchema,
  botTestSchema,
  botLogsQuerySchema,
} from '@whalabi/shared';
import { prisma } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  createTenant,
  getTenantById,
  listTenants,
  updateTenant,
} from '../services/tenant.js';
import { testTenantBot } from '../services/llm-test.js';
import { sendToUser } from '../services/push.js';
import { toTenant } from '../mappers.js';

/**
 * Endpoints administrativos protegidos por `x-admin-token`.
 *   POST   /api/admin/tenants
 *   GET    /api/admin/tenants
 *   GET    /api/admin/tenants/:id
 *   PATCH  /api/admin/tenants/:id
 *   GET    /api/admin/bot/logs
 *   POST   /api/admin/bot/test
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdmin);

  app.get('/api/admin/tenants', async (_req, reply) => {
    const tenants = await listTenants();
    return reply.send(tenants.map(toTenant));
  });

  app.post('/api/admin/tenants', async (req, reply) => {
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    try {
      const tenant = await createTenant(parsed.data);
      return reply.code(201).send(toTenant(tenant));
    } catch (err) {
      return reply.code(409).send({
        error: 'conflict',
        message: err instanceof Error ? err.message : 'No se pudo crear el tenant',
      });
    }
  });

  app.get('/api/admin/tenants/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenant = await getTenantById(id);
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });
    return reply.send(toTenant(tenant));
  });

  app.patch('/api/admin/tenants/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const existing = await getTenantById(id);
    if (!existing) return reply.code(404).send({ error: 'tenant_not_found' });
    const tenant = await updateTenant(id, parsed.data);
    return reply.send(toTenant(tenant));
  });

  app.get('/api/admin/bot/logs', async (req, reply) => {
    const parsed = botLogsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const { tenantId, roomId, status, limit } = parsed.data;
    const logs = await prisma.botLog.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(roomId ? { roomId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return reply.send(logs);
  });

  app.post('/api/admin/bot/test', async (req, reply) => {
    const parsed = botTestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const tenant = parsed.data.tenantId ? await getTenantById(parsed.data.tenantId) : null;
    const result = await testTenantBot(tenant, parsed.data.prompt);
    return reply.send(result);
  });

  // Envía una notificación Web Push de prueba a un usuario.
  app.post('/api/admin/push/test', async (req, reply) => {
    const body = req.body as { tenantId?: string; userId?: string; message?: string };
    if (!body.tenantId || !body.userId) {
      return reply.code(400).send({ error: 'bad_request', message: 'tenantId y userId requeridos' });
    }
    const result = await sendToUser(body.tenantId, body.userId, {
      title: 'Whalabi',
      body: body.message ?? 'Notificación de prueba',
      url: '/chat',
    });
    return reply.send(result);
  });
}
