import type { LLMProvider, LLMInput, LLMOutput } from './provider.js';

/** Proveedor para Ollama / vLLM local (endpoint /api/chat estilo Ollama). */
export class OllamaProvider implements LLMProvider {
  readonly kind = 'ollama';

  constructor(private readonly opts: { baseUrl: string }) {}

  async generateResponse(input: LLMInput): Promise<LLMOutput> {
    const url = `${this.opts.baseUrl.replace(/\/$/, '')}/api/chat`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        stream: false,
        options: { temperature: input.temperature ?? 0.4 },
        messages: [
          { role: 'system', content: input.systemPrompt },
          ...input.messages,
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      text: data.message?.content?.trim() ?? '',
      model: input.model,
      usage: {
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
      },
    };
  }
}
