import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, isEncrypted } from './crypto';

describe('crypto (con APP_ENCRYPTION_KEY)', () => {
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = 'clave-de-prueba-suficientemente-larga';
  });
  afterEach(() => {
    delete process.env.APP_ENCRYPTION_KEY;
  });

  it('cifra y descifra (round-trip)', () => {
    const enc = encryptSecret('sk-super-secreto');
    expect(enc).not.toBeNull();
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain('sk-super-secreto');
    expect(decryptSecret(enc)).toBe('sk-super-secreto');
  });

  it('produce ciphertext distinto cada vez (IV aleatorio)', () => {
    expect(encryptSecret('mismo')).not.toBe(encryptSecret('mismo'));
  });

  it('no re-cifra un valor ya cifrado', () => {
    const once = encryptSecret('x')!;
    expect(encryptSecret(once)).toBe(once);
  });

  it('trata null/empty como null', () => {
    expect(encryptSecret(null)).toBeNull();
    expect(encryptSecret('')).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });
});

describe('crypto (sin clave configurada)', () => {
  beforeEach(() => {
    delete process.env.APP_ENCRYPTION_KEY;
  });

  it('guarda en claro como fallback de desarrollo', () => {
    expect(encryptSecret('plano')).toBe('plano');
  });

  it('lee texto plano legado tal cual', () => {
    expect(decryptSecret('texto-plano-legado')).toBe('texto-plano-legado');
  });
});
