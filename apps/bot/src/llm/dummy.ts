import type { LLMProvider, LLMInput, LLMOutput } from './provider.js';

/**
 * Proveedor dummy para desarrollo sin clave de LLM.
 * Devuelve una respuesta determinista basada en el último mensaje.
 */
export class DummyProvider implements LLMProvider {
  readonly kind = 'dummy';

  async generateResponse(input: LLMInput): Promise<LLMOutput> {
    const last = [...input.messages].reverse().find((m) => m.role === 'user');
    const text = last
      ? `Hola, soy el asistente de Whalabi (modo demo). Recibí: "${last.content.slice(0, 200)}". ` +
        'Configura un proveedor LLM real (LLM_PROVIDER=openai|ollama) para respuestas inteligentes.'
      : 'Hola, soy el asistente de Whalabi (modo demo).';
    return { text, model: input.model || 'dummy' };
  }
}
