'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMatrix } from '@/lib/matrix-provider';
import { LoginForm } from '@/components/LoginForm';
import { LoadingState } from '@/components/states';

export default function LoginPage() {
  const router = useRouter();
  const { ready, session } = useMatrix();

  useEffect(() => {
    if (ready && session) router.replace('/chat');
  }, [ready, session, router]);

  if (!ready) return <LoadingState label="Cargando…" />;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-indigo-50 to-lavender-300/30 p-4 dark:from-slate-950 dark:to-slate-900">
      <LoginForm />
    </div>
  );
}
