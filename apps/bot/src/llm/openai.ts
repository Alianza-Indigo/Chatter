import type { LLMProvider, LLMInput, LLMOutput } from './provider.js';

/** Proveedor compatible con la API de OpenAI (/chat/completions). */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly kind = 'openai';

  constructor(
    private readonly opts: { baseUrl: string; apiKey: string },
  ) {}

  async generateResponse(input: LLMInput): Promise<LLMOutput> {
    const url = `${this.opts.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: 'system', content: input.systemPrompt },
          ...input.messages,
        ],
        temperature: input.temperature ?? 0.4,
        max_tokens: input.maxTokens ?? 512,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI-compatible ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    return {
      text: data.choices?.[0]?.message?.content?.trim() ?? '',
      model: input.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}
