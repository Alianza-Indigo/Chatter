import { WhalabiBot } from './bot.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { listEnabledBotTenants } from './tenants.js';

async function main(): Promise<void> {
  if (!env.BOT_ENABLED) {
    logger.warn('BOT_ENABLED=false — el bot no se iniciará.');
    return;
  }
  const tenants = await listEnabledBotTenants();
  if (tenants.length === 0) {
    const bot = new WhalabiBot();
    await bot.start();
    return;
  }

  const started = await Promise.allSettled(
    tenants.map(async (tenant) => {
      const bot = new WhalabiBot({
        tenantId: tenant.tenantId,
        tenantSlug: tenant.slug,
        botUserId: tenant.botUserId,
        displayName: `${tenant.name} Bot`,
      });
      await bot.start();
    }),
  );
  const failures = started.filter((result) => result.status === 'rejected');
  if (failures.length === tenants.length) {
    throw new Error('No se pudo iniciar ningun bot de organizacion.');
  }
  if (failures.length > 0) {
    logger.warn({ failures: failures.length, total: tenants.length }, 'Algunos bots no iniciaron.');
  }
}

main().catch((err) => {
  logger.error({ err }, 'Fallo al iniciar el bot');
  process.exit(1);
});
