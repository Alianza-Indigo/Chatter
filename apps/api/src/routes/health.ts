import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_req, reply) => {
    let db = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    const status = db ? 200 : 503;
    return reply.code(status).send({
      status: db ? 'ok' : 'degraded',
      service: 'whalabi-api',
      db,
      time: new Date().toISOString(),
    });
  });
}
