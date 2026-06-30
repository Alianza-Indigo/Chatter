import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import { issueAdminToken } from '../middleware/auth.js';

const loginSchema = z.object({ token: z.string().min(1) });

/**
 * Login administrativo (sin guard).
 *   POST /api/admin/login { token }
 * Verifica el ADMIN_API_TOKEN y devuelve un JWT de 12h para el panel.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/admin/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    if (parsed.data.token !== env.ADMIN_API_TOKEN) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Token inválido.' });
    }
    return reply.send({ token: issueAdminToken(), tokenType: 'Bearer', expiresIn: 43200 });
  });
}
