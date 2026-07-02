'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { WhalabiMatrixClient } from '@whalabi/matrix';
import type {
  RoomSummary,
  TimelineMessage,
  RoomMember,
  UserSearchResult,
  ActiveCall,
  WhalabiSession,
} from '@whalabi/matrix';
import { clearSession, loadSession, saveSession } from './session';
import { config } from './config';

interface MatrixContextValue {
  ready: boolean;
  syncState: string;
  session: WhalabiSession | null;
  rooms: RoomSummary[];
  login: (homeserverUrl: string, user: string, password: string) => Promise<void>;
  register: (params: {
    homeserverUrl: string;
    username: string;
    password: string;
    registrationToken?: string;
    captchaResponse?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  sendMessage: (roomId: string, body: string, replyTo?: string) => Promise<void>;
  sendAttachment: (roomId: string, file: File) => Promise<void>;
  toggleReaction: (roomId: string, eventId: string, key: string) => Promise<void>;
  sendTyping: (roomId: string, isTyping: boolean) => Promise<void>;
  createRoom: (opts: { name?: string; invite?: string[]; isDirect?: boolean }) => Promise<string>;
  invite: (roomId: string, userId: string) => Promise<void>;
  searchUsers: (term: string) => Promise<UserSearchResult[]>;
  startDirectMessage: (userId: string) => Promise<string>;
  activeCall: ActiveCall | null;
  placeCall: (roomId: string, video: boolean) => Promise<void>;
  answerCall: () => Promise<void>;
  rejectCall: () => void;
  hangupCall: () => void;
  setMicMuted: (muted: boolean) => Promise<void>;
  setCameraMuted: (muted: boolean) => Promise<void>;
  setRoomName: (roomId: string, name: string) => Promise<void>;
  getMembers: (roomId: string) => RoomMember[];
  getTimeline: (roomId: string) => TimelineMessage[];
  loadOlder: (roomId: string) => Promise<boolean>;
  markRead: (roomId: string) => Promise<void>;
  searchMessages: (
    term: string,
  ) => Promise<Array<{ roomId: string; body: string; sender: string; ts: number }>>;
  subscribeTimeline: (roomId: string, cb: (messages: TimelineMessage[]) => void) => () => void;
  subscribeTyping: (roomId: string, cb: (userIds: string[]) => void) => () => void;
}

const MatrixContext = createContext<MatrixContextValue | null>(null);

export function MatrixProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<WhalabiMatrixClient | null>(null);
  if (!clientRef.current) clientRef.current = new WhalabiMatrixClient();
  const client = clientRef.current;

  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState('STOPPED');
  const [session, setSession] = useState<WhalabiSession | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  useEffect(() => {
    const saved = loadSession();
    if (!saved) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        client.restore(saved);
        await client.startSync();
        if (!cancelled) setSession(saved);
      } catch {
        clearSession();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    const offRooms = client.onRoomsUpdated(setRooms);
    const offSync = client.onSyncState(setSyncState);
    const offCall = client.onCall(setActiveCall);
    return () => {
      offRooms();
      offSync();
      offCall();
    };
  }, [client]);

  const login = useCallback(
    async (homeserverUrl: string, user: string, password: string) => {
      const s = await client.login({ homeserverUrl, user, password });
      saveSession(s);
      client.restore(s);
      await client.startSync();
      setSession(s);
    },
    [client],
  );

  const register = useCallback<MatrixContextValue['register']>(
    async (params) => {
      const s = await client.register(params);
      saveSession(s);
      client.restore(s);
      await client.startSync();
      setSession(s);
    },
    [client],
  );

  const logout = useCallback(async () => {
    await client.logout();
    clearSession();
    setSession(null);
    setRooms([]);
    setSyncState('STOPPED');
  }, [client]);

  const value = useMemo<MatrixContextValue>(
    () => ({
      ready,
      syncState,
      session,
      rooms,
      login,
      register,
      logout,
      sendMessage: (roomId, body, replyTo) => client.sendMessage(roomId, body, replyTo).then(() => undefined),
      sendAttachment: (roomId, file) => client.sendAttachment(roomId, file).then(() => undefined),
      toggleReaction: (roomId, eventId, key) => client.toggleReaction(roomId, eventId, key),
      sendTyping: (roomId, isTyping) => client.sendTyping(roomId, isTyping),
      createRoom: (opts) => client.createRoom(opts),
      invite: (roomId, userId) => client.invite(roomId, userId),
      searchUsers: (term) => client.searchUsers(term),
      startDirectMessage: (userId) => client.startDirectMessage(userId),
      activeCall,
      placeCall: async (roomId, video) => {
        await client.placeCall(roomId, video);
        // Avisar por push al otro para que le suene con la app en segundo plano.
        try {
          const members = client.getMembers(roomId);
          const me = members.find((m) => m.isSelf);
          const peer = members.find((m) => !m.isSelf && m.membership === 'join');
          if (peer) {
            await fetch(`${config.apiUrl}/api/push/notify-call`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                toUserId: peer.userId,
                callerName: me?.displayName ?? 'Alguien',
                video,
              }),
            });
          }
        } catch {
          /* el push es best-effort; la llamada sigue igual */
        }
      },
      answerCall: () => client.answerCall(),
      rejectCall: () => client.rejectCall(),
      hangupCall: () => client.hangupCall(),
      setMicMuted: (muted) => client.setMicMuted(muted),
      setCameraMuted: (muted) => client.setCameraMuted(muted),
      setRoomName: (roomId, name) => client.setRoomName(roomId, name),
      getMembers: (roomId) => client.getMembers(roomId),
      getTimeline: (roomId) => client.getTimeline(roomId),
      loadOlder: (roomId) => client.loadOlderMessages(roomId),
      markRead: (roomId) => client.markRead(roomId),
      searchMessages: (term) => client.searchMessages(term),
      subscribeTimeline: (roomId, cb) => {
        cb(client.getTimeline(roomId));
        return client.onTimelineUpdated((rid, msgs) => {
          if (rid === roomId) cb(msgs);
        });
      },
      subscribeTyping: (roomId, cb) =>
        client.onTyping((rid, userIds) => {
          if (rid === roomId) cb(userIds);
        }),
    }),
    [ready, syncState, session, rooms, activeCall, login, register, logout, client],
  );

  return <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>;
}

export function useMatrix(): MatrixContextValue {
  const ctx = useContext(MatrixContext);
  if (!ctx) throw new Error('useMatrix debe usarse dentro de <MatrixProvider>');
  return ctx;
}
