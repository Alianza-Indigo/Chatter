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

export interface TimelineMessage {
  eventId: string;
  sender: string;
  senderDisplayName: string | null;
  body: string;
  ts: number;
  /** true si el mensaje lo envió el usuario actual. */
  isOwn: boolean;
  msgtype: string;
}

export interface UserProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}
