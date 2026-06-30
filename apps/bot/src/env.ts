import { z } from 'zod';

/** Variables de entorno del bot. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().optional(),

  BOT_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  BOT_HOMESERVER_URL: z.string().url().default('http://localhost:8008'),
  BOT_USER_ID: z.string().default('@whalabi-bot:whalabi.local'),
  BOT_PASSWORD: z.string().optional().default(''),
  BOT_ACCESS_TOKEN: z.string().optional().default(''),
  BOT_DISPLAY_NAME: z.string().default('Whalabi Bot'),
  BOT_STORE_CONTENT: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  BOT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  BOT_STORAGE_PATH: z.string().default('./.bot-storage'),

  // Tenant por defecto al que se asocian los logs (cuando hay un solo homeserver).
  BOT_DEFAULT_TENANT_SLUG: z.string().default('default'),

  // LLM
  LLM_PROVIDER: z.enum(['openai', 'ollama', 'dummy']).default('dummy'),
  LLM_API_KEY: z.string().optional().default(''),
  LLM_BASE_URL: z.string().default('https://api.openai.com/v1'),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
});

export const env = envSchema.parse(process.env);
