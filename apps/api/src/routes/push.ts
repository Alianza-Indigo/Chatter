import type { FastifyInstance } from 'fastify';
import { pushSubscriptionSchema, pushUnsubscribeSchema } from '@whalabi/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { resolveTenantByDomain } from '../services/tenant.js';
import { pushEnabled, sendToUser } from '../services/push.js';

/**
 * Endpoints públicos de Web Push.
 *   GET    /api/push/vapid-public-key
 *   POST   /api/push/subscribe     { userId, subscription }
 *   DELETE /api/push/subscribe     { endpoint }
 *   POST   /api/push/notify-call   { toUserId, callerName, video }
 *
 * El tenant se resuelve por el Host de la petición.
 */
export async function pushRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/push/vapid-public-key', async (_req, reply) => {
    return reply.send({ enabled: pushEnabled(), publicKey: env.VAPID_PUBLIC_KEY || null });
  });

  app.post('/api/push/subscribe', async (req, reply) => {
    const parsed = pushSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const host =
      (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
    const tenant = await resolveTenantByDomain(host);
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });

    const { userId, subscription } = parsed.data;
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        tenantId: tenant.id,
        userId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      create: {
        tenantId: tenant.id,
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
    return reply.code(201).send({ ok: true });
  });

  // Avisa por push a un usuario de una llamada entrante. Lo dispara el que llama,
  // para que a quien recibe le suene aunque tenga la app en segundo plano/cerrada.
  app.post('/api/push/notify-call', async (req, reply) => {
    const body = (req.body ?? {}) as {
      toUserId?: unknown;
      callerName?: unknown;
      video?: unknown;
    };
    const toUserId = typeof body.toUserId === 'string' ? body.toUserId : '';
    const callerName = typeof body.callerName === 'string' ? body.callerName : 'Alguien';
    const video = body.video === true;
    if (!toUserId) return reply.code(400).send({ error: 'bad_request' });

    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'localhost';
    const tenant = await resolveTenantByDomain(host);
    if (!tenant) return reply.code(404).send({ error: 'tenant_not_found' });

    const result = await sendToUser(tenant.id, toUserId, {
      title: `${video ? 'Videollamada' : 'Llamada'} entrante`,
      body: callerName,
      url: '/chat',
      type: 'call',
    });
    return reply.send({ ok: true, ...result });
  });

  app.delete('/api/push/subscribe', async (req, reply) => {
    const parsed = pushUnsubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    await prisma.pushSubscription
      .delete({ where: { endpoint: parsed.data.endpoint } })
      .catch(() => {});
    return reply.send({ ok: true });
  });
}
