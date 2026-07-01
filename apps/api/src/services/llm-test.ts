import type { Tenant as PrismaTenant } from '@prisma/client';
import { DEFAULT_BOT_SYSTEM_PROMPT } from '@whalabi/shared';
import type { BotTestResult } from '@whalabi/shared';
import { env } from '../env.js';
import { decryptSecret } from '../crypto.js';

/**
 * Prueba ligera del proveedor LLM desde el panel admin.
 *
 * No depende del paquete del bot: hace una llamada mínima OpenAI-compatible.
 * Para `dummy` devuelve eco. Para `ollama`/`openai` usa los endpoints
 * estándar. La clave del tenant (BYOK) tiene prioridad sobre la de env.
 */
export async function testTenantBot(
  tenant: PrismaTenant | null,
  prompt: string,
): Promise<BotTestResult> {
  const provider = tenant?.llmProvider ?? env.LLM_PROVIDER;
  const model = tenant?.llmModel ?? env.LLM_MODEL;
  const baseUrl = tenant?.llmBaseUrl ?? env.LLM_BASE_URL;
  const apiKey = (tenant?.llmApiKey ? decryptSecret(tenant.llmApiKey) : null) ?? env.LLM_API_KEY;
  const systemPrompt = tenant?.botSystemPrompt ?? DEFAULT_BOT_SYSTEM_PROMPT;

  const start = Date.now();

  if (provider === 'dummy') {
    return {
      ok: true,
      provider: 'dummy',
      model,
      output: `[dummy] Recibí: "${prompt}"`,
      latencyMs: Date.now() - start,
    };
  }

  try {
    if (provider === 'gemini') {
      const base = baseUrl.replace(/\/openai\/?$/, '').replace(/\/$/, '');
      const res = await fetch(`${base}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const output = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('')
        .trim();
      return { ok: true, provider, model, output, latencyMs: Date.now() - start };
    }

    if (provider === 'ollama') {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { message?: { content?: string } };
      return {
        ok: true,
        provider,
        model,
        output: data.message?.content ?? '',
        latencyMs: Date.now() - start,
      };
    }

    // openai-compatible
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 256,
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return {
      ok: true,
      provider,
      model,
      output: data.choices?.[0]?.message?.content ?? '',
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      provider,
      model,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}
