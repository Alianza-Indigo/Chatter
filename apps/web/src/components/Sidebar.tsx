'use client';

import { useState } from 'react';
import type { RoomSummary } from '@whalabi/matrix';
import { useMatrix } from '@/lib/matrix-provider';
import { useTheme } from '@/lib/theme-provider';
import { TenantBrand } from './TenantBrand';
import { RoomList } from './RoomList';
import { UserProfile } from './UserProfile';
import { InstallPWAButton } from './InstallPWAButton';

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
  const { createRoom } = useMatrix();
  const { theme, toggle } = useTheme();
  const [creating, setCreating] = useState(false);

  async function onCreate() {
    const name = window.prompt('Nombre del nuevo room:');
    if (!name) return;
    const inviteRaw = window.prompt(
      'Invitar (Matrix IDs separados por coma, opcional):',
      '',
    );
    const invite = inviteRaw
      ? inviteRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    setCreating(true);
    try {
      const roomId = await createRoom({ name, invite });
      onSelect(roomId);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo crear el room.');
    } finally {
      setCreating(false);
    }
  }

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

      <div className="px-3 py-2">
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={creating}
          className="btn-primary w-full text-sm"
        >
          {creating ? 'Creando…' : '+ Nuevo room'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <RoomList rooms={rooms} activeRoomId={activeRoomId} onSelect={onSelect} />
      </div>

      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <UserProfile />
      </div>
    </aside>
  );
}
