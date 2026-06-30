import { describe, it, expect } from 'vitest';
import type { Tenant as PrismaTenant } from '@prisma/client';
import { toPublicConfig, toTenant } from './mappers';

const row: PrismaTenant = {
  id: 'ten_1',
  name: 'Clínica Demo',
  slug: 'clinica-demo',
  publicDomain: 'chat.clinica-demo.mx',
  matrixBaseUrl: 'https://matrix.clinica-demo.mx',
  matrixServerName: 'clinica-demo.mx',
  botUserId: '@whalabi-bot:clinica-demo.mx',
  botEnabled: true,
  botSystemPrompt: 'prompt interno',
  botResponseMode: 'mention',
  llmProvider: 'openai',
  llmModel: 'gpt-4o-mini',
  llmBaseUrl: 'https://api.openai.com/v1',
  llmApiKey: 'sk-SECRETO-NO-EXPONER',
  primaryColor: '#0ea5e9',
  accentColor: '#a78bfa',
  logoUrl: null,
  tagline: 'Comunicación interna',
  allowRegistration: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

describe('toPublicConfig', () => {
  it('NO expone secretos del LLM', () => {
    const pub = toPublicConfig(row);
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain('sk-SECRETO-NO-EXPONER');
    expect(serialized).not.toContain('llmApiKey');
    expect(serialized).not.toContain('prompt interno');
    expect(pub).not.toHaveProperty('llmApiKey');
    expect(pub).not.toHaveProperty('llmProvider');
    expect(pub).not.toHaveProperty('botSystemPrompt');
  });

  it('expone los campos públicos necesarios para el frontend', () => {
    const pub = toPublicConfig(row);
    expect(pub.matrixBaseUrl).toBe('https://matrix.clinica-demo.mx');
    expect(pub.botEnabled).toBe(true);
    expect(pub.botUserId).toBe('@whalabi-bot:clinica-demo.mx');
    expect(pub.branding.primaryColor).toBe('#0ea5e9');
    expect(pub.branding.accentColor).toBe('#a78bfa');
  });
});

describe('toTenant', () => {
  it('serializa fechas a ISO y no incluye la clave del LLM', () => {
    const t = toTenant(row);
    expect(t.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(t.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    // El tipo de dominio Tenant tampoco expone llmApiKey.
    expect(t).not.toHaveProperty('llmApiKey');
  });
});
