'use client';

import { useEffect, useRef, useState } from 'react';
import { Reveal } from '@/components/ui/client';
import { useT } from '@/lib/i18n';

const nodes = [
  { label: 'site.model.programmes', pos: 'left-1/2 top-[12.5%]' },
  { label: 'site.model.impact', pos: 'left-[87.5%] top-1/2' },
  { label: 'site.model.surplus', pos: 'left-1/2 top-[87.5%]' },
  { label: 'site.model.reinvest', pos: 'left-[12.5%] top-1/2' },
];

const CIRC = 942.5; // 2 * pi * 150

export function BenefitLoop() {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setDrawn(true); io.disconnect(); } }, { rootMargin: '0px 0px -25% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="model" className="border-y border-line py-[clamp(72px,10vw,128px)]">
      <div className="mx-auto grid max-w-[1200px] items-center gap-[clamp(40px,6vw,96px)] px-4 md:px-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <Reveal><h2 className="text-[clamp(32px,4.2vw,52px)] font-bold leading-[1.1]">{t('site.model.title')}</h2></Reveal>
          <Reveal delay={80}>
            <p className="mt-5 max-w-[520px] text-lg text-muted">
              {t('site.model.body')}
            </p>
          </Reveal>
        </div>

        <Reveal className="w-full">
          <div ref={ref} aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[420px]">
            <svg viewBox="0 0 400 400" className="size-full -rotate-90">
              <circle cx="200" cy="200" r="150" className="fill-none stroke-line [stroke-width:2]" />
              <circle cx="200" cy="200" r="150" className="fill-none stroke-brand transition-[stroke-dashoffset] duration-[2000ms] ease-in-out [stroke-linecap:round] [stroke-width:3]"
                style={{ strokeDasharray: CIRC, strokeDashoffset: drawn ? 0 : CIRC }} />
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center font-display text-[clamp(24px,3vw,34px)] font-extrabold leading-[1.1] tracking-[-0.02em]">
              {t('site.model.center1')}<br />{t('site.model.center2')}
            </div>
            <div className="orbit pointer-events-none absolute inset-[12.5%]">
              <span className="absolute -top-[5px] left-1/2 -ml-[5px] size-2.5 rounded-full bg-gold ring-4 ring-gold/20" />
            </div>
            {nodes.map(n => (
              <div key={n.label} className={`absolute z-[1] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-line bg-bg px-3 py-1.5 text-xs font-bold md:px-4 md:py-2 md:text-sm ${n.pos}`}>
                {t(n.label)}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
