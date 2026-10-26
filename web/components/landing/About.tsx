'use client';

import { Reveal } from '@/components/ui/client';
import { useT } from '@/lib/i18n';

const pillarNames = ['pillar.technology', 'pillar.education', 'pillar.leadership', 'pillar.young_startups', 'pillar.agriculture'];

/* slow band of pillar names under the hero */
export function PillarBand() {
  const t = useT();
  const row = (
    <div className="flex items-center gap-9 pr-9">
      {pillarNames.map((n, i) => (
        <span key={n} className="contents">
          <span className={`whitespace-nowrap font-display text-[clamp(24px,3vw,36px)] font-bold tracking-[-0.02em] ${i % 2 ? 'text-brand' : ''}`}>{t(n)}</span>
          <i className="size-2 flex-none rounded-full bg-gold" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden border-y border-line py-5" aria-hidden="true">
      <div className="band-track flex w-max">{row}{row}</div>
    </div>
  );
}

export function About() {
  const t = useT();
  return (
    <section id="about" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 py-[clamp(72px,10vw,128px)] md:px-12">
      <div className="mb-[clamp(48px,7vw,80px)] grid gap-[clamp(24px,6vw,96px)] md:grid-cols-[1fr_1.6fr]">
        <Reveal><h2 className="text-[clamp(32px,4.2vw,52px)] font-bold leading-[1.1]">{t('site.about.title')}</h2></Reveal>
        <Reveal delay={80}>
          <p className="mb-4 text-[clamp(20px,1.8vw,24px)] font-medium leading-normal">
            {t('site.about.lead')}
          </p>
          <p className="text-[17px] leading-relaxed text-muted">
            {t('site.about.body')}
          </p>
        </Reveal>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Reveal as="article" className="rounded-[var(--radius-card)] bg-surface p-[clamp(28px,4vw,44px)]">
          <h3 className="mb-3.5 text-[15px] font-bold text-brand">{t('site.about.vision')}</h3>
          <p className="text-[clamp(19px,1.7vw,23px)] font-medium leading-snug">
            {t('site.about.visionText')}
          </p>
        </Reveal>
        <Reveal as="article" delay={80} className="rounded-[var(--radius-card)] bg-brand p-[clamp(28px,4vw,44px)] text-white">
          <h3 className="mb-3.5 text-[15px] font-bold text-gold-light">{t('site.about.mission')}</h3>
          <p className="text-[clamp(19px,1.7vw,23px)] font-medium leading-snug">
            {t('site.about.missionText')}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
