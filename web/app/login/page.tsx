import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/public/LoginForm';
import { AuthShell } from '@/components/public/auth';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
