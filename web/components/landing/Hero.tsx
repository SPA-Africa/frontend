'use client';

import { useEffect, useState } from 'react';
import { buttonClass } from '@/components/ui';
import { cx } from '@/lib/format';
import { useT } from '@/lib/i18n';
import AfricaDots from './AfricaDots';

const lines = ['site.hero.line1', 'site.hero.line2', 'site.hero.line3', 'site.hero.line4'];

export function Hero() {
  const t = useT();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // wait briefly for web fonts so the headline doesn't reflow mid-animation
    let done = false;
    const go = () => { if (!done) { done = true; requestAnimationFrame(() => setShown(true)); } };
    document.fonts?.ready.then(go);
    const timer = setTimeout(go, 600);
    return () => { done = true; clearTimeout(timer); };
  }, []);

  const ease = 'transition duration-[1300ms] ease-[cubic-bezier(0.16,1,0.3,1)]';
  const fade = (i: number) => ({ className: cx('transition duration-1000 ease-[var(--ease-out-soft)]', shown ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'), style: { transitionDelay: `${350 + i * 80}ms` } });

  return (
    <section id="hero" className="relative flex min-h-[calc(92svh-5rem)] items-end overflow-hidden pb-16 pt-10 md:min-h-[calc(100svh-5rem)] md:items-center md:py-16">
      <AfricaDots className="absolute inset-0 size-full" />
      <div className="pointer-events-none relative z-[1] mx-auto w-full max-w-[1200px] px-4 md:px-12">
        <h1 className="font-display text-[clamp(42px,7vw,96px)] font-extrabold leading-none tracking-[-0.04em]">
          {lines.map((l, i) => (
            <span key={l} className="-mb-[0.08em] block overflow-hidden pb-[0.08em]">
              <span className={cx('inline-block', ease, shown ? 'translate-y-0' : 'translate-y-[105%]', i === 3 && 'text-brand')}
                style={{ transitionDelay: `${i * 100}ms` }}>{t(l)}</span>
            </span>
          ))}
        </h1>
        <p style={fade(0).style} className={cx(fade(0).className, 'mt-7 max-w-[460px] text-[clamp(17px,1.4vw,20px)] text-muted')}>
          {t('site.hero.lead')}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <div {...fade(1)}><a href="#pillars" className={cx(buttonClass('primary', 'lg'), 'pointer-events-auto')}>{t('site.hero.seeWhat')}</a></div>
          <div {...fade(2)}><a href="#join" className={cx(buttonClass('ghost', 'lg'), 'pointer-events-auto bg-bg/60')}>{t('site.cta.involved')}</a></div>
        </div>
      </div>
    </section>
  );
}
