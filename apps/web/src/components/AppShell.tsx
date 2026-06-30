'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TimelineMessage } from '@whalabi/matrix';
import { useMatrix } from '@/lib/matrix-provider';
import { useTenant } from '@/lib/tenant-provider';
import { Sidebar } from './Sidebar';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { EmptyState } from './states';

/** Layout principal del chat: sidebar de rooms + conversación activa. */
export function AppShell() {
  const { rooms, sendMessage, subscribeTimeline, markRead, invite } = useMatrix();
  const { tenant } = useTenant();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TimelineMessage[]>([]);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.roomId === activeRoomId) ?? null,
    [rooms, activeRoomId],
  );

  // Suscribirse al timeline del room activo.
  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }
    const unsub = subscribeTimeline(activeRoomId, setMessages);
    void markRead(activeRoomId);
    return unsub;
  }, [activeRoomId, subscribeTimeline, markRead]);

  async function onInviteBot() {
    if (!activeRoomId || !tenant?.botUserId) return;
    try {
      await invite(activeRoomId, tenant.botUserId);
      window.alert(
        'Bot invitado. El asistente podrá leer los mensajes de este room mientras esté presente.',
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo invitar al bot.');
    }
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Sidebar: oculto en móvil cuando hay room activo */}
      <div className={`${activeRoomId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96`}>
        <Sidebar rooms={rooms} activeRoomId={activeRoomId} onSelect={setActiveRoomId} />
      </div>

      {/* Conversación */}
      <main
        className={`${activeRoomId ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col`}
      >
        {activeRoom ? (
          <>
            <ChatHeader
              room={activeRoom}
              onInviteBot={onInviteBot}
              onBack={() => setActiveRoomId(null)}
            />
            <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950">
              <MessageList messages={messages} />
            </div>
            <MessageComposer onSend={(body) => sendMessage(activeRoom.roomId, body)} />
          </>
        ) : (
          <EmptyState
            title="Selecciona una conversación"
            description="Elige un room de la lista o crea uno nuevo para empezar a chatear."
          />
        )}
      </main>
    </div>
  );
}
