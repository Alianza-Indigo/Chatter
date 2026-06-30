import webpush from 'web-push';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { logger } from '../logger.js';

/**
 * Servicio de Web Push real (VAPID).
 *
 * Si no hay claves VAPID configuradas, las funciones son no-ops seguras y el
 * resto de la app sigue funcionando (push deshabilitado).
 *
 * NOTA de alcance: esto cubre el ciclo completo de suscripción y envío. La
 * entrega automática ante CADA mensaje de Matrix requiere un notificador
 * (p. ej. Sygnal como push gateway, o un hook desde el bot). Aquí se expone el
 * envío reutilizable (`sendToUser`) y un endpoint de prueba; conectar la fuente
 * de eventos Matrix queda documentado y fuera de este módulo.
 */
let configured = false;

export function pushEnabled(): boolean {
  if (configured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Envía una notificación a todas las suscripciones de un usuario en un tenant. */
export async function sendToUser(
  tenantId: string,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  if (!pushEnabled()) return { sent: 0, pruned: 0 };

  const subs = await prisma.pushSubscription.findMany({ where: { tenantId, userId } });
  let sent = 0;
  let pruned = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 = suscripción expirada o cancelada: limpiarla.
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { endpoint: s.endpoint } }).catch(() => {});
          pruned += 1;
        } else {
          logger.warn({ err, endpoint: s.endpoint }, 'Fallo al enviar Web Push');
        }
      }
    }),
  );

  return { sent, pruned };
}
