'use client';

import { useEffect, useState } from 'react';
import type { RoomMember } from '@whalabi/matrix';
import { useMatrix } from '@/lib/matrix-provider';
import { useTenant } from '@/lib/tenant-provider';
import { Modal } from './Modal';

/** Crear un room nuevo (nombre + invitados opcionales). */
export function CreateRoomModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}) {
  const { createRoom } = useMatrix();
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const invites = invite
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const roomId = await createRoom({ name: name.trim(), invite: invites });
      setName('');
      setInvite('');
      onCreated(roomId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo room">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Nombre</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Invitar (Matrix IDs, separados por coma)
          </span>
          <input
            className="input"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="@ana:whalabi.app, @luis:whalabi.app"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Creando…' : 'Crear room'}
        </button>
      </form>
    </Modal>
  );
}

/** Invitar un usuario al room activo (incluye botón rápido para el bot). */
export function InviteModal({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
}) {
  const { invite } = useMatrix();
  const { tenant } = useTenant();
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function doInvite(id: string) {
    if (!id.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await invite(roomId, id.trim());
      setMsg(`Invitado ${id}`);
      setUserId('');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invitar al room">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Matrix ID</span>
          <input
            className="input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder={`@usuario:${tenant?.matrixServerName ?? 'whalabi.app'}`}
          />
        </label>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => doInvite(userId)} className="btn-primary flex-1">
            {busy ? 'Invitando…' : 'Invitar'}
          </button>
          {tenant?.botEnabled && tenant.botUserId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => doInvite(tenant.botUserId!)}
              className="rounded-lg border border-brand/40 px-3 py-2 text-sm font-medium text-brand hover:bg-brand/10"
              title="El bot podrá leer los mensajes de este room."
            >
              + Bot
            </button>
          )}
        </div>
        {msg && <p className="text-sm text-slate-500">{msg}</p>}
      </div>
    </Modal>
  );
}

/** Ver miembros del room. */
export function MembersModal({
  open,
  onClose,
  roomId,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
}) {
  const { getMembers } = useMatrix();
  const [members, setMembers] = useState<RoomMember[]>([]);

  useEffect(() => {
    if (open) setMembers(getMembers(roomId));
  }, [open, roomId, getMembers]);

  return (
    <Modal open={open} onClose={onClose} title={`Miembros (${members.length})`}>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                (m.displayName ?? m.userId).replace(/^@/, '').slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-800 dark:text-slate-100">
                {m.displayName ?? m.userId} {m.isSelf && <span className="text-xs text-slate-400">(tú)</span>}
              </p>
              <p className="truncate text-xs text-slate-400">{m.userId}</p>
            </div>
            {m.membership === 'invite' && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                invitado
              </span>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
