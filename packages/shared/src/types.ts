/**
 * Tipos de dominio compartidos entre web, api y bot.
 *
 * Importante: Whalabi NO almacena mensajes ni rooms como fuente de verdad.
 * Estos tipos describen la *configuración de producto* (tenants, bot, branding)
 * y las formas auxiliares que viajan por la API REST. La mensajería real vive
 * en Matrix/Synapse y se modela con los tipos de matrix-js-sdk.
 */

export type LlmProviderKind = 'openai' | 'ollama' | 'dummy' | 'gemini';

/** Modos en los que el bot decide responder en un room. */
export type BotResponseMode = 'mention' | 'dm' | 'always';

/** Branding visual de un tenant. */
export interface TenantBranding {
  primaryColor: string;
  /** Color de acento secundario (lavanda por defecto). */
  accentColor?: string;
  logoUrl?: string | null;
  /** Texto corto mostrado bajo el logo. */
  tagline?: string | null;
}

/**
 * Tenant — una organización dentro de Whalabi.
 * Resuelto por dominio público.
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  /** Dominio público desde el que se accede (ej. chat.clinica-demo.mx). */
  publicDomain: string;

  // --- Matrix ---
  /** URL base del homeserver Matrix de este tenant (Client-Server API). */
  matrixBaseUrl: string;
  /** server_name de Matrix (la parte después de los dos puntos en @user:server). */
  matrixServerName: string;

  // --- Bot ---
  botUserId: string | null;
  botEnabled: boolean;
  /** Prompt de sistema específico del tenant; null usa el prompt base. */
  botSystemPrompt: string | null;
  botResponseMode: BotResponseMode;

  // --- LLM ---
  llmProvider: LlmProviderKind;
  llmModel: string | null;
  /** Endpoint del LLM (OpenAI-compatible u Ollama). */
  llmBaseUrl: string | null;

  // --- Branding ---
  branding: TenantBranding;
  primaryColor: string;
  logoUrl: string | null;

  // --- Registro ---
  allowRegistration: boolean;

  createdAt: string;
  updatedAt: string;
}

/**
 * Configuración pública que el frontend necesita para un tenant.
 * Nunca incluye secretos (API keys, passwords, tokens).
 */
export interface PublicTenantConfig {
  id: string;
  name: string;
  slug: string;
  publicDomain: string;
  matrixBaseUrl: string;
  matrixServerName: string;
  botEnabled: boolean;
  botUserId: string | null;
  allowRegistration: boolean;
  branding: TenantBranding;
}

/** Entrada de log operativo del bot. Nunca guarda contenido salvo opt-in. */
export interface BotLog {
  id: string;
  tenantId: string;
  roomId: string;
  eventId: string | null;
  userId: string | null;
  status: BotLogStatus;
  /** Solo presente si BOT_STORE_CONTENT=true. */
  content: string | null;
  error: string | null;
  createdAt: string;
}

export type BotLogStatus =
  | 'received'
  | 'ignored'
  | 'processing'
  | 'responded'
  | 'rate_limited'
  | 'error';

/** Input que el bot envía al proveedor LLM. */
export interface LLMInput {
  systemPrompt: string;
  /** Historial de mensajes recientes del room (rol + texto). */
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  model: string;
  /** Identificador del room para trazabilidad (no se envía al LLM). */
  roomId?: string;
  maxTokens?: number;
  temperature?: number;
}

/** Output normalizado del proveedor LLM. */
export interface LLMOutput {
  text: string;
  model: string;
  /** Tokens aproximados usados, si el proveedor los reporta. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/** Resultado de probar el bot/LLM desde el panel admin. */
export interface BotTestResult {
  ok: boolean;
  provider: LlmProviderKind;
  model: string;
  output?: string;
  error?: string;
  latencyMs: number;
}
