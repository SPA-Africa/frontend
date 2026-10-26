'use client';

import { SectionHead } from '@/components/ui';
import { CountUp, Reveal } from '@/components/ui/client';
import { useT } from '@/lib/i18n';

const goals = [
  { to: 1500, label: 'trained', by: 2029 },
  { to: 5000, label: 'youth', by: 2031 },
  { to: 10000, suffix: '+', label: 'reached', by: 2033 },
  { to: 50, suffix: '+', label: 'startups', by: 2033 },
  { to: 10, label: 'countries', by: 2035 },
  { to: 50, suffix: '%', label: 'inclusion' },
];

export function Goals() {
  const t = useT();
  return (
    <section id="goals" className="border-y border-line py-[clamp(72px,10vw,128px)]">
      <div className="mx-auto max-w-[1200px] px-4 md:px-12">
        <Reveal><SectionHead title={t('site.goals.title')} sub={t('site.goals.sub')} /></Reveal>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goals.map((g, i) => (
            <Reveal key={g.label} delay={(i % 3) * 80} className="flex flex-col gap-1 rounded-[var(--radius-card)] bg-surface p-8">
              <span className="font-display text-[clamp(44px,5vw,64px)] font-extrabold leading-[1.05] tracking-[-0.035em] text-brand tabular-nums">
                <CountUp to={g.to} suffix={g.suffix} duration={1800} />
              </span>
              <p className="font-medium">{t(`site.goals.${g.label}`)}</p>
              <span className="mt-2.5 text-sm text-muted">{g.by ? t('site.goals.by', { year: g.by }) : t('site.goals.everyProject')}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
