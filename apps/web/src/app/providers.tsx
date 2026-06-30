'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from '@/lib/theme-provider';
import { TenantProvider } from '@/lib/tenant-provider';
import { MatrixProvider } from '@/lib/matrix-provider';

/** Árbol de providers de cliente. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TenantProvider>
        <MatrixProvider>{children}</MatrixProvider>
      </TenantProvider>
    </ThemeProvider>
  );
}
