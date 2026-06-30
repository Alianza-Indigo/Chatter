import { describe, it, expect } from 'vitest';
import {
  normalizeDomain,
  serverNameFromUserId,
  buildMatrixId,
  mentionsUser,
  truncate,
  DEFAULT_BOT_SYSTEM_PROMPT,
  DEFAULT_BRANDING,
} from './utils';

describe('normalizeDomain', () => {
  it('quita protocolo, puerto, ruta y pasa a minúsculas', () => {
    expect(normalizeDomain('https://Chat.Clinica-Demo.MX:8443/login')).toBe(
      'chat.clinica-demo.mx',
    );
  });
  it('deja un dominio simple intacto', () => {
    expect(normalizeDomain('whalabi.app')).toBe('whalabi.app');
  });
  it('maneja localhost', () => {
    expect(normalizeDomain('http://localhost:3000')).toBe('localhost');
  });
});

describe('serverNameFromUserId', () => {
  it('extrae el server name de un MXID', () => {
    expect(serverNameFromUserId('@cesar:whalabi.app')).toBe('whalabi.app');
  });
  it('devuelve null si no hay server name', () => {
    expect(serverNameFromUserId('cesar')).toBeNull();
    expect(serverNameFromUserId('@cesar:')).toBeNull();
  });
});

describe('buildMatrixId', () => {
  it('construye un MXID desde localpart y server', () => {
    expect(buildMatrixId('cesar', 'whalabi.app')).toBe('@cesar:whalabi.app');
  });
  it('normaliza un localpart que ya trae @ o :server', () => {
    expect(buildMatrixId('@cesar:otro.com', 'whalabi.app')).toBe('@cesar:whalabi.app');
  });
});

describe('mentionsUser', () => {
  const bot = { userId: '@whalabi-bot:whalabi.app', displayName: 'Whalabi Bot' };

  it('detecta mención por MXID completo', () => {
    expect(mentionsUser('hola @whalabi-bot:whalabi.app', bot)).toBe(true);
  });
  it('detecta mención por localpart', () => {
    expect(mentionsUser('oye @whalabi-bot ¿puedes ayudar?', bot)).toBe(true);
  });
  it('detecta mención por display name (case-insensitive)', () => {
    expect(mentionsUser('gracias whalabi BOT', bot)).toBe(true);
  });
  it('no detecta cuando no se menciona', () => {
    expect(mentionsUser('mensaje normal entre humanos', bot)).toBe(false);
  });
});

describe('truncate', () => {
  it('no toca textos cortos', () => {
    expect(truncate('hola', 10)).toBe('hola');
  });
  it('trunca y añade elipsis', () => {
    const out = truncate('abcdefghij', 5);
    expect(out).toHaveLength(5);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('constantes', () => {
  it('el prompt base no está vacío', () => {
    expect(DEFAULT_BOT_SYSTEM_PROMPT.length).toBeGreaterThan(20);
  });
  it('el branding por defecto usa índigo y lavanda', () => {
    expect(DEFAULT_BRANDING.primaryColor).toBe('#4f46e5');
    expect(DEFAULT_BRANDING.accentColor).toBe('#a78bfa');
  });
});
