import type { Metadata } from 'next';
import { PublicPage } from '@/components/shell/SiteChrome';
import { VerifyIntro } from '@/components/public/VerifyForm';

export const metadata: Metadata = {
  title: 'Verify a certificate',
  description: 'Check that a SHAPE Potential Africa certificate is genuine.',
};

export default function VerifyPage() {
  return (
    <PublicPage>
      <div className="mx-auto max-w-2xl px-4 py-14 md:px-12 md:py-24">
        <VerifyIntro />
      </div>
    </PublicPage>
  );
}
