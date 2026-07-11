import type { BotResponseMode, LlmProviderKind } from '@whalabi/shared';
import { DEFAULT_BOT_SYSTEM_PROMPT } from '@whalabi/shared';
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

export interface BotTenantRuntimeConfig {
  tenantId: string;
  slug: string;
  name: string;
  botUserId: string;
}

const TTL_MS = 60_000;
const cache = new Map<string, { value: ResolvedTenantConfig; exp: number }>();

type TenantConfigRow = {
  id: string;
  slug?: string;
  name?: string;
  matrixServerName?: string;
  botUserId?: string | null;
  botEnabled: boolean;
  botSystemPrompt: string | null;
  botResponseMode: BotResponseMode;
  llmProvider: LlmProviderKind;
  llmBaseUrl: string | null;
  llmApiKey: string | null;
  llmModel: string | null;
};

function botUserIdForTenant(tenant: Pick<TenantConfigRow, 'slug' | 'matrixServerName' | 'botUserId'>): string {
  const configured = tenant.botUserId?.trim();
  if (configured) return configured;
  const slug = tenant.slug?.trim() || env.BOT_DEFAULT_TENANT_SLUG;
  const serverName = tenant.matrixServerName?.trim() || env.MATRIX_DEFAULT_SERVER_NAME;
  return `@whalabi-bot-${slug}:${serverName}`;
}

function defaultBaseUrl(provider: LlmProviderKind): string {
  switch (provider) {
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta';
    case 'ollama':
      return 'http://ollama:11434';
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'dummy':
    default:
      return '';
  }
}

function defaultModel(provider: LlmProviderKind): string {
  switch (provider) {
    case 'gemini':
      return 'gemini-3.1-flash-lite';
    case 'ollama':
      return 'llama3.1';
    case 'openai':
      return 'gpt-4o-mini';
    case 'dummy':
    default:
      return 'dummy';
  }
}

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

function tenantConfig(tenant: TenantConfigRow): ResolvedTenantConfig {
  const provider = tenant.llmProvider;
  const model =
    tenant.llmModel?.trim() ||
    (provider === env.LLM_PROVIDER ? env.LLM_MODEL : '') ||
    defaultModel(provider);
  const rawBaseUrl =
    tenant.llmBaseUrl?.trim() ||
    (provider === env.LLM_PROVIDER ? env.LLM_BASE_URL : '') ||
    defaultBaseUrl(provider);
  const baseUrl =
    provider === 'gemini'
      ? rawBaseUrl.replace(/\/openai\/?$/, '').replace(/\/$/, '')
      : rawBaseUrl.replace(/\/$/, '');

  return {
    tenantId: tenant.id,
    botEnabled: tenant.botEnabled,
    systemPrompt: tenant.botSystemPrompt ?? DEFAULT_BOT_SYSTEM_PROMPT,
    responseMode: tenant.botResponseMode,
    llm: {
      provider,
      baseUrl,
      apiKey: decryptSecret(tenant.llmApiKey) ?? env.LLM_API_KEY,
      model,
    },
  };
}

/**
 * Resuelve la configuracion del tenant para un room.
 *
 * En un Synapse compartido, el server_name no distingue organizaciones. Por eso
 * se usa un mapeo persistido roomId -> tenantId y, para rooms nuevos creados
 * desde el frontend, se infiere la organizacion por el sender del primer mensaje.
 */
export async function resolveTenantForRoom(
  roomId: string,
  senderId?: string,
  tenantIdHint?: string,
): Promise<ResolvedTenantConfig> {
  const now = Date.now();
  const cacheKey = tenantIdHint ? `${tenantIdHint}:${roomId}` : roomId;
  const cached = cache.get(cacheKey);
  if (cached && cached.exp > now) return cached.value;

  let value = envConfig(null);

  if (prisma) {
    try {
      const tenantByHint = tenantIdHint
        ? await prisma.tenant.findUnique({ where: { id: tenantIdHint } })
        : null;
      const mapped = tenantByHint
        ? null
        : await prisma.botRoomTenant.findUnique({
            where: { roomId },
            include: { tenant: true },
          });

      let tenant: TenantConfigRow | null = tenantByHint ?? mapped?.tenant ?? null;
      let source = tenantByHint ? 'bot_tenant' : mapped ? 'room_map' : 'fallback';

      if (!tenant && senderId) {
        const membership = await prisma.orgMembership.findUnique({
          where: { userId: senderId },
          include: { tenant: true },
        });
        if (membership?.tenant) {
          tenant = membership.tenant;
          source = 'sender_membership';
        }
      }

      if (!tenant) {
        tenant = await prisma.tenant.findFirst({ where: { spaceId: roomId } });
        if (tenant) source = 'tenant_space';
      }

      if (!tenant) {
        tenant = await prisma.tenant.findUnique({
          where: { slug: env.BOT_DEFAULT_TENANT_SLUG },
        });
        if (tenant) source = 'fallback';
      }

      if (tenant) {
        value = tenantConfig(tenant);
        if (!mapped && source !== 'fallback') {
          await prisma.botRoomTenant.upsert({
            where: { roomId },
            update: { tenantId: tenant.id, source },
            create: { roomId, tenantId: tenant.id, source },
          });
        }
      }
    } catch {
      // Cualquier fallo de DB: usar config de env.
      value = envConfig(null);
    }
  }

  cache.set(cacheKey, { value, exp: now + TTL_MS });
  return value;
}

export async function listEnabledBotTenants(): Promise<BotTenantRuntimeConfig[]> {
  if (!prisma) return [];
  const tenants = await prisma.tenant.findMany({
    where: { botEnabled: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      matrixServerName: true,
      botUserId: true,
      botEnabled: true,
    },
  });
  return tenants.map((tenant) => ({
    tenantId: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    botUserId: botUserIdForTenant(tenant),
  }));
}
