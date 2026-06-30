import type { Tenant as PrismaTenant } from '@prisma/client';
import { normalizeDomain } from '@whalabi/shared';
import type { CreateTenantInput, UpdateTenantInput } from '@whalabi/shared';
import { prisma } from '../db.js';
import { env } from '../env.js';

/**
 * Resuelve un tenant por dominio público. Si no hay match exacto, intenta el
 * tenant `default`. Devuelve null si no existe ninguno.
 */
export async function resolveTenantByDomain(domain: string): Promise<PrismaTenant | null> {
  const normalized = normalizeDomain(domain);
  const exact = await prisma.tenant.findUnique({ where: { publicDomain: normalized } });
  if (exact) return exact;
  return prisma.tenant.findUnique({ where: { slug: 'default' } });
}

export async function getTenantById(id: string): Promise<PrismaTenant | null> {
  return prisma.tenant.findUnique({ where: { id } });
}

export async function listTenants(): Promise<PrismaTenant[]> {
  return prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
}

export async function createTenant(input: CreateTenantInput): Promise<PrismaTenant> {
  return prisma.tenant.create({
    data: {
      name: input.name,
      slug: input.slug,
      publicDomain: normalizeDomain(input.publicDomain),
      matrixBaseUrl: input.matrixBaseUrl,
      matrixServerName: input.matrixServerName,
      botUserId: input.botUserId ?? null,
      botEnabled: input.botEnabled ?? false,
      botSystemPrompt: input.botSystemPrompt ?? null,
      botResponseMode: input.botResponseMode ?? 'mention',
      llmProvider: input.llmProvider ?? 'dummy',
      llmModel: input.llmModel ?? null,
      llmBaseUrl: input.llmBaseUrl ?? null,
      primaryColor: input.branding?.primaryColor ?? '#4f46e5',
      accentColor: input.branding?.accentColor ?? '#a78bfa',
      logoUrl: input.branding?.logoUrl ?? null,
      tagline: input.branding?.tagline ?? null,
      allowRegistration: input.allowRegistration ?? false,
    },
  });
}

export async function updateTenant(
  id: string,
  input: UpdateTenantInput,
): Promise<PrismaTenant> {
  return prisma.tenant.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      publicDomain: input.publicDomain ? normalizeDomain(input.publicDomain) : undefined,
      matrixBaseUrl: input.matrixBaseUrl,
      matrixServerName: input.matrixServerName,
      botUserId: input.botUserId,
      botEnabled: input.botEnabled,
      botSystemPrompt: input.botSystemPrompt,
      botResponseMode: input.botResponseMode,
      llmProvider: input.llmProvider,
      llmModel: input.llmModel,
      llmBaseUrl: input.llmBaseUrl,
      primaryColor: input.branding?.primaryColor,
      accentColor: input.branding?.accentColor,
      logoUrl: input.branding?.logoUrl,
      tagline: input.branding?.tagline,
      allowRegistration: input.allowRegistration,
    },
  });
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
      botUserId: `@whalabi-bot:${env.MATRIX_DEFAULT_SERVER_NAME}`,
      botResponseMode: 'mention',
      llmProvider: env.LLM_PROVIDER,
      llmModel: env.LLM_MODEL,
      llmBaseUrl: env.LLM_BASE_URL,
      allowRegistration: true,
      tagline: 'El chat privado de tu organización.',
    },
  });
}
