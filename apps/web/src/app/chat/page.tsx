'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMatrix } from '@/lib/matrix-provider';
import { AppShell } from '@/components/AppShell';
import { LoadingState } from '@/components/states';

export default function ChatPage() {
  const router = useRouter();
  const { ready, session } = useMatrix();

  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);

  if (!ready || !session) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <LoadingState label="Conectando con Matrix…" />
      </div>
    );
  }

  return <AppShell />;
}
