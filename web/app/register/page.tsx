import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/public/auth';
import { RegisterForm } from '@/components/public/RegisterForm';

export const metadata: Metadata = { title: 'Join us' };

export default function RegisterPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
