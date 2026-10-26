'use client';

import { PublicPage } from '@/components/shell/SiteChrome';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n';

export default function NotFound() {
  const t = useT();
  return (
    <PublicPage>
      <div className="mx-auto flex max-w-6xl flex-col items-start px-4 py-20 md:px-12 md:py-32">
        <p aria-hidden="true" className="font-display text-[clamp(96px,18vw,200px)] font-extrabold leading-[0.85] tracking-[-0.05em] text-brand">404</p>
        <h1 className="mt-6 text-[clamp(32px,4vw,48px)] font-bold leading-tight">{t('site.notFound.title')}</h1>
        <p className="mt-3 max-w-lg text-lg text-muted">{t('site.notFound.text')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button href="/" size="lg">{t('site.notFound.home')}</Button>
          <Button href="/courses" variant="ghost" size="lg">{t('site.notFound.courses')}</Button>
          <Button href="/verify" variant="ghost" size="lg">{t('site.nav.verify')}</Button>
        </div>
      </div>
    </PublicPage>
  );
}
