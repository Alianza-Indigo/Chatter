/**
 * Esquemas Zod para validación en API y bot.
 * Reflejan los tipos de `types.ts`.
 */
import { z } from 'zod';

export const llmProviderKindSchema = z.enum(['openai', 'ollama', 'dummy', 'gemini']);
export const botResponseModeSchema = z.enum(['mention', 'dm', 'always']);

/**
 * Código de acceso de una organización. Amigable de teclear: letras, números,
 * guiones y guiones bajos; sin espacios. Se compara sin distinguir mayúsculas.
 */
export const orgCodeSchema = z
  .string()
  .trim()
  .min(3, 'El código es muy corto')
  .max(48)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Solo letras, números, guiones y guiones bajos');

export const tenantBrandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Debe ser un color hex'),
  accentColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Debe ser un color hex')
    .optional(),
  logoUrl: z.string().url().nullable().optional(),
  tagline: z.string().max(140).nullable().optional(),
});

/** Cuerpo para crear una organización (tenant). */
export const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'slug solo minúsculas, números y guiones'),
  /** Dominio propio (opcional). Por ahora se distingue por código, no por dominio. */
  publicDomain: z.string().min(3).max(253).nullable().optional(),
  /**
   * Acceso: true (por defecto) = aislada con código; false = general (sin código,
   * sus miembros van al espacio general).
   */
  requiresCode: z.boolean().default(true),
  /** Solo si requiresCode. Si se omite, se genera del nombre. */
  code: orgCodeSchema.optional(),
  /** Matrix: por defecto el homeserver del despliegue (se rellena en el servidor). */
  matrixBaseUrl: z.string().url().optional(),
  matrixServerName: z.string().min(1).optional(),
  botUserId: z
    .string()
    .regex(/^@[^:]+:.+$/, 'Debe ser un Matrix ID completo, p. ej. @bot:whalabi.app')
    .nullable()
    .optional(),
  botEnabled: z.boolean().default(false),
  botSystemPrompt: z.string().max(20000, 'El prompt no puede exceder 20000 caracteres').nullable().optional(),
  botResponseMode: botResponseModeSchema.default('mention'),
  llmProvider: llmProviderKindSchema.default('dummy'),
  llmModel: z.string().max(200).nullable().optional(),
  /** Endpoint del LLM. No forzamos formato URL estricto para no romper el alta
   *  si falta el https:// o es un host relativo; el proveedor lo normaliza. */
  llmBaseUrl: z.string().max(500).nullable().optional(),
  /** Clave API del LLM (BYOK). Se cifra en reposo y nunca se expone al frontend. */
  llmApiKey: z.string().max(500).nullable().optional(),
  branding: tenantBrandingSchema.optional(),
  allowRegistration: z.boolean().default(false),
});

/** Cuerpo para actualizar un tenant (todo opcional). */
export const updateTenantSchema = createTenantSchema.partial();

/** Query para resolver tenant por dominio. */
export const resolveTenantQuerySchema = z.object({
  domain: z.string().min(1),
});

/** Cuerpo para probar el bot. */
export const botTestSchema = z.object({
  tenantId: z.string().optional(),
  prompt: z.string().min(1).max(2000),
});

/** Query para listar logs del bot. */
export const botLogsQuerySchema = z.object({
  tenantId: z.string().optional(),
  roomId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  status: z
    .enum(['received', 'ignored', 'processing', 'responded', 'rate_limited', 'error'])
    .optional(),
});

/**
 * Cuerpo para unir al usuario recién registrado a su espacio.
 * El usuario se autentica con su propio access token de Matrix (Authorization:
 * Bearer), no aquí; este cuerpo solo trae el código (vacío = espacio Global).
 */
export const joinOrgSchema = z.object({
  code: z.string().trim().max(48).optional().nullable(),
});

/** Suscripción Web Push enviada por el frontend. */
export const pushSubscriptionSchema = z.object({
  userId: z.string().min(1),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type JoinOrgInput = z.infer<typeof joinOrgSchema>;
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type BotTestInput = z.infer<typeof botTestSchema>;
export type BotLogsQuery = z.infer<typeof botLogsQuerySchema>;
