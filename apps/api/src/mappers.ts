import type { Organization as PrismaOrg, Tenant as PrismaTenant } from '@prisma/client';
import type { Organization, Tenant, PublicTenantConfig, TenantBranding } from '@whalabi/shared';

function branding(t: PrismaTenant): TenantBranding {
  return {
    primaryColor: t.primaryColor,
    accentColor: t.accentColor,
    logoUrl: t.logoUrl,
    tagline: t.tagline,
  };
}

/** Mapea un Tenant de Prisma al tipo de dominio completo (uso admin). */
export function toTenant(t: PrismaTenant): Tenant {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    publicDomain: t.publicDomain,
    matrixBaseUrl: t.matrixBaseUrl,
    matrixServerName: t.matrixServerName,
    botUserId: t.botUserId,
    botEnabled: t.botEnabled,
    botSystemPrompt: t.botSystemPrompt,
    botResponseMode: t.botResponseMode,
    llmProvider: t.llmProvider,
    llmModel: t.llmModel,
    llmBaseUrl: t.llmBaseUrl,
    branding: branding(t),
    primaryColor: t.primaryColor,
    logoUrl: t.logoUrl,
    allowRegistration: t.allowRegistration,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Mapea una Organización de Prisma al tipo de dominio. */
export function toOrganization(o: PrismaOrg): Organization {
  return {
    id: o.id,
    tenantId: o.tenantId,
    name: o.name,
    code: o.code,
    spaceId: o.spaceId,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

/**
 * Mapea a la configuración pública para el frontend.
 * Excluye secretos: llmApiKey, llmProvider/model internos, etc.
 */
export function toPublicConfig(t: PrismaTenant): PublicTenantConfig {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    publicDomain: t.publicDomain,
    matrixBaseUrl: t.matrixBaseUrl,
    matrixServerName: t.matrixServerName,
    botEnabled: t.botEnabled,
    botUserId: t.botUserId,
    allowRegistration: t.allowRegistration,
    branding: branding(t),
  };
}
