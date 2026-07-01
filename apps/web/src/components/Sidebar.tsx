'use client';

import { useMemo, useState } from 'react';
import type { RoomSummary } from '@whalabi/matrix';
import { useTheme } from '@/lib/theme-provider';
import { TenantBrand } from './TenantBrand';
import { RoomList } from './RoomList';
import { UserProfile } from './UserProfile';
import { InstallPWAButton } from './InstallPWAButton';
import { CreateRoomModal, NewChatModal } from './RoomModals';

export function Sidebar({
  rooms,
  activeRoomId,
  onSelect,
  className = '',
}: {
  rooms: RoomSummary[];
  activeRoomId: string | null;
  onSelect: (roomId: string) => void;
  className?: string;
}) {
  const { theme, toggle } = useTheme();
  const [creating, setCreating] = useState(false);
  const [newChat, setNewChat] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.lastMessage ?? '').toLowerCase().includes(q),
    );
  }, [rooms, query]);

  return (
    <aside
      className={`flex h-full w-full flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <TenantBrand compact />
        <div className="flex items-center gap-1">
          <InstallPWAButton />
          <button
            type="button"
            onClick={toggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
            aria-label="Cambiar tema"
            title="Modo claro / oscuro"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      <div className="space-y-2 px-3 py-2">
        <div className="flex gap-2">
          <button type="button" onClick={() => setNewChat(true)} className="btn-primary flex-1 text-sm">
            💬 Nuevo chat
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Crear un grupo"
          >
            + Grupo
          </button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar chats…"
          className="input py-1.5 text-sm"
        />
      </div>

      <div className="scroll-touch flex-1 overflow-y-auto">
        <RoomList rooms={filtered} activeRoomId={activeRoomId} onSelect={onSelect} />
      </div>

      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <UserProfile />
      </div>

      <NewChatModal
        open={newChat}
        onClose={() => setNewChat(false)}
        onCreated={(roomId) => onSelect(roomId)}
      />
      <CreateRoomModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(roomId) => onSelect(roomId)}
      />
    </aside>
  );
}
