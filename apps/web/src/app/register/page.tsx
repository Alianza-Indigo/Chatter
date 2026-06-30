'use client';

import { RegisterForm } from '@/components/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-indigo-50 to-lavender-300/30 p-4 dark:from-slate-950 dark:to-slate-900">
      <RegisterForm />
    </div>
  );
}
