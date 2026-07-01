/** Tipos ligeros expuestos por el wrapper, independientes del SDK. */

export interface WhalabiSession {
  userId: string;
  deviceId: string;
  accessToken: string;
  homeserverUrl: string;
}

export interface LoginParams {
  homeserverUrl: string;
  /** localpart (`cesar`) o MXID completo (`@cesar:whalabi.app`). */
  user: string;
  password: string;
}

export interface RegisterParams {
  homeserverUrl: string;
  username: string;
  password: string;
  /** Token de registro si el homeserver lo exige. */
  registrationToken?: string;
  /** Respuesta del reCAPTCHA (g-recaptcha-response) si el homeserver lo exige. */
  captchaResponse?: string;
}

export interface RoomSummary {
  roomId: string;
  name: string;
  /** Último mensaje (texto) para previsualización en la lista. */
  lastMessage: string | null;
  lastTs: number | null;
  unreadCount: number;
  isDirect: boolean;
  avatarUrl: string | null;
}

export interface MessageReaction {
  key: string; // emoji
  count: number;
  mine: boolean; // el usuario actual reaccionó
}

export interface TimelineMessage {
  eventId: string;
  sender: string;
  senderDisplayName: string | null;
  senderAvatarUrl: string | null;
  body: string;
  ts: number;
  /** true si el mensaje lo envió el usuario actual. */
  isOwn: boolean;
  msgtype: string;
  /** Estado de envío local: 'sent' | 'sending' | 'failed'. */
  status: 'sent' | 'sending' | 'failed';
  /** Reacciones agregadas por emoji. */
  reactions: MessageReaction[];
  /** Si es respuesta a otro mensaje. */
  replyToEventId: string | null;
  replyToPreview: string | null;
  /** Para m.image / m.file: URL http descargable y nombre. */
  mediaUrl: string | null;
  fileName: string | null;
}

export interface RoomMember {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  membership: string; // join | invite | leave
  isSelf: boolean;
}

export interface UserProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Resultado de una búsqueda en el directorio de usuarios (tipo "contactos"). */
export interface UserSearchResult {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}
