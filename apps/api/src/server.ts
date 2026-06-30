import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { ZodError } from 'zod';
import { corsOrigins } from './env.js';
import { logger } from './logger.js';
import { healthRoutes } from './routes/health.js';
import { tenantRoutes } from './routes/tenant.js';
import { adminRoutes } from './routes/admin.js';

/** Construye la instancia Fastify con middlewares, CORS y manejo de errores. */
export async function buildServer() {
  const app = Fastify({ logger });

  await app.register(cors, {
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });
  await app.register(sensible);

  // Middleware de errores: normaliza ZodError y errores genéricos.
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: 'validation_error', issues: error.issues });
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(error);
    return reply.code(status).send({
      error: status >= 500 ? 'internal_error' : 'request_error',
      message: error.message,
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: 'not_found' });
  });

  await app.register(healthRoutes);
  await app.register(tenantRoutes);
  await app.register(adminRoutes);

  return app;
}
