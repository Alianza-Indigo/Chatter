import { z } from 'zod';

/** Validación y tipado de variables de entorno de la API. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),

  MATRIX_DEFAULT_HOMESERVER_URL: z.string().url().default('http://localhost:8008'),
  MATRIX_DEFAULT_SERVER_NAME: z.string().default('whalabi.local'),

  ADMIN_API_TOKEN: z.string().min(1).default('change-me-admin-api-token'),
  ADMIN_JWT_SECRET: z.string().min(1).default('change-me-please-a-long-random-secret'),
  /** Clave para cifrar secretos en reposo (llmApiKey). Vacía = texto plano (solo dev). */
  APP_ENCRYPTION_KEY: z.string().optional().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Web Push (VAPID). Vacío = push deshabilitado.
  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().default('mailto:admin@whalabi.app'),

  // LLM por defecto (para /api/admin/bot/test cuando el tenant no define clave).
  LLM_PROVIDER: z.enum(['openai', 'ollama', 'dummy']).default('dummy'),
  LLM_API_KEY: z.string().optional().default(''),
  LLM_BASE_URL: z.string().default('https://api.openai.com/v1'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

/** Lista de orígenes CORS permitidos. */
export const corsOrigins = env.CORS_ORIGIN.split(',').map((s) => s.trim());
