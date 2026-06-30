import type { LLMInput, LLMOutput } from '@whalabi/shared';

/**
 * Abstracción de proveedor LLM. Toda integración (OpenAI-compatible, Ollama,
 * dummy de desarrollo) implementa esta interfaz.
 */
export interface LLMProvider {
  readonly kind: string;
  generateResponse(input: LLMInput): Promise<LLMOutput>;
}

export type { LLMInput, LLMOutput };
