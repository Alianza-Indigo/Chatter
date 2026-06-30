'use client';

import type { RoomSummary } from '@whalabi/matrix';
import { EmptyState } from './states';

function formatTs(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

function RoomListItem({
  room,
  active,
  onClick,
}: {
  room: RoomSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
        active
          ? 'bg-brand/10 text-slate-900 dark:text-white'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand">
        {room.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={room.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          room.name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {room.name}
          </span>
          <span className="shrink-0 text-[11px] text-slate-400">{formatTs(room.lastTs)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">
            {room.lastMessage ?? 'Sin mensajes'}
          </span>
          {room.unreadCount > 0 && (
            <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
              {room.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function RoomList({
  rooms,
  activeRoomId,
  onSelect,
}: {
  rooms: RoomSummary[];
  activeRoomId: string | null;
  onSelect: (roomId: string) => void;
}) {
  if (rooms.length === 0) {
    return (
      <EmptyState
        title="Sin conversaciones"
        description="Crea un room o pide que te inviten a uno para empezar."
      />
    );
  }
  return (
    <div className="flex flex-col gap-0.5 p-2">
      {rooms.map((room) => (
        <RoomListItem
          key={room.roomId}
          room={room}
          active={room.roomId === activeRoomId}
          onClick={() => onSelect(room.roomId)}
        />
      ))}
    </div>
  );
}
