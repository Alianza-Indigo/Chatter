'use client';

import { useEffect, useRef, useState } from 'react';
import type { RoomMember, UserSearchResult } from '@whalabi/matrix';
import { useMatrix } from '@/lib/matrix-provider';
import { useTenant } from '@/lib/tenant-provider';
import { Modal } from './Modal';

/** Nuevo chat directo (estilo WhatsApp): buscar a la persona y escribirle. */
export function NewChatModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}) {
  const { searchUsers, startDirectMessage } = useMatrix();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setTerm('');
      setResults([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = term.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        setResults(await searchUsers(q));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al buscar');
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [term, searchUsers]);

  async function openChat(userId: string) {
    setOpening(userId);
    setError(null);
    try {
      const roomId = await startDirectMessage(userId);
      onCreated(roomId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el chat');
    } finally {
      setOpening(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo chat">
      <div className="space-y-3">
        <input
          className="input"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar persona por nombre o usuario…"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {searching && <p className="px-2 py-1 text-sm text-slate-400">Buscando…</p>}
          {!searching && term.trim() && results.length === 0 && (
            <p className="px-2 py-1 text-sm text-slate-400">Sin resultados.</p>
          )}
          {results.map((u) => (
            <button
              key={u.userId}
              type="button"
              disabled={opening !== null}
              onClick={() => openChat(u.userId)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
                {u.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  (u.displayName ?? u.userId).replace(/^@/, '').slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800 dark:text-slate-100">
                  {u.displayName ?? u.userId}
                </p>
                <p className="truncate text-xs text-slate-400">{u.userId}</p>
              </div>
              {opening === u.userId && <span className="text-xs text-slate-400">Abriendo…</span>}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

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
            Invitar (usuarios separados por coma)
          </span>
          <input
            className="input"
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="ana, luis"
          />
          <span className="mt-1 block text-xs text-slate-400">
            Basta el usuario (p. ej. <b>ana</b>); el dominio se completa solo.
          </span>
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
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Usuario</span>
          <input
            className="input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="cesar"
          />
          <span className="mt-1 block text-xs text-slate-400">
            Basta el usuario; el dominio (@…:{tenant?.matrixServerName ?? 'whalabi.app'}) se completa solo.
          </span>
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
