'use client';

import { useEffect, useRef } from 'react';

// API mínima de reCAPTCHA v2 que usamos (widget "no soy un robot", render explícito).
interface Grecaptcha {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      theme?: 'light' | 'dark';
    },
  ) => number;
  reset: (id?: number) => void;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
    onWhalabiRecaptchaLoad?: () => void;
  }
}

let loading = false;
const waiters: Array<() => void> = [];

/** Carga el script de reCAPTCHA una sola vez y resuelve cuando `grecaptcha` está listo. */
function loadRecaptcha(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return;
    if (window.grecaptcha?.render) {
      resolve();
      return;
    }
    waiters.push(resolve);
    if (loading) return;
    loading = true;
    window.onWhalabiRecaptchaLoad = () => {
      waiters.splice(0).forEach((cb) => cb());
    };
    const s = document.createElement('script');
    s.src =
      'https://www.google.com/recaptcha/api.js?onload=onWhalabiRecaptchaLoad&render=explicit';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  });
}

export function Recaptcha({
  siteKey,
  onChange,
  theme,
}: {
  siteKey: string;
  onChange: (token: string | null) => void;
  theme?: 'light' | 'dark';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    void loadRecaptcha().then(() => {
      if (cancelled || !ref.current || widgetId.current !== null || !window.grecaptcha) return;
      widgetId.current = window.grecaptcha.render(ref.current, {
        sitekey: siteKey,
        callback: (token) => onChangeRef.current(token),
        'expired-callback': () => onChangeRef.current(null),
        'error-callback': () => onChangeRef.current(null),
        theme,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [siteKey, theme]);

  return <div ref={ref} className="flex justify-center" />;
}
