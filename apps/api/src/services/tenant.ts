import type { Tenant as PrismaTenant } from '@prisma/client';
import { normalizeDomain } from '@whalabi/shared';
import type { CreateTenantInput, UpdateTenantInput } from '@whalabi/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { encryptSecret } from '../crypto.js';
import { createUser, setDisplayName } from './synapse-admin.js';

const ADMIN_HS = env.MATRIX_DEFAULT_HOMESERVER_URL;

/**
 * Resuelve un tenant por dominio público. Si no hay match exacto, intenta el
 * tenant `default`. Devuelve null si no existe ninguno.
 */
export async function resolveTenantByDomain(domain: string): Promise<PrismaTenant | null> {
  const normalized = normalizeDomain(domain);
  // publicDomain ya no es único (varias orgs pueden compartir dominio); findFirst.
  const exact = await prisma.tenant.findFirst({ where: { publicDomain: normalized } });
  if (exact) return exact;
  return prisma.tenant.findUnique({ where: { slug: 'default' } });
}

/** Resuelve una organización por su código de acceso (normalizado a minúsculas). */
export async function resolveTenantByCode(code: string): Promise<PrismaTenant | null> {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  return prisma.tenant.findUnique({ where: { code: normalized } });
}

export async function getTenantById(id: string): Promise<PrismaTenant | null> {
  return prisma.tenant.findUnique({ where: { id } });
}

export async function listTenants(): Promise<PrismaTenant[]> {
  return prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
}

/** Normaliza un código de organización (minúsculas, sin espacios). */
export function normalizeOrgCode(input: string): string {
  return input.trim().toLowerCase();
}

/** Deriva un código a partir del nombre cuando no se da uno explícito. */
function codeFromName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'org';
}

/** Slug único: el `base`; si ya existe, prueba base-2, base-3, … El slug es un
 *  id interno, así que se ajusta solo sin molestar al admin. */
async function uniqueSlug(base: string): Promise<string> {
  const clean = normalizeOrgCode(base).replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'org';
  let candidate = clean;
  for (let i = 2; i < 1000; i++) {
    const clash = await prisma.tenant.findUnique({ where: { slug: candidate } });
    if (!clash) return candidate;
    candidate = `${clean}-${i}`;
  }
  return `${clean}-${clean.length}`;
}

function botLocalpartFromSlug(slug: string): string {
  const clean = normalizeOrgCode(slug).replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `whalabi-bot-${clean || 'org'}`;
}

function botUserIdFor(slug: string, serverName: string): string {
  return `@${botLocalpartFromSlug(slug)}:${serverName}`;
}

function splitMatrixUserId(userId: string): { localpart: string; serverName: string } | null {
  const match = /^@([^:]+):(.+)$/.exec(userId.trim());
  if (!match) return null;
  return { localpart: match[1]!, serverName: match[2]! };
}

async function ensureTenantBotAccount(tenant: PrismaTenant): Promise<void> {
  if (!tenant.botEnabled) return;
  if (!env.BOT_PASSWORD) {
    throw new Error('BOT_PASSWORD es obligatorio para crear bots independientes por organizacion.');
  }
  const botUserId = tenant.botUserId?.trim();
  if (!botUserId) return;
  const parsed = splitMatrixUserId(botUserId);
  if (!parsed) throw new Error(`botUserId invalido: ${botUserId}`);
  try {
    await setDisplayName(ADMIN_HS, botUserId, `${tenant.name} Bot`);
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('404') && !message.includes('M_NOT_FOUND')) throw err;
  }
  await createUser(ADMIN_HS, parsed.serverName, {
    localpart: parsed.localpart,
    password: env.BOT_PASSWORD,
    displayName: `${tenant.name} Bot`,
    admin: false,
  });
}

export async function createTenant(input: CreateTenantInput): Promise<PrismaTenant> {
  // Código de acceso: con código -> aislada; sin código -> general (null).
  let code: string | null = null;
  if (input.requiresCode !== false) {
    code = normalizeOrgCode(input.code ?? codeFromName(input.name));
    const clash = await prisma.tenant.findUnique({ where: { code } });
    if (clash) throw new Error(`Ya existe una organización con el código "${code}".`);
  }
  // El slug es interno; garantizamos unicidad automáticamente para no romper el alta.
  const slug = await uniqueSlug(input.slug || input.name);
  const matrixServerName = input.matrixServerName ?? env.MATRIX_DEFAULT_SERVER_NAME;
  const tenant = await prisma.tenant.create({
    data: {
      name: input.name,
      slug,
      publicDomain: input.publicDomain ? normalizeDomain(input.publicDomain) : null,
      code,
      // matrixBaseUrl es la URL que usa el NAVEGADOR del usuario para conectarse
      // al homeserver → debe ser PÚBLICA (APP_PUBLIC_URL, p. ej. https://whalabi.app).
      // Las operaciones server-side (Admin API) usan el Synapse interno por código.
      matrixBaseUrl: input.matrixBaseUrl ?? env.APP_PUBLIC_URL,
      matrixServerName,
      botUserId: input.botUserId ?? botUserIdFor(slug, matrixServerName),
      botEnabled: input.botEnabled ?? false,
      botSystemPrompt: input.botSystemPrompt ?? null,
      botResponseMode: input.botResponseMode ?? 'mention',
      llmProvider: input.llmProvider ?? 'dummy',
      llmModel: input.llmModel ?? null,
      llmBaseUrl: input.llmBaseUrl ?? null,
      llmApiKey: encryptSecret(input.llmApiKey),
      primaryColor: input.branding?.primaryColor ?? '#4f46e5',
      accentColor: input.branding?.accentColor ?? '#a78bfa',
      logoUrl: input.branding?.logoUrl ?? null,
      tagline: input.branding?.tagline ?? null,
      allowRegistration: input.allowRegistration ?? false,
    },
  });
  await ensureTenantBotAccount(tenant);
  return tenant;
}

export async function updateTenant(
  id: string,
  input: UpdateTenantInput,
): Promise<PrismaTenant> {
  // Código: requiresCode false -> general (null); si llega code, se normaliza y
  // se valida que no choque con otra organización.
  let code: string | null | undefined;
  if (input.requiresCode === false) {
    code = null;
  } else if (input.code !== undefined) {
    code = normalizeOrgCode(input.code);
    const clash = await prisma.tenant.findUnique({ where: { code } });
    if (clash && clash.id !== id) {
      throw new Error(`Ya existe una organización con el código "${code}".`);
    }
  }
  const existing = await prisma.tenant.findUnique({ where: { id } });
  if (!existing) throw new Error('Organizacion no encontrada.');
  const nextSlug = input.slug ?? existing.slug;
  const nextServerName = input.matrixServerName ?? existing.matrixServerName;
  const nextBotUserId =
    input.botUserId === undefined
      ? existing.botUserId ?? botUserIdFor(nextSlug, nextServerName)
      : input.botUserId || botUserIdFor(nextSlug, nextServerName);

  const tenant = await prisma.tenant.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      publicDomain:
        input.publicDomain === undefined
          ? undefined
          : input.publicDomain
            ? normalizeDomain(input.publicDomain)
            : null,
      code,
      matrixBaseUrl: input.matrixBaseUrl,
      matrixServerName: input.matrixServerName,
      botUserId: nextBotUserId,
      botEnabled: input.botEnabled,
      botSystemPrompt: input.botSystemPrompt,
      botResponseMode: input.botResponseMode,
      llmProvider: input.llmProvider,
      llmModel: input.llmModel,
      llmBaseUrl: input.llmBaseUrl,
      // Solo re-cifra si se envía explícitamente (undefined deja el valor actual).
      llmApiKey: input.llmApiKey === undefined ? undefined : encryptSecret(input.llmApiKey),
      primaryColor: input.branding?.primaryColor,
      accentColor: input.branding?.accentColor,
      logoUrl: input.branding?.logoUrl,
      tagline: input.branding?.tagline,
      allowRegistration: input.allowRegistration,
    },
  });
  await ensureTenantBotAccount(tenant);
  return tenant;
}

/**
 * Asegura que exista el tenant `default` a partir de la configuración de env.
 * Idempotente: útil al arrancar la API en desarrollo.
 */
export async function ensureDefaultTenant(): Promise<PrismaTenant> {
  const existing = await prisma.tenant.findUnique({ where: { slug: 'default' } });
  if (existing) return existing;
  return prisma.tenant.create({
    data: {
      name: 'Whalabi',
      slug: 'default',
      publicDomain: 'localhost',
      matrixBaseUrl: env.MATRIX_DEFAULT_HOMESERVER_URL,
      matrixServerName: env.MATRIX_DEFAULT_SERVER_NAME,
      botEnabled: true,
      botUserId: botUserIdFor('default', env.MATRIX_DEFAULT_SERVER_NAME),
      botResponseMode: 'mention',
      llmProvider: env.LLM_PROVIDER,
      llmModel: env.LLM_MODEL,
      llmBaseUrl: env.LLM_BASE_URL,
      allowRegistration: true,
      tagline: 'El chat privado de tu organización.',
    },
  });
}
