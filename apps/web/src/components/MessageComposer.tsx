'use client';

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { TimelineMessage } from '@whalabi/matrix';

type SendStatus = 'idle' | 'sending' | 'error';

export function MessageComposer({
  onSend,
  onSendFile,
  onTyping,
  replyTo,
  onCancelReply,
}: {
  onSend: (body: string) => Promise<void>;
  onSendFile: (file: File) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  replyTo: TimelineMessage | null;
  onCancelReply: () => void;
}) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<SendStatus>('idle');
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function signalTyping() {
    onTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => onTyping(false), 3000);
  }

  async function submit() {
    const body = value.trim();
    if (!body || status === 'sending') return;
    setStatus('sending');
    onTyping(false);
    try {
      await onSend(body);
      setValue('');
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('sending');
    try {
      await onSendFile(file);
      setStatus('idle');
    } catch {
      setStatus('error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  return (
    <div className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {replyTo && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-1.5 text-xs dark:border-slate-800">
          <span className="truncate text-slate-500 dark:text-slate-400">
            Respondiendo a <b>{replyTo.senderDisplayName ?? replyTo.sender}</b>: {replyTo.body.slice(0, 60)}
          </span>
          <button type="button" onClick={onCancelReply} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
      )}
      <form onSubmit={onFormSubmit} className="flex items-end gap-2 p-3">
        <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Adjuntar"
          title="Adjuntar imagen o archivo"
        >
          📎
        </button>
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            signalTyping();
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Escribe un mensaje…"
          className="max-h-32 flex-1 resize-none rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={status === 'sending' || value.trim().length === 0}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:opacity-90 disabled:opacity-40"
          aria-label="Enviar"
        >
          {status === 'sending' ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
