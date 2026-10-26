import type { Metadata } from 'next';
import { AuthShell } from '@/components/public/auth';
import { OrgRegisterAside, OrgRegisterForm } from '@/components/public/OrgRegisterForm';

export const metadata: Metadata = { title: 'Register your organisation' };

export default function OrgRegisterPage() {
  return (
    <AuthShell aside={<OrgRegisterAside />}>
      <OrgRegisterForm />
    </AuthShell>
  );
}
