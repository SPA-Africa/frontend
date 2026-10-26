'use client';

// Small pieces shared by the organisation portal pages.

import { Check } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cx } from '@/lib/format';
import type { DeliveryMode } from '@/lib/api/services/core/capacity';
import type { CatalogueTopic } from '@/lib/types';

export const ORG_TODAY = () => new Date().toISOString().slice(0, 10);

const modeKey: Record<DeliveryMode, string> = { 'In-person': 'org.mode.inPerson', Virtual: 'org.mode.virtual', Hybrid: 'org.mode.hybrid' };
const kindKey: Record<CatalogueTopic['kind'], string> = {
  'Capacity Building': 'org.kind.capacity', 'Leadership Training': 'org.kind.leadership', Coaching: 'org.kind.coaching',
};

/** Translated labels for values that come from the API. */
export function useOrgLabels() {
  const t = useT();
  return {
    mode: (m: string) => (modeKey[m as DeliveryMode] ? t(modeKey[m as DeliveryMode]) : m),
    kind: (k: string) => (kindKey[k as CatalogueTopic['kind']] ? t(kindKey[k as CatalogueTopic['kind']]) : k),
    role: (r: string) => t(`org.role.${r}`),
    band: (score: number) => t(score >= 0.75 ? 'org.assess.bandStrong' : score >= 0.5 ? 'org.assess.bandSolid' : 'org.assess.bandEarly'),
    score: (v: number) => Math.round(v * 100),
  };
}

/** Horizontal step indicator, collapses to "Step x of y" on small screens. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  const t = useT();
  return (
    <nav aria-label={t('org.book.progress')} className="mb-6">
      <p className="mb-3 text-sm font-semibold text-muted sm:hidden">
        {t('org.book.stepOf', { n: current + 1, total: steps.length })} <span className="text-ink">{steps[current]}</span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2 sm:hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${((current + 1) / steps.length) * 100}%` }} />
      </div>
      <ol className="hidden items-center gap-2 sm:flex">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === current ? 'step' : undefined}>
            <span className={cx('grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition',
              i < current ? 'bg-ok text-white' : i === current ? 'bg-brand text-white' : 'bg-surface-2 text-muted')}>
              {i < current ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : i + 1}
            </span>
            <span className={cx('text-sm font-semibold', i === current ? 'text-ink' : 'text-muted')}>{s}</span>
            {i < steps.length - 1 && <span className={cx('h-px flex-1', i < current ? 'bg-ok' : 'bg-line')} />}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Score bar for assessment areas: red below 50, gold 50 to 74, green 75 and above. */
export function ScoreBar({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const v = Math.round(value * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className={cx('font-semibold', highlight && 'text-brand')}>{label}</span>
        <span className="font-display font-bold tabular-nums">{v}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
        <div className={cx('h-full rounded-full transition-[width] duration-700', value < 0.5 ? 'bg-brand' : value < 0.75 ? 'bg-gold' : 'bg-ok')} style={{ width: `${Math.max(3, v)}%` }} />
      </div>
    </div>
  );
}

/** Print rules for the invoice document. */
export function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { margin: 14mm; }
        body { background: #fff !important; }
        header.sticky, aside.sticky, nav, .no-print { display: none !important; }
        main { padding: 0 !important; }
        .print-sheet { border: none !important; box-shadow: none !important; margin: 0 !important; max-width: none !important; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `}</style>
  );
}

/** Label and value pair used in detail lists. */
export function Detail({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}
