'use client';

import { useCallback, useEffect, useState } from 'react';
import { config } from './config';

/** Convierte la clave VAPID (base64url) a Uint8Array para applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'subscribed' | 'idle' | 'loading';

/**
 * Gestiona la suscripción Web Push real:
 *  - obtiene la clave VAPID pública desde la API,
 *  - pide permiso y se suscribe vía PushManager,
 *  - registra/borra la suscripción en la API.
 *
 * Requiere contexto seguro (HTTPS o localhost) y un service worker registrado.
 */
export function usePush(userId: string | null) {
  const [state, setState] = useState<PushState>('idle');
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  useEffect(() => {
    if (!supported) {
      setState('unsupported');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${config.apiUrl}/api/push/vapid-public-key`);
        const data = (await res.json()) as { enabled: boolean; publicKey: string | null };
        if (cancelled) return;
        if (!data.enabled || !data.publicKey) {
          setState('unconfigured');
          return;
        }
        setPublicKey(data.publicKey);
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        setState(existing ? 'subscribed' : Notification.permission === 'denied' ? 'denied' : 'idle');
      } catch {
        if (!cancelled) setState('unconfigured');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const subscribe = useCallback(async (): Promise<void> => {
    if (!supported || !publicKey || !userId) return;
    setState('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState('denied');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await fetch(`${config.apiUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, subscription: json }),
      });
      setState('subscribed');
    } catch {
      setState('idle');
    }
  }, [supported, publicKey, userId]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported) return;
    setState('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${config.apiUrl}/api/push/subscribe`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState('idle');
    } catch {
      setState('subscribed');
    }
  }, [supported]);

  return { state, supported, subscribe, unsubscribe };
}
