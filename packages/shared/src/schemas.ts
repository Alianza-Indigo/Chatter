/**
 * Esquemas Zod para validación en API y bot.
 * Reflejan los tipos de `types.ts`.
 */
import { z } from 'zod';

export const llmProviderKindSchema = z.enum(['openai', 'ollama', 'dummy']);
export const botResponseModeSchema = z.enum(['mention', 'dm', 'always']);

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

/** Cuerpo para crear un tenant. */
export const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'slug solo minúsculas, números y guiones'),
  publicDomain: z.string().min(3).max(253),
  matrixBaseUrl: z.string().url(),
  matrixServerName: z.string().min(1),
  botUserId: z.string().nullable().optional(),
  botEnabled: z.boolean().default(false),
  botSystemPrompt: z.string().max(4000).nullable().optional(),
  botResponseMode: botResponseModeSchema.default('mention'),
  llmProvider: llmProviderKindSchema.default('dummy'),
  llmModel: z.string().nullable().optional(),
  llmBaseUrl: z.string().url().nullable().optional(),
  /** Clave API del LLM (BYOK). Se cifra en reposo y nunca se expone al frontend. */
  llmApiKey: z.string().nullable().optional(),
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
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type BotTestInput = z.infer<typeof botTestSchema>;
export type BotLogsQuery = z.infer<typeof botLogsQuerySchema>;
