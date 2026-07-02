'use client';

import type { RoomSummary } from '@whalabi/matrix';
import { useMatrix } from '@/lib/matrix-provider';

export function ChatHeader({
  room,
  onInvite,
  onMembers,
  onRename,
  onBack,
}: {
  room: RoomSummary | null;
  onInvite: () => void;
  onMembers: () => void;
  onRename: () => void;
  onBack?: () => void;
}) {
  const { syncState, placeCall, activeCall } = useMatrix();
  if (!room) return null;

  const online = syncState === 'SYNCING' || syncState === 'PREPARED';
  const inCall = Boolean(activeCall);

  async function call(video: boolean) {
    if (!room || inCall) return;
    try {
      await placeCall(room.roomId, video);
    } catch {
      /* la UI de llamada muestra el estado; un fallo aquí no debe romper el header */
    }
  }

  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button type="button" onClick={onBack} className="md:hidden text-slate-500" aria-label="Volver">
            ←
          </button>
        )}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand">
          {room.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <button
            type="button"
            onClick={onRename}
            className="truncate font-semibold text-slate-800 hover:underline dark:text-slate-100"
            title="Renombrar room"
          >
            {room.name}
          </button>
          <p className="flex items-center gap-1.5 truncate text-xs text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            {online ? 'Conectado' : 'Reconectando…'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => void call(false)}
          disabled={inCall}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Llamada de voz"
          title="Llamada de voz"
        >
          📞
        </button>
        <button
          type="button"
          onClick={() => void call(true)}
          disabled={inCall}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Videollamada"
          title="Videollamada"
        >
          📹
        </button>
        <button
          type="button"
          onClick={onMembers}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Miembros
        </button>
        <button
          type="button"
          onClick={onInvite}
          className="rounded-lg border border-brand/40 px-2.5 py-1.5 text-xs font-medium text-brand transition hover:bg-brand/10"
        >
          + Invitar
        </button>
      </div>
    </header>
  );
}
