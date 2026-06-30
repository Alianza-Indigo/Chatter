import { env } from './env.js';
import { logger } from './logger.js';
import { prisma } from './db.js';

/**
 * Logs operativos del bot. Si no hay DB, van solo a stdout.
 * Nunca guarda contenido salvo BOT_STORE_CONTENT=true.
 */
export type LogStatus =
  | 'received'
  | 'ignored'
  | 'processing'
  | 'responded'
  | 'rate_limited'
  | 'error';

export interface LogEntry {
  /** Tenant resuelto para el room (null si no se pudo resolver). */
  tenantId: string | null;
  roomId: string;
  eventId?: string | null;
  userId?: string | null;
  status: LogStatus;
  content?: string | null;
  error?: string | null;
}

/** Registra un evento operativo. Nunca lanza (un fallo de log no rompe el bot). */
export async function logEvent(entry: LogEntry): Promise<void> {
  const safeContent = env.BOT_STORE_CONTENT ? entry.content ?? null : null;

  logger.info(
    {
      tenantId: entry.tenantId,
      roomId: entry.roomId,
      eventId: entry.eventId,
      userId: entry.userId,
      status: entry.status,
      error: entry.error,
    },
    'bot-event',
  );

  // Sin DB o sin tenant resuelto: el log queda solo en stdout (no hay FK válida).
  if (!prisma || !entry.tenantId) return;

  try {
    await prisma.botLog.create({
      data: {
        tenantId: entry.tenantId,
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
