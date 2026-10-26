'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { buttonClass, SectionHead } from '@/components/ui';
import { Reveal } from '@/components/ui/client';
import { cx } from '@/lib/format';
import { useT } from '@/lib/i18n';

const pillars = [
  {
    id: 'technology',
    icon: <><rect x="14" y="14" width="36" height="36" rx="6" /><rect x="24" y="24" width="16" height="16" rx="2" /><path d="M22 6v8M32 6v8M42 6v8M22 50v8M32 50v8M42 50v8M6 22h8M6 32h8M6 42h8M50 22h8M50 32h8M50 42h8" /></>,
  },
  {
    id: 'education',
    icon: <><path d="M4 24 32 12l28 12-28 12z" /><path d="M14 29v14c0 4 8 9 18 9s18-5 18-9V29" /><path d="M60 24v16" /></>,
  },
  {
    id: 'leadership',
    icon: <path d="M32 6l7 14 15 2-11 11 3 15-14-7-14 7 3-15L10 22l15-2z" />,
  },
  {
    id: 'young_startups',
    icon: <><path d="M38 8c10 0 18 8 18 18-6 6-14 12-22 16l-12-12C26 22 32 14 38 8z" /><circle cx="40" cy="24" r="5" /><path d="M22 30l-10 2-6 8 12 2M34 42l-2 10-8 6-2-12" /></>,
  },
  {
    id: 'agriculture',
    icon: <><path d="M32 58V26" /><path d="M32 34c-10 0-18-8-18-18 10 0 18 8 18 18zM32 26c0-10 8-18 18-18 0 10-8 18-18 18z" /><path d="M12 58h40" /></>,
  },
];

// message keys use 'startups' for the young_startups pillar
const textKey = (id: string) => (id === 'young_startups' ? 'startups' : id);

/* line icon that draws itself once it scrolls into view */
function DrawIcon({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setDrawn(true); io.disconnect(); } }, { rootMargin: '0px 0px -15% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cx('mb-6 grid size-[52px] place-items-center rounded-[14px] bg-brand-light dark:bg-brand/15',
      '[&_svg_*]:[stroke-dasharray:300] [&_svg_*]:transition-[stroke-dashoffset] [&_svg_*]:delay-200 [&_svg_*]:duration-[1600ms] [&_svg_*]:ease-[var(--ease-out-soft)]',
      drawn ? '[&_svg_*]:[stroke-dashoffset:0]' : '[&_svg_*]:[stroke-dashoffset:300]')}>
      <svg viewBox="0 0 64 64" aria-hidden="true" className="size-[30px] fill-none stroke-brand [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:3]">{children}</svg>
    </div>
  );
}

export function Pillars() {
  const t = useT();
  return (
    <section id="pillars" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 py-[clamp(72px,10vw,128px)] md:px-12">
      <Reveal><SectionHead title={t('site.pillars.title')} sub={t('site.pillars.sub')} /></Reveal>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {pillars.map((p, i) => (
          <Reveal as="article" key={p.id} delay={(i % 3) * 80}
            className="rounded-[var(--radius-card)] border border-line bg-bg p-8 transition-[border-color,translate] duration-300 hover:-translate-y-1 hover:border-brand/35">
            <DrawIcon>{p.icon}</DrawIcon>
            <h3 className="mb-2 text-2xl font-bold tracking-[-0.02em]">{t(`pillar.${p.id}`)}</h3>
            <p className="text-muted">{t(`site.pillars.${textKey(p.id)}.text`)}</p>
            <ul className="mt-5 border-t border-line pt-4">
              {[1, 2, 3].map(n => `site.pillars.${textKey(p.id)}.item${n}`).map(it => (
                <li key={it} className="relative py-1.5 pl-[18px] text-[15px] font-semibold before:absolute before:left-0 before:top-[15px] before:size-1.5 before:rounded-full before:bg-gold">{t(it)}</li>
              ))}
            </ul>
          </Reveal>
        ))}
        <Reveal as="article" delay={160} className="flex flex-col items-start justify-center gap-3 rounded-[var(--radius-card)] bg-surface p-8">
          <h3 className="text-2xl font-bold tracking-[-0.02em]">{t('site.pillars.workTitle')}</h3>
          <p className="text-muted">{t('site.pillars.workText')}</p>
          <Link href="#join" className={buttonClass('primary', 'md', 'mt-2')}>{t('site.cta.involved')}</Link>
        </Reveal>
      </div>
    </section>
  );
}
