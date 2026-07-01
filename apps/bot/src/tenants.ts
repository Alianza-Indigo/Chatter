import type { BotResponseMode, LlmProviderKind } from '@whalabi/shared';
import { DEFAULT_BOT_SYSTEM_PROMPT, serverNameFromUserId } from '@whalabi/shared';
import { prisma } from './db.js';
import { env } from './env.js';
import { decryptSecret } from './crypto.js';

/** Config efectiva del bot para un room concreto. */
export interface ResolvedTenantConfig {
  tenantId: string | null;
  botEnabled: boolean;
  systemPrompt: string;
  responseMode: BotResponseMode;
  llm: { provider: LlmProviderKind; baseUrl: string; apiKey: string; model: string };
}

const TTL_MS = 60_000;
const cache = new Map<string, { value: ResolvedTenantConfig; exp: number }>();

/** Config por defecto desde variables de entorno (fallback). */
function envConfig(tenantId: string | null): ResolvedTenantConfig {
  return {
    tenantId,
    botEnabled: env.BOT_ENABLED,
    systemPrompt: DEFAULT_BOT_SYSTEM_PROMPT,
    responseMode: 'mention',
    llm: {
      provider: env.LLM_PROVIDER,
      baseUrl: env.LLM_BASE_URL,
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL,
    },
  };
}

/**
 * Resuelve la configuración del tenant para un room.
 *
 * Estrategia: el `server_name` del roomId (`!abc:server`) identifica el
 * homeserver → se busca el tenant por `matrixServerName`. Si no hay match (o no
 * hay DB), cae al tenant `BOT_DEFAULT_TENANT_SLUG` y, en último término, a env.
 *
 * Limitación honesta (modo A, Synapse compartido): si varios tenants comparten
 * el mismo `server_name`, no se pueden distinguir por el roomId; se usaría el
 * tenant por defecto. Para multi-tenant estricto en un solo homeserver haría
 * falta un mapeo explícito room→tenant (fuera de alcance).
 */
export async function resolveTenantForRoom(roomId: string): Promise<ResolvedTenantConfig> {
  const now = Date.now();
  const cached = cache.get(roomId);
  if (cached && cached.exp > now) return cached.value;

  let value = envConfig(null);

  if (prisma) {
    try {
      const serverName = serverNameFromUserId(roomId); // parte tras ':' del roomId
      // orderBy determinista: si varios tenants comparten server_name (modo A),
      // siempre se elige el más antiguo en vez de uno arbitrario.
      const byServer = serverName
        ? await prisma.tenant.findFirst({
            where: { matrixServerName: serverName },
            orderBy: { createdAt: 'asc' },
          })
        : null;
      const tenant =
        byServer ??
        (await prisma.tenant.findUnique({ where: { slug: env.BOT_DEFAULT_TENANT_SLUG } }));

      if (tenant) {
        value = {
          tenantId: tenant.id,
          botEnabled: tenant.botEnabled,
          systemPrompt: tenant.botSystemPrompt ?? DEFAULT_BOT_SYSTEM_PROMPT,
          responseMode: tenant.botResponseMode,
          llm: {
            provider: tenant.llmProvider,
            baseUrl: tenant.llmBaseUrl ?? env.LLM_BASE_URL,
            apiKey: decryptSecret(tenant.llmApiKey) ?? env.LLM_API_KEY,
            model: tenant.llmModel ?? env.LLM_MODEL,
          },
        };
      }
    } catch {
      // Cualquier fallo de DB: usar config de env.
      value = envConfig(null);
    }
  }

  cache.set(roomId, { value, exp: now + TTL_MS });
  return value;
}
