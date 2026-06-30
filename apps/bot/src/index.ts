import { WhalabiBot } from './bot.js';
import { env } from './env.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  if (!env.BOT_ENABLED) {
    logger.warn('BOT_ENABLED=false — el bot no se iniciará.');
    return;
  }
  const bot = new WhalabiBot();
  await bot.start();
}

main().catch((err) => {
  logger.error({ err }, 'Fallo al iniciar el bot');
  process.exit(1);
});
