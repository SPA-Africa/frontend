'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionHead } from '@/components/ui';
import { Reveal } from '@/components/ui/client';
import { useT } from '@/lib/i18n';

const partners = [
  'tech', 'universities', 'government', 'development', 'edtech',
  'faith', 'business', 'finance', 'investors', 'donors',
];

export function Partners() {
  const t = useT();
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-[clamp(72px,10vw,128px)] md:px-12">
      <Reveal><SectionHead title={t('site.partners.title')} /></Reveal>
      <Reveal>
        <ul className="flex flex-wrap gap-2.5">
          {partners.map(p => <li key={p} className="rounded-full border border-line px-[18px] py-2.5 text-[15px] font-semibold">{t(`site.partners.${p}`)}</li>)}
        </ul>
      </Reveal>
    </section>
  );
}

const ways = [
  { id: 'partner', href: '/register/organisation' },
  { id: 'programme', href: '/register' },
  { id: 'mentor', href: '/register?as=mentor' },
];

export function GetInvolved() {
  const t = useT();
  return (
    <section id="join" className="scroll-mt-24 border-y border-line py-[clamp(72px,10vw,128px)]">
      <div className="mx-auto max-w-[1200px] px-4 md:px-12">
        <Reveal><SectionHead title={t('site.cta.involved')} sub={t('site.join.sub')} /></Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {ways.map((w, i) => (
            <Reveal key={w.id} delay={i * 80}>
              <Link href={w.href}
                className="group relative isolate flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface p-8 transition-colors duration-400 hover:text-white focus-visible:text-white">
                <span aria-hidden="true" className="absolute inset-0 -z-10 translate-y-[101%] bg-brand transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:translate-y-0 group-focus-visible:translate-y-0" />
                <span aria-hidden="true" className="mb-5 block h-1 w-8 rounded-sm bg-brand transition-colors duration-400 group-hover:bg-white group-focus-visible:bg-white" />
                <h3 className="mb-2 text-2xl font-bold tracking-[-0.02em]">{t(`site.join.${w.id}`)}</h3>
                <p className="text-muted transition-colors duration-400 group-hover:text-white/90 group-focus-visible:text-white/90">{t(`site.join.${w.id}Text`)}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold text-brand transition-colors duration-400 group-hover:text-white group-focus-visible:text-white">
                  {t('site.join.start')} <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
