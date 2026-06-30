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
import type { RoomSummary, TimelineMessage, WhalabiSession } from '@whalabi/matrix';
import { clearSession, loadSession, saveSession } from './session';

interface MatrixContextValue {
  ready: boolean;
  syncState: string;
  session: WhalabiSession | null;
  rooms: RoomSummary[];
  login: (homeserverUrl: string, user: string, password: string) => Promise<void>;
  register: (
    homeserverUrl: string,
    username: string,
    password: string,
    registrationToken?: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  sendMessage: (roomId: string, body: string) => Promise<void>;
  createRoom: (opts: {
    name?: string;
    invite?: string[];
    isDirect?: boolean;
  }) => Promise<string>;
  invite: (roomId: string, userId: string) => Promise<void>;
  getTimeline: (roomId: string) => TimelineMessage[];
  loadOlder: (roomId: string) => Promise<void>;
  markRead: (roomId: string) => Promise<void>;
  subscribeTimeline: (
    roomId: string,
    cb: (messages: TimelineMessage[]) => void,
  ) => () => void;
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

  // Restaurar sesión persistida al montar.
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
        if (!cancelled) {
          setSession(saved);
        }
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

  // Suscripciones a actualizaciones de rooms y sync.
  useEffect(() => {
    const offRooms = client.onRoomsUpdated(setRooms);
    const offSync = client.onSyncState(setSyncState);
    return () => {
      offRooms();
      offSync();
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

  const register = useCallback(
    async (
      homeserverUrl: string,
      username: string,
      password: string,
      registrationToken?: string,
    ) => {
      const s = await client.register({ homeserverUrl, username, password, registrationToken });
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

  const sendMessage = useCallback(
    async (roomId: string, body: string) => {
      await client.sendMessage(roomId, body);
    },
    [client],
  );

  const createRoom = useCallback(
    (opts: { name?: string; invite?: string[]; isDirect?: boolean }) =>
      client.createRoom(opts),
    [client],
  );

  const invite = useCallback(
    (roomId: string, userId: string) => client.invite(roomId, userId),
    [client],
  );

  const getTimeline = useCallback((roomId: string) => client.getTimeline(roomId), [client]);
  const loadOlder = useCallback((roomId: string) => client.loadOlderMessages(roomId), [client]);
  const markRead = useCallback((roomId: string) => client.markRead(roomId), [client]);

  const subscribeTimeline = useCallback(
    (roomId: string, cb: (messages: TimelineMessage[]) => void) => {
      // Emitir estado inicial.
      cb(client.getTimeline(roomId));
      return client.onTimelineUpdated((rid, msgs) => {
        if (rid === roomId) cb(msgs);
      });
    },
    [client],
  );

  const value = useMemo<MatrixContextValue>(
    () => ({
      ready,
      syncState,
      session,
      rooms,
      login,
      register,
      logout,
      sendMessage,
      createRoom,
      invite,
      getTimeline,
      loadOlder,
      markRead,
      subscribeTimeline,
    }),
    [
      ready,
      syncState,
      session,
      rooms,
      login,
      register,
      logout,
      sendMessage,
      createRoom,
      invite,
      getTimeline,
      loadOlder,
      markRead,
      subscribeTimeline,
    ],
  );

  return <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>;
}

export function useMatrix(): MatrixContextValue {
  const ctx = useContext(MatrixContext);
  if (!ctx) throw new Error('useMatrix debe usarse dentro de <MatrixProvider>');
  return ctx;
}
