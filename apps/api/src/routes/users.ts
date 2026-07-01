import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import { requireAdmin } from '../middleware/auth.js';
import { writeAudit } from '../services/audit.js';
import {
  listUsers,
  createUser,
  setDisplayName,
  resetPassword,
  deactivateUser,
} from '../services/synapse-admin.js';

/**
 * Gestión de usuarios Matrix vía la Synapse Admin API.
 * Opera sobre el homeserver por defecto (modo A: Synapse compartido).
 *   GET   /api/admin/users
 *   POST  /api/admin/users
 *   PATCH /api/admin/users/:userId
 *   POST  /api/admin/users/:userId/reset-password
 *   POST  /api/admin/users/:userId/deactivate
 */
const createUserSchema = z.object({
  localpart: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9._=\-/]+$/, 'localpart inválido'),
  password: z.string().min(8).max(512),
  displayName: z.string().max(120).optional(),
  admin: z.boolean().optional().default(false),
});

const baseUrl = env.MATRIX_DEFAULT_HOMESERVER_URL;
const serverName = env.MATRIX_DEFAULT_SERVER_NAME;

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdmin);

  app.get('/api/admin/users', async (req, reply) => {
    const q = req.query as { limit?: string; from?: string };
    try {
      const result = await listUsers(baseUrl, {
        limit: q.limit ? Number(q.limit) : 100,
        from: q.from ? Number(q.from) : 0,
      });
      return reply.send(result);
    } catch (err) {
      return reply.code(502).send({ error: 'synapse_error', message: msg(err) });
    }
  });

  app.post('/api/admin/users', async (req, reply) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    try {
      const user = await createUser(baseUrl, serverName, parsed.data);
      await writeAudit({ actor: 'admin', action: 'user.create', target: user.userId });
      return reply.code(201).send(user);
    } catch (err) {
      return reply.code(502).send({ error: 'synapse_error', message: msg(err) });
    }
  });

  app.patch('/api/admin/users/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const body = z.object({ displayName: z.string().min(1).max(120) }).safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
    }
    try {
      await setDisplayName(baseUrl, userId, body.data.displayName);
      await writeAudit({ actor: 'admin', action: 'user.update', target: userId });
      return reply.send({ ok: true });
    } catch (err) {
      return reply.code(502).send({ error: 'synapse_error', message: msg(err) });
    }
  });

  app.post('/api/admin/users/:userId/reset-password', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const body = z.object({ password: z.string().min(8).max(512) }).safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'bad_request', issues: body.error.issues });
    }
    try {
      await resetPassword(baseUrl, userId, body.data.password);
      await writeAudit({ actor: 'admin', action: 'user.reset_password', target: userId });
      return reply.send({ ok: true });
    } catch (err) {
      return reply.code(502).send({ error: 'synapse_error', message: msg(err) });
    }
  });

  app.post('/api/admin/users/:userId/deactivate', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    try {
      await deactivateUser(baseUrl, userId);
      await writeAudit({ actor: 'admin', action: 'user.deactivate', target: userId });
      return reply.send({ ok: true });
    } catch (err) {
      return reply.code(502).send({ error: 'synapse_error', message: msg(err) });
    }
  });
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
