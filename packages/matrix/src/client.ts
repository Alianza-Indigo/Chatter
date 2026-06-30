/**
 * WhalabiMatrixClient — wrapper delgado sobre matrix-js-sdk.
 *
 * Toda la mensajería real (sync, envío, timelines) la maneja matrix-js-sdk.
 * Este wrapper expone una superficie pequeña y estable para el frontend,
 * sin reimplementar la Client-Server API ni inventar webhooks.
 */
import {
  createClient,
  ClientEvent,
  RoomEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  Direction,
  EventType,
  MsgType,
  Preset,
  Visibility,
} from 'matrix-js-sdk';
import { serverNameFromUserId } from '@whalabi/shared';
import type {
  LoginParams,
  RegisterParams,
  RoomSummary,
  TimelineMessage,
  UserProfile,
  WhalabiSession,
} from './types';

export type RoomsUpdatedHandler = (rooms: RoomSummary[]) => void;
export type TimelineUpdatedHandler = (roomId: string, messages: TimelineMessage[]) => void;
export type SyncStateHandler = (state: string) => void;

export class WhalabiMatrixClient {
  private client: MatrixClient | null = null;
  private session: WhalabiSession | null = null;

  private roomsHandlers = new Set<RoomsUpdatedHandler>();
  private timelineHandlers = new Set<TimelineUpdatedHandler>();
  private syncHandlers = new Set<SyncStateHandler>();

  // -------------------------------------------------------------------------
  // Autenticación
  // -------------------------------------------------------------------------

  /** Login con usuario/contraseña Matrix. Devuelve la sesión persistible. */
  async login(params: LoginParams): Promise<WhalabiSession> {
    const tmp = createClient({ baseUrl: params.homeserverUrl });
    const identifierUser = params.user.startsWith('@')
      ? params.user.split(':')[0]?.slice(1) ?? params.user
      : params.user;

    const res = await tmp.login('m.login.password', {
      identifier: { type: 'm.id.user', user: identifierUser },
      password: params.password,
      initial_device_display_name: 'Whalabi Web',
    });

    const session: WhalabiSession = {
      userId: res.user_id,
      deviceId: res.device_id,
      accessToken: res.access_token,
      homeserverUrl: params.homeserverUrl,
    };
    this.session = session;
    return session;
  }

  /**
   * Registro Matrix. Puede requerir varios pasos UIA; se maneja el flujo
   * `m.login.dummy` y el de token de registro. Errores claros si el
   * homeserver no permite registro abierto.
   */
  async register(params: RegisterParams): Promise<WhalabiSession> {
    const tmp = createClient({ baseUrl: params.homeserverUrl });

    const doRegister = (auth?: Record<string, unknown>) =>
      tmp.registerRequest({
        username: params.username,
        password: params.password,
        ...(auth ? { auth: auth as never } : {}),
        initial_device_display_name: 'Whalabi Web',
      });

    try {
      // Primera llamada: normalmente devuelve 401 con los flows disponibles.
      const res = await doRegister();
      return this.sessionFromRegister(res, params.homeserverUrl);
    } catch (err: unknown) {
      const e = err as { httpStatus?: number; data?: { session?: string; flows?: unknown } };
      if (e.httpStatus === 401 && e.data?.session) {
        const session = e.data.session;
        // Intentar token de registro si se proporcionó, si no dummy.
        const auth = params.registrationToken
          ? {
              type: 'm.login.registration_token',
              token: params.registrationToken,
              session,
            }
          : { type: 'm.login.dummy', session };
        const res = await doRegister(auth);
        return this.sessionFromRegister(res, params.homeserverUrl);
      }
      throw err;
    }
  }

  private sessionFromRegister(
    res: { user_id: string; device_id?: string; access_token?: string },
    homeserverUrl: string,
  ): WhalabiSession {
    const session: WhalabiSession = {
      userId: res.user_id,
      deviceId: res.device_id ?? '',
      accessToken: res.access_token ?? '',
      homeserverUrl,
    };
    this.session = session;
    return session;
  }

  /** Restaura una sesión previamente persistida y crea el cliente real. */
  restore(session: WhalabiSession): void {
    this.session = session;
    this.client = createClient({
      baseUrl: session.homeserverUrl,
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId || undefined,
    });
  }

  /** Cierra sesión, detiene el sync e invalida el token en el servidor. */
  async logout(): Promise<void> {
    if (this.client) {
      this.stopSync();
      try {
        await this.client.logout(true);
      } catch {
        // ignorar errores de red en logout
      }
      this.client = null;
    }
    this.session = null;
  }

  getSession(): WhalabiSession | null {
    return this.session;
  }

  getUserId(): string | null {
    return this.session?.userId ?? null;
  }

  // -------------------------------------------------------------------------
  // Sync
  // -------------------------------------------------------------------------

  /** Arranca el sync de Matrix. Debe llamarse tras `restore()`. */
  async startSync(): Promise<void> {
    if (!this.client) throw new Error('Cliente no inicializado: llama a restore() primero');
    const client = this.client;

    client.on(ClientEvent.Sync, (state: string) => {
      this.syncHandlers.forEach((h) => h(state));
      if (state === 'PREPARED' || state === 'SYNCING') {
        this.emitRooms();
      }
    });

    client.on(RoomEvent.Timeline, (_ev: MatrixEvent, room?: Room) => {
      this.emitRooms();
      if (room) this.emitTimeline(room.roomId);
    });

    await client.startClient({ initialSyncLimit: 30 });
  }

  stopSync(): void {
    this.client?.stopClient();
  }

  // -------------------------------------------------------------------------
  // Rooms
  // -------------------------------------------------------------------------

  getRooms(): RoomSummary[] {
    if (!this.client) return [];
    const rooms = this.client.getRooms();
    return rooms
      .filter((r) => r.getMyMembership() === 'join')
      .map((r) => this.toRoomSummary(r))
      .sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
  }

  /** Crea un room. Si `invite` incluye MXIDs, los invita. `isDirect` para DMs. */
  async createRoom(opts: {
    name?: string;
    invite?: string[];
    isDirect?: boolean;
    topic?: string;
  }): Promise<string> {
    if (!this.client) throw new Error('Cliente no inicializado');
    const res = await this.client.createRoom({
      name: opts.name,
      topic: opts.topic,
      invite: opts.invite,
      is_direct: opts.isDirect ?? false,
      preset: opts.isDirect ? Preset.TrustedPrivateChat : Preset.PrivateChat,
      visibility: Visibility.Private,
    });
    return res.room_id;
  }

  /** Une al usuario a un room por ID o alias. */
  async joinRoom(roomIdOrAlias: string): Promise<string> {
    if (!this.client) throw new Error('Cliente no inicializado');
    const room = await this.client.joinRoom(roomIdOrAlias);
    return room.roomId;
  }

  /** Invita a un usuario a un room (útil para invitar al bot). */
  async invite(roomId: string, userId: string): Promise<void> {
    if (!this.client) throw new Error('Cliente no inicializado');
    await this.client.invite(roomId, userId);
  }

  // -------------------------------------------------------------------------
  // Mensajes
  // -------------------------------------------------------------------------

  /** Envía un mensaje de texto al room. */
  async sendMessage(roomId: string, body: string): Promise<string> {
    if (!this.client) throw new Error('Cliente no inicializado');
    const res = await this.client.sendEvent(roomId, EventType.RoomMessage, {
      msgtype: MsgType.Text,
      body,
    });
    return res.event_id;
  }

  /** Devuelve el timeline (mensajes) actual de un room. */
  getTimeline(roomId: string): TimelineMessage[] {
    if (!this.client) return [];
    const room = this.client.getRoom(roomId);
    if (!room) return [];
    const myId = this.session?.userId ?? '';
    const events = room.getLiveTimeline().getEvents();
    return events
      .filter((ev) => ev.getType() === EventType.RoomMessage && !ev.isRedacted())
      .map((ev) => this.toTimelineMessage(ev, room, myId));
  }

  /** Carga más historia hacia atrás en el timeline de un room. */
  async loadOlderMessages(roomId: string, limit = 30): Promise<void> {
    if (!this.client) return;
    const room = this.client.getRoom(roomId);
    if (!room) return;
    await this.client.scrollback(room, limit);
    this.emitTimeline(roomId);
  }

  /** Marca el último mensaje del room como leído. */
  async markRead(roomId: string): Promise<void> {
    if (!this.client) return;
    const room = this.client.getRoom(roomId);
    if (!room) return;
    const events = room.getLiveTimeline().getEvents();
    const last = events[events.length - 1];
    if (last) await this.client.sendReadReceipt(last);
  }

  // -------------------------------------------------------------------------
  // Perfil
  // -------------------------------------------------------------------------

  async getProfile(userId?: string): Promise<UserProfile> {
    if (!this.client) throw new Error('Cliente no inicializado');
    const id = userId ?? this.session?.userId;
    if (!id) throw new Error('Sin userId');
    const profile = await this.client.getProfileInfo(id);
    return {
      userId: id,
      displayName: profile.displayname ?? null,
      avatarUrl: profile.avatar_url
        ? this.client.mxcUrlToHttp(profile.avatar_url, 96, 96, 'crop') ?? null
        : null,
    };
  }

  async setDisplayName(name: string): Promise<void> {
    if (!this.client) throw new Error('Cliente no inicializado');
    await this.client.setDisplayName(name);
  }

  // -------------------------------------------------------------------------
  // Suscripciones (para React)
  // -------------------------------------------------------------------------

  onRoomsUpdated(h: RoomsUpdatedHandler): () => void {
    this.roomsHandlers.add(h);
    return () => this.roomsHandlers.delete(h);
  }

  onTimelineUpdated(h: TimelineUpdatedHandler): () => void {
    this.timelineHandlers.add(h);
    return () => this.timelineHandlers.delete(h);
  }

  onSyncState(h: SyncStateHandler): () => void {
    this.syncHandlers.add(h);
    return () => this.syncHandlers.delete(h);
  }

  // -------------------------------------------------------------------------
  // Internos
  // -------------------------------------------------------------------------

  private emitRooms(): void {
    const rooms = this.getRooms();
    this.roomsHandlers.forEach((h) => h(rooms));
  }

  private emitTimeline(roomId: string): void {
    const msgs = this.getTimeline(roomId);
    this.timelineHandlers.forEach((h) => h(roomId, msgs));
  }

  private toRoomSummary(room: Room): RoomSummary {
    const events = room.getLiveTimeline().getEvents();
    let lastMessage: string | null = null;
    let lastTs: number | null = null;
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev && ev.getType() === EventType.RoomMessage) {
        lastMessage = (ev.getContent().body as string) ?? null;
        lastTs = ev.getTs();
        break;
      }
    }
    const avatarMxc = room.getMxcAvatarUrl();
    return {
      roomId: room.roomId,
      name: room.name || room.roomId,
      lastMessage,
      lastTs,
      unreadCount: room.getUnreadNotificationCount() ?? 0,
      isDirect: Boolean(room.getDMInviter()) || this.isDirectRoom(room.roomId),
      avatarUrl: avatarMxc
        ? this.client?.mxcUrlToHttp(avatarMxc, 64, 64, 'crop') ?? null
        : null,
    };
  }

  private isDirectRoom(roomId: string): boolean {
    if (!this.client) return false;
    const directEvent = this.client.getAccountData(EventType.Direct);
    if (!directEvent) return false;
    const content = directEvent.getContent<Record<string, string[]>>();
    return Object.values(content).some((ids) => ids.includes(roomId));
  }

  private toTimelineMessage(ev: MatrixEvent, room: Room, myId: string): TimelineMessage {
    const sender = ev.getSender() ?? '';
    const member = room.getMember(sender);
    return {
      eventId: ev.getId() ?? '',
      sender,
      senderDisplayName: member?.name ?? serverNameFromUserId(sender) ?? sender,
      body: (ev.getContent().body as string) ?? '',
      ts: ev.getTs(),
      isOwn: sender === myId,
      msgtype: (ev.getContent().msgtype as string) ?? MsgType.Text,
    };
  }
}

export { Direction };
