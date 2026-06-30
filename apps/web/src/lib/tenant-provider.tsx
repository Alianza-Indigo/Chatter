'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PublicTenantConfig } from '@whalabi/shared';
import { fallbackTenantConfig, fetchTenantConfig } from './api';

interface TenantContextValue {
  tenant: PublicTenantConfig | null;
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  loading: true,
  error: null,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<PublicTenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await fetchTenantConfig();
        if (!cancelled) setTenant(t);
      } catch (e) {
        // Fallback a configuración por env para no bloquear la app.
        if (!cancelled) {
          setTenant(fallbackTenantConfig());
          setError(e instanceof Error ? e.message : 'Error resolviendo tenant');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Aplicar branding (colores) como CSS variables (triplete RGB).
  useEffect(() => {
    if (!tenant) return;
    const root = document.documentElement;
    const primary = hexToRgbTriplet(tenant.branding.primaryColor);
    if (primary) root.style.setProperty('--whalabi-primary-rgb', primary);
    const accent = tenant.branding.accentColor
      ? hexToRgbTriplet(tenant.branding.accentColor)
      : null;
    if (accent) root.style.setProperty('--whalabi-accent-rgb', accent);
  }, [tenant]);

  return (
    <TenantContext.Provider value={{ tenant, loading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}

/** Convierte "#4f46e5" o "#abc" a "79 70 229" (triplete RGB para CSS vars). */
function hexToRgbTriplet(hex: string): string | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return `${r} ${g} ${b}`;
}
