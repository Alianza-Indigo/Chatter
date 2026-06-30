import { describe, it, expect } from 'vitest';
import { createLLMProvider } from './index';
import { DummyProvider } from './dummy';
import { OpenAICompatibleProvider } from './openai';
import { OllamaProvider } from './ollama';

describe('createLLMProvider', () => {
  it('devuelve DummyProvider para "dummy"', () => {
    const p = createLLMProvider({ provider: 'dummy', baseUrl: '', apiKey: '' });
    expect(p).toBeInstanceOf(DummyProvider);
    expect(p.kind).toBe('dummy');
  });

  it('devuelve OpenAICompatibleProvider para "openai"', () => {
    const p = createLLMProvider({
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    });
    expect(p).toBeInstanceOf(OpenAICompatibleProvider);
  });

  it('devuelve OllamaProvider para "ollama"', () => {
    const p = createLLMProvider({
      provider: 'ollama',
      baseUrl: 'http://localhost:11434',
      apiKey: '',
    });
    expect(p).toBeInstanceOf(OllamaProvider);
  });
});

describe('DummyProvider', () => {
  it('hace eco del último mensaje de usuario sin tocar la red', async () => {
    const p = new DummyProvider();
    const out = await p.generateResponse({
      systemPrompt: 'sys',
      messages: [
        { role: 'user', content: 'primer mensaje' },
        { role: 'assistant', content: 'respuesta previa' },
        { role: 'user', content: '¿qué eres?' },
      ],
      model: 'dummy',
    });
    expect(out.text).toContain('¿qué eres?');
    expect(out.model).toBe('dummy');
  });

  it('responde aunque no haya mensajes de usuario', async () => {
    const p = new DummyProvider();
    const out = await p.generateResponse({ systemPrompt: 'sys', messages: [], model: 'dummy' });
    expect(out.text.length).toBeGreaterThan(0);
  });
});
