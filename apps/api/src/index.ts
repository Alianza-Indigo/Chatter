import { buildServer } from './server.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { ensureDefaultTenant } from './services/tenant.js';

async function main(): Promise<void> {
  const app = await buildServer();

  // En desarrollo, garantizar que exista el tenant default.
  if (env.NODE_ENV !== 'production') {
    try {
      await ensureDefaultTenant();
      logger.info('Tenant "default" verificado.');
    } catch (err) {
      logger.warn({ err }, 'No se pudo asegurar el tenant default (¿migraciones aplicadas?).');
    }
  }

  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  logger.info(`Whalabi API escuchando en http://0.0.0.0:${env.API_PORT}`);
}

main().catch((err) => {
  logger.error(err, 'Fallo al arrancar la API');
  process.exit(1);
});
