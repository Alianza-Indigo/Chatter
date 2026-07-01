import type { LlmProviderKind } from '@whalabi/shared';
import type { LLMProvider } from './provider.js';
import { OpenAICompatibleProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';
import { DummyProvider } from './dummy.js';
import { GeminiProvider } from './gemini.js';

export interface LLMFactoryConfig {
  provider: LlmProviderKind;
  baseUrl: string;
  apiKey: string;
}

/** Construye el proveedor LLM adecuado según la configuración. */
export function createLLMProvider(config: LLMFactoryConfig): LLMProvider {
  switch (config.provider) {
    case 'gemini':
      return new GeminiProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey });
    case 'openai':
      return new OpenAICompatibleProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey });
    case 'ollama':
      return new OllamaProvider({ baseUrl: config.baseUrl });
    case 'dummy':
    default:
      return new DummyProvider();
  }
}

export type { LLMProvider } from './provider.js';
