import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { requireAdmin } from '../middleware/auth.js';
import { pushEnabled } from '../services/push.js';

/**
 * Observabilidad para el panel admin.
 *   GET /api/admin/status   estado del sistema (API, DB, Synapse, contadores)
 *   GET /api/admin/audit    registro de auditoría
 */
export async function observabilityRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdmin);

  app.get('/api/admin/status', async (_req, reply) => {
    const [dbApp, synapse] = await Promise.all([checkDbApp(), checkSynapse()]);

    let counts = { tenants: 0, invitationsPending: 0, botErrors24h: 0 };
    try {
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      const [tenants, invitationsPending, botErrors24h] = await Promise.all([
        prisma.tenant.count(),
        prisma.invitation.count({ where: { status: 'pending' } }),
        prisma.botLog.count({ where: { status: 'error', createdAt: { gte: since } } }),
      ]);
      counts = { tenants, invitationsPending, botErrors24h };
    } catch {
      // dejar contadores en 0 si la DB falla
    }

    return reply.send({
      time: new Date().toISOString(),
      services: {
        api: true,
        dbApp,
        synapse,
        push: pushEnabled(),
      },
      counts,
    });
  });

  app.get('/api/admin/audit', async (req, reply) => {
    const q = z
      .object({
        tenantId: z.string().optional(),
        action: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      })
      .safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'bad_request', issues: q.error.issues });

    const logs = await prisma.auditLog.findMany({
      where: {
        ...(q.data.tenantId ? { tenantId: q.data.tenantId } : {}),
        ...(q.data.action ? { action: q.data.action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: q.data.limit,
    });
    return reply.send(logs);
  });
}

async function checkDbApp(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkSynapse(): Promise<boolean> {
  try {
    const res = await fetch(`${env.MATRIX_DEFAULT_HOMESERVER_URL.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
