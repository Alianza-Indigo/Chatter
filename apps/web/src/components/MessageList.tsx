'use client';

import { useEffect, useRef, useState } from 'react';
import type { TimelineMessage } from '@whalabi/matrix';
import { EmptyState } from './states';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏'];

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yest.toDateString()) return 'Ayer';
  return d.toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' });
}

function time(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({
  m,
  showHeader,
  onReply,
  onReact,
}: {
  m: TimelineMessage;
  showHeader: boolean;
  onReply: (m: TimelineMessage) => void;
  onReact: (eventId: string, emoji: string) => void;
}) {
  const [picker, setPicker] = useState(false);
  return (
    <div className={`group flex gap-2 ${m.isOwn ? 'flex-row-reverse' : ''}`}>
      {!m.isOwn && (
        <div className="w-8 shrink-0">
          {showHeader &&
            (m.senderAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.senderAvatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
                {(m.senderDisplayName ?? m.sender).replace(/^@/, '').slice(0, 1).toUpperCase()}
              </div>
            ))}
        </div>
      )}

      <div className={`max-w-[78%] ${m.isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {showHeader && !m.isOwn && (
          <span className="mb-0.5 px-1 text-xs font-semibold text-brand-accent">
            {m.senderDisplayName ?? m.sender}
          </span>
        )}

        <div className="relative">
          <div
            className={`rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
              m.isOwn
                ? 'rounded-br-sm bg-brand text-white'
                : 'rounded-bl-sm bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100'
            } ${m.status === 'failed' ? 'opacity-60 ring-1 ring-red-400' : ''}`}
          >
            {m.replyToPreview && (
              <div
                className={`mb-1 border-l-2 pl-2 text-xs ${
                  m.isOwn ? 'border-white/50 text-white/80' : 'border-brand/40 text-slate-500 dark:text-slate-400'
                }`}
              >
                {m.replyToPreview.slice(0, 80)}
              </div>
            )}

            {m.mediaUrl && m.msgtype === 'm.image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.mediaUrl} alt={m.fileName ?? ''} className="max-h-64 rounded-lg" />
            ) : m.mediaUrl ? (
              <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="underline">
                📎 {m.fileName ?? 'archivo'}
              </a>
            ) : (
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
            )}

            <p className={`mt-1 text-right text-[10px] ${m.isOwn ? 'text-white/70' : 'text-slate-400'}`}>
              {m.status === 'sending' ? 'enviando…' : m.status === 'failed' ? 'no enviado' : time(m.ts)}
            </p>
          </div>

          {/* Acciones al pasar el mouse */}
          <div
            className={`absolute top-0 ${m.isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} hidden gap-1 px-1 group-hover:flex`}
          >
            <button
              type="button"
              onClick={() => setPicker((v) => !v)}
              className="rounded-full bg-white px-1.5 text-xs shadow dark:bg-slate-700"
              title="Reaccionar"
            >
              😊
            </button>
            <button
              type="button"
              onClick={() => onReply(m)}
              className="rounded-full bg-white px-1.5 text-xs shadow dark:bg-slate-700"
              title="Responder"
            >
              ↩
            </button>
          </div>

          {picker && (
            <div className="absolute z-10 mt-1 flex gap-1 rounded-full bg-white p-1 shadow-lg dark:bg-slate-700">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onReact(m.eventId, e);
                    setPicker(false);
                  }}
                  className="rounded-full px-1 hover:bg-slate-100 dark:hover:bg-slate-600"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {m.reactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${m.isOwn ? 'justify-end' : ''}`}>
            {m.reactions.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => onReact(m.eventId, r.key)}
                className={`rounded-full border px-1.5 py-0.5 text-xs ${
                  r.mine
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
                }`}
              >
                {r.key} {r.count}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  onReply,
  onReact,
  onLoadOlder,
}: {
  messages: TimelineMessage[];
  onReply: (m: TimelineMessage) => void;
  onReact: (eventId: string, emoji: string) => void;
  onLoadOlder: () => Promise<boolean>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const prevLen = useRef(0);

  // Autoscroll al fondo cuando llegan mensajes (si estabas cerca del fondo).
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 200;
    const grew = messages.length > prevLen.current;
    prevLen.current = messages.length;
    if (nearBottom && grew) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function onScroll() {
    const c = containerRef.current;
    if (!c || loadingOlder) return;
    if (c.scrollTop < 80) {
      setLoadingOlder(true);
      const prevHeight = c.scrollHeight;
      await onLoadOlder();
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight - prevHeight;
        }
        setLoadingOlder(false);
      });
    }
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        title="No hay mensajes aún"
        description="Escribe el primer mensaje de esta conversación."
      />
    );
  }

  return (
    <div ref={containerRef} onScroll={onScroll} className="h-full overflow-y-auto p-4">
      {loadingOlder && <p className="mb-2 text-center text-xs text-slate-400">Cargando historial…</p>}
      <div className="flex flex-col gap-1.5">
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || new Date(prev.ts).toDateString() !== new Date(m.ts).toDateString();
          const showHeader = newDay || !prev || prev.sender !== m.sender;
          return (
            <div key={m.eventId}>
              {newDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-slate-200 px-3 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {dayLabel(m.ts)}
                  </span>
                </div>
              )}
              <MessageBubble m={m} showHeader={showHeader} onReply={onReply} onReact={onReact} />
            </div>
          );
        })}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
