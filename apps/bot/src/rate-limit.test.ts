import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limit';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('permite hasta el máximo por minuto y luego bloquea', () => {
    const rl = new RateLimiter(3);
    expect(rl.allow('!room')).toBe(true);
    expect(rl.allow('!room')).toBe(true);
    expect(rl.allow('!room')).toBe(true);
    expect(rl.allow('!room')).toBe(false);
  });

  it('aplica límites por room de forma independiente', () => {
    const rl = new RateLimiter(1);
    expect(rl.allow('!a')).toBe(true);
    expect(rl.allow('!a')).toBe(false);
    expect(rl.allow('!b')).toBe(true);
  });

  it('vuelve a permitir cuando pasa la ventana de 1 minuto', () => {
    const rl = new RateLimiter(1);
    expect(rl.allow('!room')).toBe(true);
    expect(rl.allow('!room')).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(rl.allow('!room')).toBe(true);
  });
});
