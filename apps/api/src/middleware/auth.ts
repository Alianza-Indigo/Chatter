import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export interface AdminClaims {
  role: 'admin';
}

/** Emite un JWT de administrador firmado con ADMIN_JWT_SECRET. */
export function issueAdminToken(): string {
  return jwt.sign({ role: 'admin' } satisfies AdminClaims, env.ADMIN_JWT_SECRET, {
    expiresIn: '12h',
  });
}

/**
 * Guard para /api/admin/*. Acepta:
 *   1. `Authorization: Bearer <jwt>` firmado con ADMIN_JWT_SECRET (recomendado), o
 *   2. `x-admin-token: <ADMIN_API_TOKEN>` (token estático, compatibilidad/bootstrap).
 *
 * El token estático sirve para el primer login (`POST /api/admin/login`), que
 * devuelve un JWT de vida corta para el resto de operaciones del panel.
 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.slice(7), env.ADMIN_JWT_SECRET);
      if (typeof decoded === 'object' && (decoded as AdminClaims).role === 'admin') return;
    } catch {
      // token inválido/expirado -> cae al chequeo del token estático
    }
  }

  const staticToken = req.headers['x-admin-token'];
  if (typeof staticToken === 'string' && staticToken.length > 0 && staticToken === env.ADMIN_API_TOKEN) {
    return;
  }

  reply.code(401).send({ error: 'unauthorized', message: 'Credenciales de administración inválidas.' });
}
