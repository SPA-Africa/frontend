import type { Metadata } from 'next';
import { PublicPage } from '@/components/shell/SiteChrome';
import { VerifyResult } from '@/components/public/VerifyForm';

type Params = { params: Promise<{ code: string }> };

const clean = (raw: string) => decodeURIComponent(raw).trim().toUpperCase();

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: `Certificate ${clean((await params).code)}`, robots: { index: false } };
}

export default async function VerifyResultPage({ params }: Params) {
  const code = clean((await params).code);
  return (
    <PublicPage>
      <div className="mx-auto max-w-2xl px-4 py-12 md:px-12 md:py-20">
        <VerifyResult code={code} />
      </div>
    </PublicPage>
  );
}
