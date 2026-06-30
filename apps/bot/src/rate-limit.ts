/**
 * Rate limiter por room en ventana deslizante de 1 minuto.
 * Protege contra abuso y loops del bot.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly maxPerMinute: number) {}

  /** Devuelve true si el room puede responder ahora, registrando el hit. */
  allow(roomId: string): boolean {
    const now = Date.now();
    const windowStart = now - 60_000;
    const arr = (this.hits.get(roomId) ?? []).filter((t) => t > windowStart);
    if (arr.length >= this.maxPerMinute) {
      this.hits.set(roomId, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(roomId, arr);
    return true;
  }
}
