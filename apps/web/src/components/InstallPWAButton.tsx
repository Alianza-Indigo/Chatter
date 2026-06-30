'use client';

import { usePWA } from '@/lib/use-pwa';

export function InstallPWAButton() {
  const { canInstall, installed, promptInstall } = usePWA();
  if (installed || !canInstall) return null;
  return (
    <button
      type="button"
      onClick={() => void promptInstall()}
      className="rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand transition hover:bg-brand/10"
    >
      Instalar app
    </button>
  );
}
