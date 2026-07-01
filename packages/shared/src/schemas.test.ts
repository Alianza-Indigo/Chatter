import { describe, it, expect } from 'vitest';
import { createTenantSchema, resolveTenantQuerySchema, botLogsQuerySchema } from './schemas';

const validTenant = {
  name: 'Clínica Demo',
  slug: 'clinica-demo',
  publicDomain: 'chat.clinica-demo.mx',
  matrixBaseUrl: 'https://matrix.clinica-demo.mx',
  matrixServerName: 'clinica-demo.mx',
};

describe('createTenantSchema', () => {
  it('acepta un tenant válido y aplica defaults', () => {
    const parsed = createTenantSchema.parse(validTenant);
    expect(parsed.botEnabled).toBe(false);
    expect(parsed.llmProvider).toBe('dummy');
    expect(parsed.botResponseMode).toBe('mention');
    expect(parsed.allowRegistration).toBe(false);
  });

  it('rechaza un slug con mayúsculas o espacios', () => {
    expect(createTenantSchema.safeParse({ ...validTenant, slug: 'Clinica Demo' }).success).toBe(
      false,
    );
  });

  it('rechaza una matrixBaseUrl que no es URL', () => {
    expect(
      createTenantSchema.safeParse({ ...validTenant, matrixBaseUrl: 'no-es-url' }).success,
    ).toBe(false);
  });

  it('rechaza un provider LLM desconocido', () => {
    expect(
      createTenantSchema.safeParse({ ...validTenant, llmProvider: 'cohere' }).success,
    ).toBe(false);
  });

  it('acepta el provider gemini', () => {
    expect(
      createTenantSchema.safeParse({ ...validTenant, llmProvider: 'gemini' }).success,
    ).toBe(true);
  });
});

describe('resolveTenantQuerySchema', () => {
  it('exige domain', () => {
    expect(resolveTenantQuerySchema.safeParse({}).success).toBe(false);
    expect(resolveTenantQuerySchema.safeParse({ domain: 'x.mx' }).success).toBe(true);
  });
});

describe('botLogsQuerySchema', () => {
  it('coacciona limit a número y aplica default', () => {
    expect(botLogsQuerySchema.parse({}).limit).toBe(100);
    expect(botLogsQuerySchema.parse({ limit: '25' }).limit).toBe(25);
  });
  it('rechaza limit fuera de rango', () => {
    expect(botLogsQuerySchema.safeParse({ limit: '9999' }).success).toBe(false);
  });
});
