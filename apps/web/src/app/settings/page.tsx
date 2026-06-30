'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMatrix } from '@/lib/matrix-provider';
import { SettingsPanel } from '@/components/SettingsPanel';
import { LoadingState } from '@/components/states';

export default function SettingsPage() {
  const router = useRouter();
  const { ready, session } = useMatrix();

  useEffect(() => {
    if (ready && !session) router.replace('/login');
  }, [ready, session, router]);

  if (!ready || !session) return <LoadingState />;

  return (
    <div className="min-h-[100dvh] bg-slate-100 dark:bg-slate-950">
      <SettingsPanel />
    </div>
  );
}
