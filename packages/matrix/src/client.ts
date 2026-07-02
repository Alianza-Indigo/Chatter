/**
 * WhalabiMatrixClient — wrapper delgado sobre matrix-js-sdk.
 *
 * Toda la mensajería real (sync, envío, timelines, reacciones, adjuntos) la
 * maneja matrix-js-sdk. Este wrapper expone una superficie pequeña y estable
 * para el frontend, sin reimplementar la Client-Server API.
 */
import {
  createClient,
  ClientEvent,
  RoomEvent,
  RoomMemberEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  type RoomMember as SdkRoomMember,
  Direction,
  EventType,
  EventStatus,
  MsgType,
  Preset,
  Visibility,
  RelationType,
} from 'matrix-js-sdk';
import {
  CallEvent,
  CallState,
  CallType,
  CallErrorCode,
  type MatrixCall,
} from 'matrix-js-sdk/lib/webrtc/call';
import { CallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/callEventHandler';
import { serverNameFromUserId } from '@whalabi/shared';
import type {
  LoginParams,
  RegisterParams,
  RoomSummary,
  TimelineMessage,
  MessageReaction,
  RoomMember,
  UserProfile,
  UserSearchResult,
  ActiveCall,
  CallPhase,
  WhalabiSession,
} from './types';

export type RoomsUpdatedHandler = (rooms: RoomSummary[]) => void;
export type TimelineUpdatedHandler = (roomId: string, messages: TimelineMessage[]) => void;
export type SyncStateHandler = (state: string) => void;
export type CallHandler = (call: ActiveCall | null) => void;
export type TypingHandler = (roomId: string, userIds: string[]) => void;

export class WhalabiMatrixClient {
  private client: MatrixClient | null = null;
  private session: WhalabiSession | null = null;

  private roomsHandlers = new Set<RoomsUpdatedHandler>();
  private timelineHandlers = new Set<TimelineUpdatedHandler>();
  private syncHandlers = new Set<SyncStateHandler>();
  private typingHandlers = new Set<TypingHandler>();
  private callHandlers = new Set<CallHandler>();

  // Llamada 1:1 activa (WebRTC vía matrix-js-sdk). Solo una a la vez.
  private currentCall: MatrixCall | null = null;
  private callIncoming = false;

  // -------------------------------------------------------------------------
  // Autenticación
  // -------------------------------------------------------------------------

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

  async register(params: RegisterParams): Promise<WhalabiSession> {
    const tmp = createClient({ baseUrl: params.homeserverUrl });
    const base = {
      username: params.username,
      password: params.password,
      initial_device_display_name: 'Whalabi Web',
    };

    // Recorre las etapas de autenticación interactiva (UIA). Soporta los flujos
    // habituales de Synapse: reCAPTCHA (m.login.recaptcha) y/o token de registro
    // (m.login.registration_token), cerrando con m.login.dummy.
    const SUPPORTED = ['m.login.recaptcha', 'm.login.registration_token', 'm.login.dummy'];
    let session: string | undefined;
    let completed: string[] = [];
    let flows: Array<{ stages: string[] }> = [];

    for (let attempt = 0; attempt < 5; attempt++) {
      let auth: Record<string, unknown> | undefined;
      if (session) {
        const flow = flows.find((f) => f.stages.every((s) => SUPPORTED.includes(s))) ?? flows[0];
        const next = flow?.stages.find((s) => !completed.includes(s));
        if (!next || next === 'm.login.dummy') {
          auth = { type: 'm.login.dummy', session };
        } else if (next === 'm.login.recaptcha') {
          if (!params.captchaResponse) {
            throw new Error('Completa el CAPTCHA para crear la cuenta.');
          }
          auth = { type: 'm.login.recaptcha', response: params.captchaResponse, session };
        } else if (next === 'm.login.registration_token') {
          if (!params.registrationToken) {
            throw new Error('Se requiere un token de registro para crear la cuenta.');
          }
          auth = { type: 'm.login.registration_token', token: params.registrationToken, session };
        } else {
          throw new Error(`El registro requiere un paso no soportado: ${next}`);
        }
      }

      try {
        const res = await tmp.registerRequest({ ...base, ...(auth ? { auth: auth as never } : {}) });
        return this.sessionFromRegister(res, params.homeserverUrl);
      } catch (err: unknown) {
        const e = err as {
          httpStatus?: number;
          data?: { session?: string; flows?: Array<{ stages: string[] }>; completed?: string[] };
        };
        if (e.httpStatus === 401 && e.data?.session) {
          session = e.data.session;
          completed = e.data.completed ?? completed;
          flows = e.data.flows ?? flows;
          continue;
        }
        throw err;
      }
    }
    throw new Error('No se pudo completar el registro (demasiados pasos de autenticación).');
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

  restore(session: WhalabiSession): void {
    this.session = session;
    this.client = createClient({
      baseUrl: session.homeserverUrl,
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId || undefined,
    });
  }

  async logout(): Promise<void> {
    if (this.client) {
      this.stopSync();
      try {
        await this.client.logout(true);
      } catch {
        /* ignore */
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

  async startSync(): Promise<void> {
    if (!this.client) throw new Error('Cliente no inicializado: llama a restore() primero');
    const client = this.client;

    client.on(ClientEvent.Sync, (state: string) => {
      this.syncHandlers.forEach((h) => h(state));
      if (state === 'PREPARED' || state === 'SYNCING') this.emitRooms();
      // Al terminar el primer sync, unirse a cualquier invitación pendiente.
      if (state === 'PREPARED') this.autoJoinInvites();
    });

    // Un room recién creado/entrado (p. ej. al abrir un chat directo) o un cambio
    // de membresía deben reflejarse de inmediato en la lista, sin esperar al
    // siguiente ciclo de sync. Sin esto, al iniciar un chat el room no aparece a
    // tiempo y la conversación no se abre.
    client.on(ClientEvent.Room, () => this.emitRooms());
    client.on(RoomEvent.MyMembership, (room: Room, membership: string) => {
      this.emitRooms();
      // Estilo WhatsApp: que te escriban o te agreguen simplemente funciona, sin
      // tener que "aceptar" una invitación. Al recibir una, nos unimos solos.
      if (membership === 'invite') {
        client.joinRoom(room.roomId).catch(() => {
          /* si falla el auto-join, el room igual aparece como invitación */
        });
      }
    });

    client.on(RoomEvent.Timeline, (_ev: MatrixEvent, room?: Room) => {
      this.emitRooms();
      if (room) this.emitTimeline(room.roomId);
    });
    client.on(RoomEvent.Redaction, (_ev: MatrixEvent, room?: Room) => {
      if (room) this.emitTimeline(room.roomId);
    });
    client.on(RoomEvent.LocalEchoUpdated, (_ev: MatrixEvent, room: Room) => {
      this.emitTimeline(room.roomId);
    });
    client.on(RoomMemberEvent.Typing, (_ev: MatrixEvent, member: SdkRoomMember) => {
      const room = client.getRoom(member.roomId);
      if (!room) return;
      const typing = room
        .getMembers()
        .filter((m) => m.typing && m.userId !== this.session?.userId)
        .map((m) => m.name || m.userId);
      this.typingHandlers.forEach((h) => h(member.roomId, typing));
    });

    // Llamadas entrantes (WebRTC 1:1).
    client.on(CallEventHandlerEvent.Incoming, (call: MatrixCall) => {
      // Solo una llamada a la vez: rechazar si ya hay una en curso.
      if (this.currentCall && this.currentCall.state !== CallState.Ended) {
        call.reject();
        return;
      }
      this.setupCall(call, true);
    });

    await client.startClient({ initialSyncLimit: 30 });
  }

  stopSync(): void {
    this.client?.stopClient();
  }

  // -------------------------------------------------------------------------
  // Llamadas 1:1 (audio/video, WebRTC)
  // -------------------------------------------------------------------------

  /** Inicia una llamada saliente en el room (audio o video). */
  async placeCall(roomId: string, video: boolean): Promise<void> {
    if (!this.client) throw new Error('Cliente no inicializado');
    if (this.currentCall && this.currentCall.state !== CallState.Ended) return;
    const call = this.client.createCall(roomId);
    if (!call) throw new Error('No se pudo iniciar la llamada en esta conversación');
    this.setupCall(call, false);
    if (video) await call.placeVideoCall();
    else await call.placeVoiceCall();
  }

  async answerCall(): Promise<void> {
    await this.currentCall?.answer();
  }

  rejectCall(): void {
    this.currentCall?.reject();
  }

  hangupCall(): void {
    this.currentCall?.hangup(CallErrorCode.UserHangup, false);
  }

  async setMicMuted(muted: boolean): Promise<void> {
    await this.currentCall?.setMicrophoneMuted(muted);
    this.emitCall();
  }

  async setCameraMuted(muted: boolean): Promise<void> {
    await this.currentCall?.setLocalVideoMuted(muted);
    this.emitCall();
  }

  onCall(h: CallHandler): () => void {
    this.callHandlers.add(h);
    return () => this.callHandlers.delete(h);
  }

  private setupCall(call: MatrixCall, incoming: boolean): void {
    this.currentCall = call;
    this.callIncoming = incoming;
    call.on(CallEvent.State, () => this.emitCall());
    call.on(CallEvent.FeedsChanged, () => this.emitCall());
    call.on(CallEvent.Error, () => this.emitCall());
    call.on(CallEvent.Hangup, () => {
      this.emitCall();
      // Cerrar la UI poco después de colgar.
      setTimeout(() => {
        if (this.currentCall === call) {
          this.currentCall = null;
          this.callHandlers.forEach((h) => h(null));
        }
      }, 1200);
    });
    this.emitCall();
  }

  private phaseFromState(state: CallState, incoming: boolean): CallPhase {
    if (state === CallState.Ended) return 'ended';
    if (state === CallState.Connected) return 'connected';
    if (incoming && (state === CallState.Ringing || state === CallState.Fledgling)) return 'ringing';
    return 'connecting';
  }

  private emitCall(): void {
    const c = this.currentCall;
    if (!c) {
      this.callHandlers.forEach((h) => h(null));
      return;
    }
    const feeds = c.getFeeds();
    const local = feeds.find((f) => f.isLocal());
    const remote = feeds.find((f) => !f.isLocal());
    const snap: ActiveCall = {
      callId: c.callId,
      roomId: c.roomId,
      isVideo: c.type === CallType.Video,
      incoming: this.callIncoming,
      phase: this.phaseFromState(c.state, this.callIncoming),
      peerName: c.getOpponentMember()?.name ?? 'Llamada',
      micMuted: c.isMicrophoneMuted(),
      cameraMuted: c.isLocalVideoMuted(),
      localStream: local?.stream ?? null,
      remoteStream: remote?.stream ?? null,
    };
    this.callHandlers.forEach((h) => h(snap));
  }

  /** Se une automáticamente a las invitaciones pendientes (experiencia WhatsApp). */
  private autoJoinInvites(): void {
    if (!this.client) return;
    for (const room of this.client.getRooms()) {
      if (room.getMyMembership() === 'invite') {
        this.client.joinRoom(room.roomId).catch(() => {
          /* mejor esfuerzo */
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Rooms
  // -------------------------------------------------------------------------

  getRooms(): RoomSummary[] {
    if (!this.client) return [];
    return this.client
      .getRooms()
      // Incluir invitaciones además de rooms unidos: aunque el auto-join tarde un
      // instante, la conversación se ve de inmediato en la lista.
      .filter((r) => ['join', 'invite'].includes(r.getMyMembership() ?? ''))
      .map((r) => this.toRoomSummary(r))
      .sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0));
  }

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
      invite: opts.invite?.map((u) => this.normalizeUserId(u)),
      is_direct: opts.isDirect ?? false,
      preset: opts.isDirect ? Preset.TrustedPrivateChat : Preset.PrivateChat,
      visibility: Visibility.Private,
    });
    return res.room_id;
  }

  async joinRoom(roomIdOrAlias: string): Promise<string> {
    if (!this.client) throw new Error('Cliente no inicializado');
    const room = await this.client.joinRoom(roomIdOrAlias);
    return room.roomId;
  }

  async invite(roomId: string, userId: string): Promise<void> {
    if (!this.client) throw new Error('Cliente no inicializado');
    await this.client.invite(roomId, this.normalizeUserId(userId));
  }

  /**
   * Acepta `cesar`, `@cesar` o `@cesar:whalabi.app` y devuelve siempre el MXID
   * completo. El dominio por defecto es el del propio usuario de la sesión.
   */
  normalizeUserId(input: string): string {
    const raw = input.trim();
    if (raw.includes(':')) return raw.startsWith('@') ? raw : `@${raw}`;
    const localpart = raw.replace(/^@/, '');
    const myDomain = this.session?.userId.split(':')[1] ?? '';
    return myDomain ? `@${localpart}:${myDomain}` : `@${localpart}`;
  }

  /** Busca personas en el directorio del homeserver (estilo "contactos"). */
  async searchUsers(term: string, limit = 20): Promise<UserSearchResult[]> {
    if (!this.client || !term.trim()) return [];
    const res = await this.client.searchUserDirectory({ term: term.trim(), limit });
    const myId = this.session?.userId;
    return res.results
      .filter((u) => u.user_id !== myId)
      .map((u) => ({
        userId: u.user_id,
        displayName: u.display_name ?? null,
        avatarUrl: u.avatar_url
          ? this.client?.mxcUrlToHttp(u.avatar_url, 64, 64, 'crop') ?? null
          : null,
      }));
  }

  /**
   * Abre un chat directo (1 a 1) con un usuario, reusando el DM existente si lo
   * hay. Es el flujo tipo WhatsApp: buscar a la persona y escribirle directo.
   */
  async startDirectMessage(userId: string): Promise<string> {
    if (!this.client) throw new Error('Cliente no inicializado');
    const existing = this.findDirectRoom(userId);
    if (existing) return existing;
    const roomId = await this.createRoom({ invite: [userId], isDirect: true });
    // Registrar el DM es "best effort": si falla, el chat ya está creado igual.
    try {
      await this.recordDirect(userId, roomId);
    } catch {
      /* no bloquear la apertura del chat */
    }
    return roomId;
  }

  /** Busca un DM ya existente (unido) con el usuario dado. */
  private findDirectRoom(userId: string): string | null {
    if (!this.client) return null;
    const directEvent = this.client.getAccountData(EventType.Direct);
    const content = directEvent?.getContent<Record<string, string[]>>() ?? {};
    for (const rid of content[userId] ?? []) {
      const room = this.client.getRoom(rid);
      if (room && room.getMyMembership() === 'join') return rid;
    }
    return null;
  }

  /** Registra el room como DM del usuario en m.direct (account data). */
  private async recordDirect(userId: string, roomId: string): Promise<void> {
    if (!this.client) return;
    const directEvent = this.client.getAccountData(EventType.Direct);
    const content = { ...(directEvent?.getContent<Record<string, string[]>>() ?? {}) };
    content[userId] = [...(content[userId] ?? []), roomId];
    await this.client.setAccountData(EventType.Direct, content);
  }

  /** Miembros del room (unidos e invitados). */
  getMembers(roomId: string): RoomMember[] {
    if (!this.client) return [];
    const room = this.client.getRoom(roomId);
    if (!room) return [];
    const myId = this.session?.userId ?? '';
    return room
      .getMembers()
      .filter((m) => m.membership === 'join' || m.membership === 'invite')
      .map((m) => ({
        userId: m.userId,
        displayName: m.name || null,
        avatarUrl: m.getMxcAvatarUrl()
          ? this.client!.mxcUrlToHttp(m.getMxcAvatarUrl()!, 48, 48, 'crop') ?? null
          : null,
        membership: m.membership ?? 'leave',
        isSelf: m.userId === myId,
      }));
  }

  async setRoomName(roomId: string, name: string): Promise<void> {
    if (!this.client) throw new Error('Cliente no inicializado');
    await this.client.setRoomName(roomId, name);
  }

  // -------------------------------------------------------------------------
  // Mensajes
  // -------------------------------------------------------------------------

  async sendMessage(roomId: string, body: string, replyToEventId?: string): Promise<string> {
    if (!this.client) throw new Error('Cliente no inicializado');
    const content: Record<string, unknown> = { msgtype: MsgType.Text, body };
    if (replyToEventId) {
      content['m.relates_to'] = { 'm.in_reply_to': { event_id: replyToEventId } };
    }
    const res = await this.client.sendEvent(roomId, EventType.RoomMessage, content as never);
    return res.event_id;
  }

  /** Sube un archivo y lo envía como imagen o archivo genérico. */
  async sendAttachment(roomId: string, file: File): Promise<string> {
    if (!this.client) throw new Error('Cliente no inicializado');
    const upload = await this.client.uploadContent(file, { name: file.name, type: file.type });
    const isImage = file.type.startsWith('image/');
    const content = {
      msgtype: isImage ? MsgType.Image : MsgType.File,
      body: file.name,
      url: upload.content_uri,
      info: { mimetype: file.type, size: file.size },
    };
    const res = await this.client.sendEvent(roomId, EventType.RoomMessage, content as never);
    return res.event_id;
  }

  /** Reacciona (o quita la reacción si ya existe) con un emoji. */
  async toggleReaction(roomId: string, eventId: string, key: string): Promise<void> {
    if (!this.client) throw new Error('Cliente no inicializado');
    const room = this.client.getRoom(roomId);
    const myId = this.session?.userId ?? '';
    // ¿ya reaccioné con este emoji? -> redactar
    const existing = room
      ?.getLiveTimeline()
      .getEvents()
      .find(
        (e) =>
          e.getType() === EventType.Reaction &&
          e.getSender() === myId &&
          e.getRelation()?.event_id === eventId &&
          e.getRelation()?.key === key,
      );
    if (existing) {
      const id = existing.getId();
      if (id) await this.client.redactEvent(roomId, id);
      return;
    }
    await this.client.sendEvent(roomId, EventType.Reaction, {
      'm.relates_to': { rel_type: RelationType.Annotation, event_id: eventId, key },
    } as never);
  }

  async sendTyping(roomId: string, isTyping: boolean): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.sendTyping(roomId, isTyping, isTyping ? 4000 : 0);
    } catch {
      /* ignore */
    }
  }

  getTimeline(roomId: string): TimelineMessage[] {
    if (!this.client) return [];
    const room = this.client.getRoom(roomId);
    if (!room) return [];
    const myId = this.session?.userId ?? '';
    const events = room.getLiveTimeline().getEvents();

    // Agregación de reacciones + índice de cuerpos (para previews de respuesta).
    const reactions = new Map<string, Map<string, { count: number; mine: boolean }>>();
    const bodyById = new Map<string, string>();
    for (const ev of events) {
      if (ev.getType() === EventType.RoomMessage) {
        bodyById.set(ev.getId() ?? '', (ev.getContent().body as string) ?? '');
      } else if (ev.getType() === EventType.Reaction && !ev.isRedacted()) {
        const rel = ev.getRelation();
        if (!rel?.event_id || !rel.key) continue;
        const perEvent = reactions.get(rel.event_id) ?? new Map();
        const cur = perEvent.get(rel.key) ?? { count: 0, mine: false };
        cur.count += 1;
        if (ev.getSender() === myId) cur.mine = true;
        perEvent.set(rel.key, cur);
        reactions.set(rel.event_id, perEvent);
      }
    }

    return events
      .filter((ev) => ev.getType() === EventType.RoomMessage && !ev.isRedacted())
      .map((ev) => this.toTimelineMessage(ev, room, myId, reactions, bodyById));
  }

  async loadOlderMessages(roomId: string, limit = 30): Promise<boolean> {
    if (!this.client) return false;
    const room = this.client.getRoom(roomId);
    if (!room) return false;
    const before = room.getLiveTimeline().getEvents().length;
    await this.client.scrollback(room, limit);
    const after = room.getLiveTimeline().getEvents().length;
    this.emitTimeline(roomId);
    return after > before; // hubo más historia
  }

  async markRead(roomId: string): Promise<void> {
    if (!this.client) return;
    const room = this.client.getRoom(roomId);
    if (!room) return;
    const events = room.getLiveTimeline().getEvents();
    // Buscar el último evento con ID REAL del servidor. Los "local echo"
    // (mensajes aún sin confirmar) tienen ID que empieza con "~" y status
    // pendiente: mandarles un recibo de lectura da 400 y rompe la apertura.
    let target: MatrixEvent | undefined;
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      const id = ev?.getId();
      if (ev && id && id.startsWith('$') && !ev.status) {
        target = ev;
        break;
      }
    }
    if (!target) return;
    try {
      await this.client.sendReadReceipt(target);
    } catch {
      /* un recibo de lectura fallido nunca debe romper la UI */
    }
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
  // Búsqueda
  // -------------------------------------------------------------------------

  /** Busca texto en los mensajes del usuario (todos sus rooms). */
  async searchMessages(term: string): Promise<Array<{ roomId: string; body: string; sender: string; ts: number }>> {
    if (!this.client || !term.trim()) return [];
    const res = await this.client.searchMessageText({ query: term });
    const results = res.search_categories?.room_events?.results ?? [];
    return results
      .map((r) => {
        const ev = r.result;
        if (!ev) return null;
        return {
          roomId: ev.room_id ?? '',
          body: (ev.content?.body as string) ?? '',
          sender: ev.sender ?? '',
          ts: ev.origin_server_ts ?? 0,
        };
      })
      .filter((x): x is { roomId: string; body: string; sender: string; ts: number } => Boolean(x));
  }

  // -------------------------------------------------------------------------
  // Suscripciones
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
  onTyping(h: TypingHandler): () => void {
    this.typingHandlers.add(h);
    return () => this.typingHandlers.delete(h);
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
      avatarUrl: avatarMxc ? this.client?.mxcUrlToHttp(avatarMxc, 64, 64, 'crop') ?? null : null,
    };
  }

  private isDirectRoom(roomId: string): boolean {
    if (!this.client) return false;
    const directEvent = this.client.getAccountData(EventType.Direct);
    if (!directEvent) return false;
    const content = directEvent.getContent<Record<string, string[]>>();
    return Object.values(content).some((ids) => ids.includes(roomId));
  }

  private toTimelineMessage(
    ev: MatrixEvent,
    room: Room,
    myId: string,
    reactions: Map<string, Map<string, { count: number; mine: boolean }>>,
    bodyById: Map<string, string>,
  ): TimelineMessage {
    const sender = ev.getSender() ?? '';
    const member = room.getMember(sender);
    const content = ev.getContent();
    const eventId = ev.getId() ?? '';

    const status: TimelineMessage['status'] =
      ev.status === EventStatus.NOT_SENT
        ? 'failed'
        : ev.status === EventStatus.SENDING || ev.status === EventStatus.QUEUED
          ? 'sending'
          : 'sent';

    const reactMap = reactions.get(eventId);
    const reactionList: MessageReaction[] = reactMap
      ? Array.from(reactMap.entries()).map(([key, v]) => ({ key, count: v.count, mine: v.mine }))
      : [];

    const relatesTo = content['m.relates_to'] as
      | { 'm.in_reply_to'?: { event_id?: string } }
      | undefined;
    const replyToEventId = relatesTo?.['m.in_reply_to']?.event_id ?? null;

    const msgtype = (content.msgtype as string) ?? MsgType.Text;
    let mediaUrl: string | null = null;
    let fileName: string | null = null;
    let mediaWidth: number | null = null;
    let mediaHeight: number | null = null;
    if ((msgtype === MsgType.Image || msgtype === MsgType.File) && typeof content.url === 'string') {
      mediaUrl = this.client?.mxcUrlToHttp(content.url) ?? null;
      fileName = (content.body as string) ?? null;
      const info = content.info as { w?: number; h?: number } | undefined;
      mediaWidth = typeof info?.w === 'number' ? info.w : null;
      mediaHeight = typeof info?.h === 'number' ? info.h : null;
    }

    return {
      eventId,
      sender,
      senderDisplayName: member?.name ?? serverNameFromUserId(sender) ?? sender,
      senderAvatarUrl: member?.getMxcAvatarUrl()
        ? this.client?.mxcUrlToHttp(member.getMxcAvatarUrl()!, 40, 40, 'crop') ?? null
        : null,
      body: (content.body as string) ?? '',
      ts: ev.getTs(),
      isOwn: sender === myId,
      msgtype,
      status,
      reactions: reactionList,
      replyToEventId,
      replyToPreview: replyToEventId ? bodyById.get(replyToEventId) ?? null : null,
      mediaUrl,
      fileName,
      mediaWidth,
      mediaHeight,
    };
  }
}

export { Direction };
