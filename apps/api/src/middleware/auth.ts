import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../env.js';

/**
 * Guard simple para endpoints /api/admin/*.
 * Requiere la cabecera `x-admin-token` igual a ADMIN_API_TOKEN.
 *
 * Nota: para producción real conviene migrar a JWT firmado con ADMIN_JWT_SECRET
 * y sesiones; este token estático cubre el panel administrativo inicial.
 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.headers['x-admin-token'];
  if (typeof token !== 'string' || token.length === 0 || token !== env.ADMIN_API_TOKEN) {
    reply.code(401).send({ error: 'unauthorized', message: 'Token de administración inválido.' });
  }
}
