import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';
import { mayContact } from '../services/org.js';

/**
 * Endpoints internos consumidos por infraestructura (no por el navegador).
 *   GET /api/internal/may-contact?from=<mxid>&to=<mxid>   -> { allow: boolean }
 *
 * Lo llama el módulo de aislamiento de Synapse (whalabi_isolation) en cada
 * invitación para decidir si dos usuarios pueden contactarse. Se autentica con
 * un secreto compartido en la cabecera `x-internal-secret`. Si no hay secreto
 * configurado, el endpoint responde 403 y el módulo hace fail-open.
 */
export async function internalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/internal/may-contact', async (req, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply.code(403).send({ error: 'disabled' });
    }
    if ((req.headers['x-internal-secret'] as string) !== env.INTERNAL_API_SECRET) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) {
      return reply.code(400).send({ error: 'bad_request', message: 'from y to requeridos' });
    }
    const allow = await mayContact(from, to);
    return reply.send({ allow });
  });
}
