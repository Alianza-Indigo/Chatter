import {
  MatrixClient,
  MatrixAuth,
  AutojoinRoomsMixin,
  SimpleFsStorageProvider,
} from 'matrix-bot-sdk';
import {
  DEFAULT_BOT_SYSTEM_PROMPT,
  mentionsUser,
  truncate,
  serverNameFromUserId,
} from '@whalabi/shared';
import { env } from './env.js';
import { logger } from './logger.js';
import { RateLimiter } from './rate-limit.js';
import { createLLMProvider, type LLMProvider } from './llm/index.js';
import { logEvent } from './store.js';

const MAX_CONTEXT_MESSAGES = 12;

interface ContextMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Bot Matrix de Whalabi.
 *
 * - Escucha mediante `/sync` (matrix-bot-sdk), NO webhooks.
 * - Ignora sus propios mensajes (anti-loop).
 * - Responde solo en DMs con el bot, por mención, o si el room es modo "always".
 * - Mantiene contexto limitado por room en memoria.
 * - Rate limit por room.
 */
export class WhalabiBot {
  private client!: MatrixClient;
  private botUserId = '';
  private readonly llm: LLMProvider;
  private readonly limiter: RateLimiter;
  private readonly context = new Map<string, ContextMessage[]>();
  /** Cache de membresía (heurística DM): roomId -> nº de miembros conocidos. */
  private readonly directRooms = new Set<string>();

  constructor() {
    this.llm = createLLMProvider({
      provider: env.LLM_PROVIDER,
      baseUrl: env.LLM_BASE_URL,
      apiKey: env.LLM_API_KEY,
    });
    this.limiter = new RateLimiter(env.BOT_RATE_LIMIT_PER_MINUTE);
  }

  async start(): Promise<void> {
    const storage = new SimpleFsStorageProvider(`${env.BOT_STORAGE_PATH}/sync.json`);

    let accessToken = env.BOT_ACCESS_TOKEN;
    if (!accessToken) {
      if (!env.BOT_PASSWORD) {
        throw new Error('Define BOT_ACCESS_TOKEN o BOT_PASSWORD para el bot.');
      }
      const auth = new MatrixAuth(env.BOT_HOMESERVER_URL);
      const localpart = env.BOT_USER_ID.replace(/^@/, '').split(':')[0] ?? env.BOT_USER_ID;
      const authed = await auth.passwordLogin(localpart, env.BOT_PASSWORD);
      accessToken = authed.accessToken;
      logger.info('Bot autenticado por password.');
    }

    this.client = new MatrixClient(env.BOT_HOMESERVER_URL, accessToken, storage);
    AutojoinRoomsMixin.setupOnClient(this.client);

    this.botUserId = await this.client.getUserId();
    try {
      await this.client.setDisplayName(env.BOT_DISPLAY_NAME);
    } catch {
      // no crítico
    }

    this.client.on('room.message', (roomId: string, event: unknown) => {
      void this.handleMessage(roomId, event as MatrixMessageEvent);
    });

    await this.client.start();
    logger.info(`Whalabi Bot iniciado como ${this.botUserId} (LLM: ${this.llm.kind}).`);
  }

  private async handleMessage(roomId: string, event: MatrixMessageEvent): Promise<void> {
    const sender = event.sender;
    const content = event.content;
    if (!content || content.msgtype !== 'm.text' || typeof content.body !== 'string') return;

    // Anti-loop: ignorar mensajes propios.
    if (sender === this.botUserId) return;

    const body = content.body;
    this.pushContext(roomId, 'user', body);

    await logEvent({
      roomId,
      eventId: event.event_id,
      userId: sender,
      status: 'received',
      content: body,
    });

    const isDirect = await this.isDirectRoom(roomId);
    const mentioned = mentionsUser(body, {
      userId: this.botUserId,
      displayName: env.BOT_DISPLAY_NAME,
    });
    // Modo "always" no se conoce sin config por-room; aquí cubrimos DM + mención.
    const shouldRespond = isDirect || mentioned;

    if (!shouldRespond) {
      await logEvent({ roomId, eventId: event.event_id, userId: sender, status: 'ignored' });
      return;
    }

    if (!this.limiter.allow(roomId)) {
      await logEvent({ roomId, eventId: event.event_id, userId: sender, status: 'rate_limited' });
      return;
    }

    await logEvent({ roomId, eventId: event.event_id, userId: sender, status: 'processing' });

    try {
      const output = await this.llm.generateResponse({
        systemPrompt: DEFAULT_BOT_SYSTEM_PROMPT,
        messages: this.context.get(roomId) ?? [{ role: 'user', content: body }],
        model: env.LLM_MODEL,
        roomId,
      });
      const text = output.text || 'No tengo una respuesta en este momento.';
      this.pushContext(roomId, 'assistant', text);
      await this.client.sendText(roomId, text);
      await logEvent({
        roomId,
        eventId: event.event_id,
        userId: sender,
        status: 'responded',
        content: text,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, roomId }, 'Error generando respuesta del bot');
      await logEvent({
        roomId,
        eventId: event.event_id,
        userId: sender,
        status: 'error',
        error: truncate(message, 500),
      });
      try {
        await this.client.sendText(
          roomId,
          'Lo siento, ocurrió un error al procesar tu mensaje.',
        );
      } catch {
        // ignorar
      }
    }
  }

  private pushContext(roomId: string, role: 'user' | 'assistant', content: string): void {
    const arr = this.context.get(roomId) ?? [];
    arr.push({ role, content });
    while (arr.length > MAX_CONTEXT_MESSAGES) arr.shift();
    this.context.set(roomId, arr);
  }

  /**
   * Heurística de DM: un room es DM con el bot si tiene exactamente 2 miembros
   * unidos y uno es el bot. Se cachea para evitar llamadas repetidas.
   */
  private async isDirectRoom(roomId: string): Promise<boolean> {
    if (this.directRooms.has(roomId)) return true;
    try {
      const members = await this.client.getJoinedRoomMembers(roomId);
      const isDm = members.length === 2 && members.includes(this.botUserId);
      if (isDm) this.directRooms.add(roomId);
      return isDm;
    } catch {
      return false;
    }
  }
}

/** Forma mínima de un evento de mensaje de matrix-bot-sdk. */
interface MatrixMessageEvent {
  event_id?: string;
  sender: string;
  content?: { msgtype?: string; body?: string };
}

export { serverNameFromUserId };
