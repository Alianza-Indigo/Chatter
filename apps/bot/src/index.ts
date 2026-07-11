import { WhalabiBot } from './bot.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { listEnabledBotTenants, type BotTenantRuntimeConfig } from './tenants.js';

interface RunningBot {
  bot: WhalabiBot;
  config: BotTenantRuntimeConfig;
}

const running = new Map<string, RunningBot>();
const failedUntil = new Map<string, number>();
let reconciling = false;

function runtimeKey(tenant: Pick<BotTenantRuntimeConfig, 'tenantId'>): string {
  return tenant.tenantId;
}

async function startTenantBot(tenant: BotTenantRuntimeConfig): Promise<void> {
  const bot = new WhalabiBot({
    tenantId: tenant.tenantId,
    tenantSlug: tenant.slug,
    botUserId: tenant.botUserId,
    displayName: `${tenant.name} Bot`,
  });
  await bot.start();
  running.set(runtimeKey(tenant), { bot, config: tenant });
}

function stopTenantBot(key: string, reason: string): void {
  const current = running.get(key);
  if (!current) return;
  try {
    current.bot.stop();
  } catch (err) {
    logger.warn({ err, tenantId: key }, 'No se pudo detener el bot de organizacion.');
  }
  running.delete(key);
  logger.info({ tenantId: key, reason }, 'Bot de organizacion detenido.');
}

async function reconcileTenantBots(): Promise<void> {
  if (reconciling) return;
  reconciling = true;
  try {
    const tenants = await listEnabledBotTenants();
    const enabled = new Map(tenants.map((tenant) => [runtimeKey(tenant), tenant]));

    for (const key of running.keys()) {
      const next = enabled.get(key);
      const current = running.get(key);
      if (!next) {
        stopTenantBot(key, 'disabled');
      } else if (current?.config.botUserId !== next.botUserId || current.config.slug !== next.slug) {
        stopTenantBot(key, 'config_changed');
      }
    }

    for (const tenant of tenants) {
      const key = runtimeKey(tenant);
      if (running.has(key)) continue;
      const retryAt = failedUntil.get(key) ?? 0;
      if (retryAt > Date.now()) continue;
      try {
        await startTenantBot(tenant);
        failedUntil.delete(key);
      } catch (err) {
        const retryAfterMs =
          typeof err === 'object' &&
          err !== null &&
          'retryAfterMs' in err &&
          typeof (err as { retryAfterMs?: unknown }).retryAfterMs === 'number'
            ? (err as { retryAfterMs: number }).retryAfterMs
            : env.BOT_TENANT_POLL_MS;
        failedUntil.set(key, Date.now() + Math.max(retryAfterMs, env.BOT_TENANT_POLL_MS));
        logger.error(
          { err, tenantId: tenant.tenantId, botUserId: tenant.botUserId },
          'No se pudo iniciar el bot de organizacion.',
        );
      }
    }

    if (running.size === 0 && tenants.length === 0) {
      const bot = new WhalabiBot();
      await bot.start();
      running.set('env', {
        bot,
        config: {
          tenantId: 'env',
          slug: env.BOT_DEFAULT_TENANT_SLUG,
          name: env.BOT_DISPLAY_NAME,
          botUserId: env.BOT_USER_ID,
        },
      });
    }
  } finally {
    reconciling = false;
  }
}

async function main(): Promise<void> {
  if (!env.BOT_ENABLED) {
    logger.warn('BOT_ENABLED=false — el bot no se iniciara.');
    return;
  }

  await reconcileTenantBots();
  setInterval(() => {
    void reconcileTenantBots().catch((err) => {
      logger.error({ err }, 'Fallo reconciliando bots de organizacion.');
    });
  }, env.BOT_TENANT_POLL_MS);
}

main().catch((err) => {
  logger.error({ err }, 'Fallo al iniciar el bot');
  process.exit(1);
});
