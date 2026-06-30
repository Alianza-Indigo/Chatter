import crypto from 'node:crypto';

/**
 * Cifrado de secretos en reposo (AES-256-GCM).
 *
 * La clave se deriva de APP_ENCRYPTION_KEY (cualquier longitud) con SHA-256.
 * Formato de salida: `enc:v1:<base64(iv|tag|ciphertext)>`.
 *
 * Si no hay APP_ENCRYPTION_KEY definida, los valores se guardan/leen en claro
 * (solo aceptable en desarrollo). En producción, DEFINE la clave.
 *
 * NOTA: este módulo es idéntico en apps/api y apps/bot a propósito (ambos
 * procesos Node necesitan descifrar la clave LLM por tenant sin acoplar
 * node:crypto al paquete shared, que también se consume en el navegador).
 */
const ALGO = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

function getKey(): Buffer | null {
  const raw = process.env.APP_ENCRYPTION_KEY ?? '';
  if (!raw) return null;
  return crypto.createHash('sha256').update(raw).digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Cifra un secreto. Sin clave configurada, devuelve el texto plano (dev). */
export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === '') return null;
  if (isEncrypted(plain)) return plain; // ya cifrado
  const key = getKey();
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Descifra un secreto. Acepta texto plano legado (no prefijado). */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value;
  const key = getKey();
  if (!key) return null;
  const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
