import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Cliente Prisma del bot (opcional). Si no hay DATABASE_URL, el bot opera sin
 * DB: los logs van solo a stdout y la config por tenant cae a los valores de env.
 *
 * El cliente se genera desde el schema de la API:
 *   pnpm --filter @whalabi/bot db:generate
 */
function init(): PrismaClient | null {
  if (!env.DATABASE_URL) return null;
  try {
    return new PrismaClient({ log: ['error'] });
  } catch (err) {
    logger.warn({ err }, 'No se pudo inicializar Prisma; el bot seguirá sin DB.');
    return null;
  }
}

export const prisma: PrismaClient | null = init();
