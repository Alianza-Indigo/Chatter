'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMatrix } from '@/lib/matrix-provider';
import { LoadingState } from '@/components/states';

/** Redirige según haya o no sesión activa. */
export default function HomePage() {
  const router = useRouter();
  const { ready, session } = useMatrix();

  useEffect(() => {
    if (!ready) return;
    router.replace(session ? '/chat' : '/login');
  }, [ready, session, router]);

  return (
    <div className="flex h-[100dvh] items-center justify-center">
      <LoadingState label="Cargando Whalabi…" />
    </div>
  );
}
