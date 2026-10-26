'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge, SectionHead } from '@/components/ui';
import { Reveal } from '@/components/ui/client';
import { cx } from '@/lib/format';
import { useT } from '@/lib/i18n';

const phases = [
  { from: 2026, to: 2027, now: true },
  { from: 2028, to: 2029 },
  { from: 2030, to: 2031 },
  { from: 2032, to: 2033 },
  { from: 2034, to: 2035 },
  { from: 2036 },
];

/* ten-year plan: a red line fills as you scroll and each phase lights up as it passes */
export function Timeline() {
  const t = useT();
  const listRef = useRef<HTMLOListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [fill, setFill] = useState(0);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const list = listRef.current;
      if (!list) return;
      const line = window.innerHeight * 0.65;
      const r = list.getBoundingClientRect();
      setFill(Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height))));
      let a = -1;
      itemRefs.current.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= line) a = i; });
      setActive(a);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  return (
    <section id="roadmap" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 py-[clamp(72px,10vw,128px)] md:px-12">
      <Reveal><SectionHead title={t('site.timeline.title')} sub={t('site.timeline.sub')} /></Reveal>
      <ol ref={listRef} className="relative max-w-[820px]">
        <span aria-hidden="true" className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-line" />
        <span aria-hidden="true" className="absolute left-[7px] top-2 h-[calc(100%-16px)] w-0.5 origin-top bg-brand" style={{ transform: `scaleY(${fill})` }} />
        {phases.map((p, i) => {
          const on = i <= active;
          const when = p.to ? t('site.timeline.range', { from: p.from, to: p.to }) : String(p.from);
          return (
            <li key={p.from} ref={el => { itemRefs.current[i] = el; }} aria-current={p.now ? 'step' : undefined}
              className="relative grid gap-x-8 gap-y-2 pb-11 pl-9 last:pb-0 md:grid-cols-[180px_1fr] md:pl-11">
              <span aria-hidden="true" className={cx('absolute left-0 top-1.5 size-4 rounded-full border-2 transition-colors duration-500',
                on ? 'border-brand bg-brand' : 'border-line bg-bg')} />
              <div className={cx('flex flex-wrap items-start gap-2.5 font-display text-lg font-bold transition-colors duration-500', on ? 'text-ink' : 'text-muted')}>
                {when} {p.now && <Badge tone="brand" className="bg-brand! font-sans text-white!">{t('site.timeline.now')}</Badge>}
              </div>
              <div>
                <h3 className="mb-1.5 text-[22px] font-bold tracking-[-0.01em]">{t(`site.timeline.p${i + 1}.title`)}</h3>
                <p className="text-muted">{t(`site.timeline.p${i + 1}.text`)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
