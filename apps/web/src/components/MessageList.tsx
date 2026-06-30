'use client';

import { useEffect, useRef } from 'react';
import type { TimelineMessage } from '@whalabi/matrix';
import { EmptyState } from './states';

function MessageBubble({ message }: { message: TimelineMessage }) {
  const time = new Date(message.ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          message.isOwn
            ? 'rounded-br-sm bg-brand text-white'
            : 'rounded-bl-sm bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100'
        }`}
      >
        {!message.isOwn && (
          <p className="mb-0.5 text-xs font-semibold text-brand-accent">
            {message.senderDisplayName ?? message.sender}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={`mt-1 text-right text-[10px] ${
            message.isOwn ? 'text-white/70' : 'text-slate-400'
          }`}
        >
          {time}
        </p>
      </div>
    </div>
  );
}

export function MessageList({ messages }: { messages: TimelineMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <EmptyState
        title="No hay mensajes aún"
        description="Escribe el primer mensaje de esta conversación."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {messages.map((m) => (
        <MessageBubble key={m.eventId} message={m} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
