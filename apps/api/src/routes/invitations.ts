import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';
import { prisma } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { writeAudit } from '../services/audit.js';
import { createUser, joinUserToRoom } from '../services/synapse-admin.js';

const createSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  localpart: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9._=\-/]+$/, 'localpart inválido'),
  role: z.enum(['owner', 'admin', 'user']).default('user'),
  roomIds: z.array(z.string()).default([]),
  expiresInHours: z.coerce.number().int().min(1).max(720).default(72),
});

const acceptSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(512),
  displayName: z.string().max(120).optional(),
});

function activationUrl(token: string): string {
  return `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/invite/${token}`;
}

/** Rutas admin de invitaciones (protegidas). */
export async function invitationAdminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdmin);

  app.post('/api/admin/invitations', async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: parsed.data.tenantId } });
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 3600 * 1000);
    const invitation = await prisma.invitation.create({
      data: {
        tenantId: tenant.id,
        email: parsed.data.email,
        localpart: parsed.data.localpart,
        role: parsed.data.role,
        roomIds: parsed.data.roomIds,
        token,
        expiresAt,
        createdBy: 'admin',
      },
    });
    await writeAudit({
      actor: 'admin',
      action: 'invitation.create',
      tenantId: tenant.id,
      target: parsed.data.email,
    });
    // El envío por correo (SMTP) es opcional; se devuelve la liga para compartir.
    return reply.code(201).send({ invitation, activationUrl: activationUrl(token) });
  });

  app.get('/api/admin/invitations', async (req, reply) => {
    const q = req.query as { tenantId?: string };
    const invitations = await prisma.invitation.findMany({
      where: q.tenantId ? { tenantId: q.tenantId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return reply.send(
      invitations.map((i) => ({ ...i, activationUrl: activationUrl(i.token) })),
    );
  });

  app.post('/api/admin/invitations/:id/revoke', async (req, reply) => {
    const { id } = req.params as { id: string };
    const inv = await prisma.invitation.findUnique({ where: { id } });
    if (!inv) return reply.code(404).send({ error: 'not_found' });
    await prisma.invitation.update({ where: { id }, data: { status: 'revoked' } });
    await writeAudit({
      actor: 'admin',
      action: 'invitation.revoke',
      tenantId: inv.tenantId,
      target: inv.email,
    });
    return reply.send({ ok: true });
  });
}

/** Ruta pública para aceptar una invitación (sin guard admin). */
export async function invitationPublicRoutes(app: FastifyInstance): Promise<void> {
  // Datos públicos de una invitación (para pintar la pantalla de activación).
  app.get('/api/invitations/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const inv = await prisma.invitation.findUnique({
      where: { token },
      include: { tenant: true },
    });
    if (!inv) return reply.code(404).send({ error: 'not_found' });
    const expired = inv.status === 'expired' || inv.expiresAt < new Date();
    return reply.send({
      status: expired && inv.status === 'pending' ? 'expired' : inv.status,
      email: inv.email,
      localpart: inv.localpart,
      role: inv.role,
      tenantName: inv.tenant.name,
      matrixServerName: inv.tenant.matrixServerName,
    });
  });

  app.post('/api/invitations/accept', async (req, reply) => {
    const parsed = acceptSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const inv = await prisma.invitation.findUnique({ where: { token: parsed.data.token } });
    if (!inv) return reply.code(404).send({ error: 'not_found' });
    if (inv.status !== 'pending') {
      return reply.code(409).send({ error: 'invitation_not_pending', status: inv.status });
    }
    if (inv.expiresAt < new Date()) {
      await prisma.invitation.update({ where: { id: inv.id }, data: { status: 'expired' } });
      return reply.code(410).send({ error: 'invitation_expired' });
    }

    try {
      const user = await createUser(env.MATRIX_DEFAULT_HOMESERVER_URL, env.MATRIX_DEFAULT_SERVER_NAME, {
        localpart: inv.localpart,
        password: parsed.data.password,
        displayName: parsed.data.displayName,
        admin: inv.role === 'owner' || inv.role === 'admin',
      });
      for (const roomId of inv.roomIds) {
        await joinUserToRoom(env.MATRIX_DEFAULT_HOMESERVER_URL, roomId, user.userId);
      }
      await prisma.invitation.update({
        where: { id: inv.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
      await writeAudit({
        actor: user.userId,
        action: 'invitation.accept',
        tenantId: inv.tenantId,
        target: user.userId,
      });
      return reply.send({ ok: true, userId: user.userId });
    } catch (err) {
      return reply.code(502).send({
        error: 'synapse_error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
