// Presentational bits for the console (no hooks, safe in any component).

import { cx, dateLocale, fmtDate } from '@/lib/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short month label from the API ("Oct") in the current locale. */
export const monthLabel = (m: string, locale: string) => {
  const i = MONTHS.indexOf(m.slice(0, 3));
  if (i < 0) return m;
  return fmtDate(new Date(Date.UTC(2026, i, 15)), { month: 'short', timeZone: 'UTC' }).replace('.', '');
};

/** Quarter shown like a date badge: Q4 over 2026. */
export function QuarterChip({ quarter, current }: { quarter: string; current?: boolean }) {
  const [y, q] = quarter.split('-');
  return (
    <span className={cx('flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none', current ? 'bg-brand text-white' : 'bg-surface text-ink')}>
      <span className="font-display text-base font-bold">{q}</span>
      <span className={cx('mt-0.5 text-[11px] font-semibold', current ? 'text-white/85' : 'text-muted')}>{y}</span>
    </span>
  );
}

/** Share against a minimum, with the minimum as a marker. Labels come from the caller (i18n). */
export function ShareMeter({ label, value, minimum, status, tone = 'brand' }: { label: string; value: number; minimum: number; status: string; tone?: 'brand' | 'gold' | 'ok' }) {
  const bar = tone === 'ok' ? 'bg-ok' : tone === 'gold' ? 'bg-gold' : 'bg-brand';
  const meets = value >= minimum;
  return (
    <div role="img" aria-label={`${label}: ${Math.round(value * 100)}%. ${status}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="font-display text-[26px] font-bold leading-none tabular-nums">{Math.round(value * 100)}%</span>
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-2">
        <div className={cx('h-full rounded-full', bar)} style={{ width: `${Math.min(100, value * 100)}%` }} />
        <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `calc(${minimum * 100}% - 1px)` }} aria-hidden />
      </div>
      <div className={cx('mt-1.5 text-sm font-semibold', meets ? 'text-ok' : 'text-brand')}>{status}</div>
    </div>
  );
}
