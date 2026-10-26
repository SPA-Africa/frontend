'use client';

import { useEffect, useState } from 'react';
import { SectionHead } from '@/components/ui';
import { Reveal } from '@/components/ui/client';
import { cx } from '@/lib/format';
import { useT } from '@/lib/i18n';

const values = [
  { letter: 'S', id: 'service' },
  { letter: 'H', id: 'humility' },
  { letter: 'A', id: 'accountability' },
  { letter: 'P', id: 'productivity' },
  { letter: 'E', id: 'excellence' },
];

/* SHAPE letters: one opens at a time on wide screens, all stacked and readable on small ones */
export function Values() {
  const t = useT();
  const [open, setOpen] = useState(0);
  const [hover, setHover] = useState(false);
  useEffect(() => { setHover(matchMedia('(hover: hover)').matches); }, []);

  return (
    <section id="values" className="scroll-mt-24 border-y border-line py-[clamp(72px,10vw,128px)]">
      <div className="mx-auto max-w-[1200px] px-4 md:px-12">
        <Reveal><SectionHead title={t('site.values.title')} sub={t('site.values.sub')} /></Reveal>
        <div className="flex flex-col gap-3 lg:h-[440px] lg:flex-row">
          {values.map((v, i) => {
            const isOpen = open === i;
            return (
              <button key={v.letter} type="button" aria-expanded={isOpen}
                onClick={() => setOpen(i)} onFocus={() => setOpen(i)} onPointerEnter={() => hover && setOpen(i)}
                className={cx(
                  'group relative flex min-w-0 items-center gap-5 overflow-hidden rounded-[var(--radius-card)] px-6 py-5 text-left transition-[flex,background-color,color] duration-700 ease-[var(--ease-out-soft)]',
                  'lg:flex-col lg:items-stretch lg:justify-between lg:gap-0 lg:p-7',
                  isOpen ? 'bg-brand text-white lg:flex-[3]' : 'bg-surface text-ink lg:flex-1',
                )}>
                <span aria-hidden="true" className={cx('w-14 flex-none font-display text-[64px] font-extrabold leading-[0.85] tracking-[-0.05em] transition-colors lg:w-auto lg:text-[clamp(80px,10vw,160px)]',
                  isOpen ? 'text-white' : 'text-ink group-hover:text-brand')}>{v.letter}</span>
                <span className={cx('block min-w-0 transition duration-500 ease-[var(--ease-out-soft)] lg:min-w-[240px]',
                  isOpen ? 'opacity-100 lg:translate-y-0 lg:delay-200' : 'lg:translate-y-4 lg:opacity-0')}>
                  <span className="mb-1.5 block font-display text-[clamp(24px,2.4vw,34px)] font-bold tracking-[-0.02em]">{t(`site.values.${v.id}`)}</span>
                  <span className="block max-w-[340px] opacity-90">{t(`site.values.${v.id}Text`)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
