import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenAICompatibleProvider } from './openai';
import { OllamaProvider } from './ollama';

afterEach(() => {
  vi.unstubAllGlobals();
});

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

describe('OpenAICompatibleProvider', () => {
  it('llama a /chat/completions con auth y parsea la respuesta', async () => {
    const fetchMock = vi.fn<FetchFn>(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '  hola humano  ' } }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const p = new OpenAICompatibleProvider({
      baseUrl: 'https://api.example.com/v1/',
      apiKey: 'sk-abc',
    });
    const out = await p.generateResponse({
      systemPrompt: 'sys',
      messages: [{ role: 'user', content: 'hola' }],
      model: 'gpt-4o-mini',
    });

    expect(out.text).toBe('hola humano');
    expect(out.usage?.totalTokens).toBe(8);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    const headers = init!.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-abc');
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
  });

  it('lanza error en respuesta no-OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 })),
    );
    const p = new OpenAICompatibleProvider({ baseUrl: 'https://x.example/v1', apiKey: '' });
    await expect(
      p.generateResponse({ systemPrompt: 's', messages: [], model: 'm' }),
    ).rejects.toThrow(/500/);
  });
});

describe('OllamaProvider', () => {
  it('llama a /api/chat sin auth y parsea message.content', async () => {
    const fetchMock = vi.fn<FetchFn>(async () =>
      new Response(
        JSON.stringify({ message: { content: 'respuesta local' }, eval_count: 12 }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const p = new OllamaProvider({ baseUrl: 'http://localhost:11434' });
    const out = await p.generateResponse({
      systemPrompt: 'sys',
      messages: [{ role: 'user', content: 'hola' }],
      model: 'llama3',
    });

    expect(out.text).toBe('respuesta local');
    expect(out.usage?.completionTokens).toBe(12);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:11434/api/chat');
    const headers = (init!.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });
});
