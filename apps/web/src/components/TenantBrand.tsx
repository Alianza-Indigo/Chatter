'use client';

import { useTenant } from '@/lib/tenant-provider';

export function TenantBrand({ compact = false }: { compact?: boolean }) {
  const { tenant } = useTenant();
  const name = tenant?.name ?? 'Whalabi';
  const tagline = tenant?.branding.tagline ?? 'El chat privado de tu organización.';
  const logoUrl = tenant?.branding.logoUrl;

  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className="h-9 w-9 rounded-lg object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-base font-bold text-white">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="leading-tight">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{name}</p>
        {!compact && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{tagline}</p>
        )}
      </div>
    </div>
  );
}
