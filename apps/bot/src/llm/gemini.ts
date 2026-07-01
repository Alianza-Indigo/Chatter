import type { LLMProvider, LLMInput, LLMOutput } from './provider.js';

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiPart {
  text?: string;
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  groundingMetadata?: {
    groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
  };
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

/**
 * Proveedor Gemini NATIVO con Google Search grounding.
 *
 * A diferencia del proveedor OpenAI-compatible, usa el endpoint
 * `:generateContent` de la API nativa de Gemini con la herramienta
 * `google_search`, lo que da respuestas ancladas a búsquedas web en tiempo real
 * y adjunta las fuentes citadas. Usa la misma API key de Gemini (AI Studio).
 *
 * Nota: el grounding requiere un modelo que lo soporte (p. ej. gemini-2.5-flash /
 * gemini-2.0-flash / flash-lite recientes). Si el modelo no lo soporta, la API
 * devuelve error y conviene cambiar de modelo.
 */
export class GeminiProvider implements LLMProvider {
  readonly kind = 'gemini';

  constructor(private readonly opts: { baseUrl: string; apiKey: string }) {}

  async generateResponse(input: LLMInput): Promise<LLMOutput> {
    try {
      return await this.call(input, true); // con búsqueda web (grounding)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // La cuota de grounding (free tier) es muy baja / requiere billing. Si da
      // 429, degradamos con elegancia: respondemos SIN búsqueda web.
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        const out = await this.call(input, false);
        return {
          ...out,
          text:
            out.text +
            '\n\n_(Respondido sin búsqueda web: se alcanzó el límite de la cuota de ' +
            'Google Search. Activa facturación en Google AI Studio para búsqueda en ' +
            'tiempo real.)_',
        };
      }
      throw err;
    }
  }

  private async call(input: LLMInput, useGrounding: boolean): Promise<LLMOutput> {
    // Acepta tanto la base nativa como la OpenAI-compatible (le quita /openai).
    const base = (this.opts.baseUrl || DEFAULT_BASE)
      .replace(/\/openai\/?$/, '')
      .replace(/\/$/, '');
    const url = `${base}/models/${input.model}:generateContent`;

    const contents = input.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body = {
      system_instruction: { parts: [{ text: input.systemPrompt }] },
      contents,
      ...(useGrounding ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: {
        temperature: input.temperature ?? 0.4,
        maxOutputTokens: input.maxTokens ?? 1024,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.opts.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as GeminiResponse;
    const cand = data.candidates?.[0];
    let text = (cand?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();

    // Adjunta fuentes del grounding (máx. 3) para que la respuesta sea verificable.
    const sources = (cand?.groundingMetadata?.groundingChunks ?? [])
      .map((c) => c.web?.uri)
      .filter((u): u is string => Boolean(u))
      .slice(0, 3);
    if (sources.length > 0) {
      text += '\n\nFuentes:\n' + sources.map((s) => `• ${s}`).join('\n');
    }

    return {
      text,
      model: input.model,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  }
}
