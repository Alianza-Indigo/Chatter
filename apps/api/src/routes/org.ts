import type { FastifyInstance } from 'fastify';
import { joinOrgSchema } from '@whalabi/shared';
import { env } from '../env.js';
import { resolveTenantByCode, resolveTenantByDomain } from '../services/tenant.js';
import { joinUserByCode } from '../services/org.js';
import { whoami } from '../services/synapse-admin.js';
import { logger } from '../logger.js';

function hostOf(req: { headers: Record<string, unknown> }): string {
  return (
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers.host as string) ||
    'localhost'
  );
}

/**
 * Rutas públicas del multitenant híbrido (ingreso a organización).
 *   GET  /api/org/check?code=   Valida un código ANTES de registrar.
 *   POST /api/org/join          Une al usuario recién registrado a su espacio.
 */
export async function orgPublicRoutes(app: FastifyInstance): Promise<void> {
  // Comprueba un código antes de crear la cuenta (evita cuentas huérfanas).
  app.get('/api/org/check', async (req, reply) => {
    const code = ((req.query as { code?: string }).code ?? '').trim();
    if (!code) return reply.send({ valid: true, scope: 'general' });
    const org = await resolveTenantByCode(code);
    return reply.send(
      org ? { valid: true, scope: 'organization', name: org.name } : { valid: false },
    );
  });

  // Une al usuario a su organización. Se autentica con su propio access token
  // Matrix (Authorization: Bearer); la API confirma su identidad con whoami.
  app.post('/api/org/join', async (req, reply) => {
    const parsed = joinOrgSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }

    const auth = (req.headers.authorization as string) || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Falta el token de acceso.' });
    }

    const hostTenant = await resolveTenantByDomain(hostOf(req));
    if (!hostTenant) return reply.code(404).send({ error: 'tenant_not_found' });

    const userId = await whoami(env.MATRIX_DEFAULT_HOMESERVER_URL, token);
    if (!userId) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Token de acceso inválido.' });
    }

    try {
      const result = await joinUserByCode(hostTenant, userId, parsed.data.code);
      return reply.send(result);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'INVALID_ORG_CODE') {
        return reply.code(422).send({
          error: 'invalid_org_code',
          message: 'El código de organización no es válido.',
        });
      }
      logger.error({ err, userId }, 'Fallo al unir al usuario a su organización');
      return reply.code(502).send({
        error: 'join_failed',
        message: 'No se pudo unir a la organización. Intenta de nuevo.',
      });
    }
  });
}
