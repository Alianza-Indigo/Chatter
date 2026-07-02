'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TimelineMessage } from '@whalabi/matrix';
import { useMatrix } from '@/lib/matrix-provider';
import { Sidebar } from './Sidebar';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { EmptyState } from './states';
import { Modal } from './Modal';
import { InviteModal, MembersModal } from './RoomModals';
import { CallOverlay } from './CallOverlay';

export function AppShell() {
  const {
    rooms,
    sendMessage,
    sendAttachment,
    toggleReaction,
    sendTyping,
    subscribeTimeline,
    subscribeTyping,
    markRead,
    loadOlder,
    setRoomName,
  } = useMatrix();

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TimelineMessage[]>([]);
  const [replyTo, setReplyTo] = useState<TimelineMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const activeRoom = useMemo(
    () => rooms.find((r) => r.roomId === activeRoomId) ?? null,
    [rooms, activeRoomId],
  );

  // Fija la altura real de la ventana en móvil. OJO: al hacer scroll, la barra de
  // direcciones se colapsa y dispara "resize" continuamente; si recalculáramos la
  // altura en cada uno, el scroll se traba a media pasada. Por eso solo aplicamos
  // cambios GRANDES (girar el teléfono, abrir/cerrar el teclado), ignorando el
  // micro-ajuste de la barra durante el scroll.
  useEffect(() => {
    let last = 0;
    const setHeight = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      if (Math.abs(h - last) < 120) return; // ignora el vaivén de la barra al scrollear
      last = h;
      document.documentElement.style.setProperty('--app-height', `${h}px`);
    };
    setHeight();
    window.addEventListener('orientationchange', setHeight);
    window.visualViewport?.addEventListener('resize', setHeight);
    return () => {
      window.removeEventListener('orientationchange', setHeight);
      window.visualViewport?.removeEventListener('resize', setHeight);
    };
  }, []);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      setTypingUsers([]);
      return;
    }
    setReplyTo(null);
    const unsubTimeline = subscribeTimeline(activeRoomId, setMessages);
    const unsubTyping = subscribeTyping(activeRoomId, setTypingUsers);
    void markRead(activeRoomId);
    return () => {
      unsubTimeline();
      unsubTyping();
    };
  }, [activeRoomId, subscribeTimeline, subscribeTyping, markRead]);

  async function handleSend(body: string) {
    if (!activeRoomId) return;
    await sendMessage(activeRoomId, body, replyTo?.eventId);
    setReplyTo(null);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRoomId || !newName.trim()) return;
    await setRoomName(activeRoomId, newName.trim());
    setRenaming(false);
    setNewName('');
  }

  return (
    <div className="app-viewport flex w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
      <div className={`${activeRoomId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96`}>
        <Sidebar rooms={rooms} activeRoomId={activeRoomId} onSelect={setActiveRoomId} />
      </div>

      <main className={`${activeRoomId ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col`}>
        {activeRoom ? (
          <>
            <ChatHeader
              room={activeRoom}
              onInvite={() => setShowInvite(true)}
              onMembers={() => setShowMembers(true)}
              onRename={() => {
                setNewName(activeRoom.name);
                setRenaming(true);
              }}
              onBack={() => setActiveRoomId(null)}
            />
            <div className="relative min-h-0 flex-1 bg-slate-100 dark:bg-slate-950">
              <MessageList
                key={activeRoom.roomId}
                messages={messages}
                onReply={setReplyTo}
                onReact={(eventId, emoji) => void toggleReaction(activeRoom.roomId, eventId, emoji)}
                onLoadOlder={() => loadOlder(activeRoom.roomId)}
              />
            </div>
            {typingUsers.length > 0 && (
              <div className="px-4 py-1 text-xs italic text-slate-400">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'está' : 'están'} escribiendo…
              </div>
            )}
            <MessageComposer
              onSend={handleSend}
              onSendFile={(file) => sendAttachment(activeRoom.roomId, file)}
              onTyping={(t) => void sendTyping(activeRoom.roomId, t)}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
          </>
        ) : (
          <EmptyState
            title="Selecciona una conversación"
            description="Elige un room de la lista o crea uno nuevo para empezar a chatear."
          />
        )}
      </main>

      {activeRoom && (
        <>
          <InviteModal open={showInvite} onClose={() => setShowInvite(false)} roomId={activeRoom.roomId} />
          <MembersModal open={showMembers} onClose={() => setShowMembers(false)} roomId={activeRoom.roomId} />
          <Modal open={renaming} onClose={() => setRenaming(false)} title="Renombrar room">
            <form onSubmit={handleRename} className="space-y-4">
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              <button type="submit" className="btn-primary w-full">
                Guardar
              </button>
            </form>
          </Modal>
        </>
      )}

      <CallOverlay />
    </div>
  );
}
