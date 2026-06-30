'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';

type SendStatus = 'idle' | 'sending' | 'error';

export function MessageComposer({
  onSend,
}: {
  onSend: (body: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<SendStatus>('idle');

  async function submit() {
    const body = value.trim();
    if (!body || status === 'sending') return;
    setStatus('sending');
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

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  return (
    <form
      onSubmit={onFormSubmit}
      className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
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
  );
}
