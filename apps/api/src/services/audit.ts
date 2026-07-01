import { prisma } from '../db.js';
import { logger } from '../logger.js';

/** Registra una acción administrativa en el audit log. Nunca lanza. */
export async function writeAudit(entry: {
  actor: string;
  action: string;
  tenantId?: string | null;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        tenantId: entry.tenantId ?? null,
        target: entry.target ?? null,
        metadata: (entry.metadata ?? undefined) as never,
      },
    });
  } catch (err) {
    logger.warn({ err, action: entry.action }, 'No se pudo escribir el audit log');
  }
}
