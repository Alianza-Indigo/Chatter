import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Acceso opcional a la base de Whalabi para logs operativos del bot.
 * Si no hay DATABASE_URL, los logs solo van a stdout (el bot sigue operando).
 *
 * El cliente Prisma se genera desde el schema de la API:
 *   pnpm --filter @whalabi/bot db:generate
 */
let prisma: PrismaClient | null = null;
let tenantId: string | null = null;

if (env.DATABASE_URL) {
  try {
    prisma = new PrismaClient({ log: ['error'] });
  } catch (err) {
    logger.warn({ err }, 'No se pudo inicializar Prisma; logs solo en consola.');
  }
}

/** Resuelve y cachea el tenantId asociado al bot (por slug por defecto). */
async function getTenantId(): Promise<string | null> {
  if (tenantId || !prisma) return tenantId;
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: env.BOT_DEFAULT_TENANT_SLUG },
    });
    tenantId = tenant?.id ?? null;
  } catch {
    tenantId = null;
  }
  return tenantId;
}

export type LogStatus =
  | 'received'
  | 'ignored'
  | 'processing'
  | 'responded'
  | 'rate_limited'
  | 'error';

export interface LogEntry {
  roomId: string;
  eventId?: string | null;
  userId?: string | null;
  status: LogStatus;
  content?: string | null;
  error?: string | null;
}

/** Registra un evento operativo. Nunca lanza (los fallos de log no rompen el bot). */
export async function logEvent(entry: LogEntry): Promise<void> {
  const safeContent = env.BOT_STORE_CONTENT ? entry.content ?? null : null;
  logger.info(
    {
      roomId: entry.roomId,
      eventId: entry.eventId,
      userId: entry.userId,
      status: entry.status,
      error: entry.error,
    },
    'bot-event',
  );

  if (!prisma) return;
  try {
    const tid = await getTenantId();
    if (!tid) return;
    await prisma.botLog.create({
      data: {
        tenantId: tid,
        roomId: entry.roomId,
        eventId: entry.eventId ?? null,
        userId: entry.userId ?? null,
        status: entry.status,
        content: safeContent,
        error: entry.error ?? null,
      },
    });
  } catch (err) {
    logger.warn({ err }, 'No se pudo persistir el log del bot.');
  }
}
