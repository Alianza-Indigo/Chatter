'use client';

import type { RoomSummary } from '@whalabi/matrix';
import { useTenant } from '@/lib/tenant-provider';

export function ChatHeader({
  room,
  onInviteBot,
  onBack,
}: {
  room: RoomSummary | null;
  onInviteBot?: () => void;
  onBack?: () => void;
}) {
  const { tenant } = useTenant();
  if (!room) return null;

  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden text-slate-500"
            aria-label="Volver"
          >
            ←
          </button>
        )}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand">
          {room.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
            {room.name}
          </p>
          <p className="truncate text-xs text-slate-400">{room.roomId}</p>
        </div>
      </div>
      {tenant?.botEnabled && onInviteBot && (
        <button
          type="button"
          onClick={onInviteBot}
          className="shrink-0 rounded-lg border border-brand/40 px-2.5 py-1.5 text-xs font-medium text-brand transition hover:bg-brand/10"
          title="Invitar al asistente. El bot podrá leer los mensajes de este room."
        >
          + Bot
        </button>
      )}
    </header>
  );
}
