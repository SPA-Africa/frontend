// Hand-built charts for the staff portals. No chart library.
// Every chart exposes a text summary to assistive tech and shows its values as visible text.

import { cx, num, pct } from '@/lib/format';

export type ChartTone = 'brand' | 'gold' | 'ok' | 'info' | 'subtle';
const bgTone: Record<ChartTone, string> = { brand: 'bg-brand', gold: 'bg-gold', ok: 'bg-ok', info: 'bg-info', subtle: 'bg-subtle' };
const strokeTone: Record<ChartTone, string> = { brand: 'stroke-brand', gold: 'stroke-gold', ok: 'stroke-ok', info: 'stroke-info', subtle: 'stroke-subtle' };

type Fmt = (n: number) => string;

export function Legend({ items, className }: { items: { label: string; tone: ChartTone; dashed?: boolean; marker?: boolean }[]; className?: string }) {
  return (
    <ul className={cx('flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted', className)}>
      {items.map(i => (
        <li key={i.label} className="flex items-center gap-2">
          {i.marker
            ? <span className="h-3.5 w-0.5 rounded-full bg-ink" aria-hidden />
            : i.dashed
              ? <span className={cx('w-4 border-t-2 border-dashed', i.tone === 'gold' ? 'border-gold' : 'border-subtle')} aria-hidden />
              : <span className={cx('size-2.5 rounded-full', bgTone[i.tone])} aria-hidden />}
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/* ---------- Horizontal bar list ---------- */
export function BarList({ title, data, max, format = num, marker, markerLabel, className }: {
  title: string;
  data: { label: string; value: number; tone?: ChartTone; sub?: string }[];
  max?: number;
  format?: Fmt;
  marker?: number;
  markerLabel?: string;
  className?: string;
}) {
  const top = max ?? Math.max(1, ...data.map(d => d.value));
  const summary = `${title}. ${data.map(d => `${d.label}: ${format(d.value)}`).join('; ')}.${marker !== undefined && markerLabel ? ` ${markerLabel}: ${format(marker)}.` : ''}`;
  return (
    <figure className={className} aria-label={summary}>
      <figcaption className="sr-only">{summary}</figcaption>
      <ul className="flex flex-col gap-4" aria-hidden>
        {data.map(d => (
          <li key={d.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{d.label}{d.sub && <span className="ml-2 font-normal text-subtle">{d.sub}</span>}</span>
              <span className="font-display font-bold tabular-nums">{format(d.value)}</span>
            </div>
            <div className="relative h-3 rounded-full bg-surface-2">
              <div className={cx('h-full rounded-full', bgTone[d.tone ?? 'brand'])} style={{ width: `${Math.min(100, (d.value / top) * 100)}%` }} />
              {marker !== undefined && (
                <span className="absolute -top-1 h-5 w-0.5 rounded-full bg-ink" style={{ left: `${Math.min(100, (marker / top) * 100)}%` }} />
              )}
            </div>
          </li>
        ))}
      </ul>
      {marker !== undefined && markerLabel && <Legend className="mt-4" items={[{ label: `${markerLabel} (${format(marker)})`, tone: 'brand', marker: true }]} />}
    </figure>
  );
}

/* ---------- Column chart (CSS) ---------- */
export function ColumnChart({ title, data, format = num, height = 160, tone = 'brand', className }: {
  title: string;
  data: { label: string; value: number; tone?: ChartTone }[];
  format?: Fmt;
  height?: number;
  tone?: ChartTone;
  className?: string;
}) {
  const top = Math.max(1, ...data.map(d => d.value));
  const summary = `${title}. ${data.map(d => `${d.label}: ${format(d.value)}`).join('; ')}.`;
  return (
    <figure className={className} aria-label={summary}>
      <figcaption className="sr-only">{summary}</figcaption>
      <div aria-hidden>
        <div className="flex items-end gap-2 border-b border-line sm:gap-3" style={{ height }}>
          {data.map(d => (
            <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-bold tabular-nums">{format(d.value)}</span>
              <div className={cx('w-full max-w-12 rounded-t-lg', bgTone[d.tone ?? tone])} style={{ height: `${Math.max(2, (d.value / top) * 82)}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2 sm:gap-3">
          {data.map(d => <span key={d.label} className="min-w-0 flex-1 truncate text-center text-xs text-muted">{d.label}</span>)}
        </div>
      </div>
    </figure>
  );
}

/* ---------- Line chart (SVG lines, HTML labels) ---------- */
export function LineChart({ title, labels, series, format = num, height = 180, className }: {
  title: string;
  labels: string[];
  series: { name: string; values: number[]; tone: ChartTone; dashed?: boolean }[];
  format?: Fmt;
  height?: number;
  className?: string;
}) {
  const top = Math.max(1, ...series.flatMap(s => s.values)) * 1.1;
  const n = labels.length;
  const x = (i: number) => (n === 1 ? 50 : 4 + (i / (n - 1)) * 92);
  const y = (v: number) => 100 - (v / top) * 100;
  const summary = `${title}. ${series.map(s => `${s.name}: ${s.values.map((v, i) => `${labels[i]} ${format(v)}`).join(', ')}`).join('. ')}.`;
  const grid = [0.25, 0.5, 0.75, 1].map(f => top * f / 1.1);
  return (
    <figure className={className} aria-label={summary}>
      <figcaption className="sr-only">{summary}</figcaption>
      <div aria-hidden>
        <Legend className="mb-4" items={series.map(s => ({ label: s.name, tone: s.tone, dashed: s.dashed }))} />
        <div className="relative" style={{ height }}>
          {grid.map(g => (
            <div key={g} className="absolute inset-x-0 border-t border-line" style={{ top: `${y(g)}%` }}>
              <span className="absolute -top-2.5 left-0 bg-bg pr-1 text-[11px] text-subtle tabular-nums">{format(g)}</span>
            </div>
          ))}
          <div className="absolute inset-x-0 bottom-0 border-t border-line" />
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
            {series.map(s => (
              <polyline key={s.name} fill="none" className={strokeTone[s.tone]} strokeWidth={2.5} vectorEffect="non-scaling-stroke"
                strokeDasharray={s.dashed ? '6 5' : undefined} strokeLinejoin="round" strokeLinecap="round"
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            ))}
          </svg>
          {series.filter(s => !s.dashed).map(s => s.values.map((v, i) => (
            <span key={`${s.name}-${i}`} className={cx('absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-bg', bgTone[s.tone])}
              style={{ left: `${x(i)}%`, top: `${y(v)}%` }} />
          )))}
        </div>
        <div className="relative mt-2 h-10">
          {labels.map((l, i) => (
            <div key={l} className="absolute -translate-x-1/2 text-center text-xs" style={{ left: `${x(i)}%` }}>
              <div className="whitespace-nowrap text-muted">{l}</div>
              <div className="font-bold tabular-nums">{format(series[0].values[i])}</div>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

/* ---------- KPI target vs actual bar ---------- */
export function TargetBar({ label, actual, target, expected, behind, unit, className }: {
  label: string; actual: number; target: number; expected: number; behind: boolean; unit?: string; className?: string;
}) {
  const u = unit ? ` ${unit}` : '';
  const summary = `${label}: ${num(actual)}${u} of ${num(target)}${u} target (${pct(actual / target)}). Expected by now: ${num(expected)}${u}. ${behind ? 'Behind target.' : 'On track.'}`;
  return (
    <div className={className} role="img" aria-label={summary}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span><span className="font-display text-lg font-bold tabular-nums">{num(actual)}</span><span className="text-muted"> of {num(target)}{u}</span></span>
        <span className={cx('font-semibold tabular-nums', behind ? 'text-brand' : 'text-ok')}>{pct(actual / target)}</span>
      </div>
      <div className="relative h-3 rounded-full bg-surface-2">
        <div className={cx('h-full rounded-full', behind ? 'bg-brand' : 'bg-ok')} style={{ width: `${Math.min(100, (actual / target) * 100)}%` }} />
        <span className="absolute -top-1 h-5 w-0.5 rounded-full bg-ink" style={{ left: `${Math.min(100, (expected / target) * 100)}%` }} />
      </div>
      <div className="mt-1.5 text-xs text-muted">Expected by now: {num(expected)}{u}</div>
    </div>
  );
}

/* ---------- Share vs minimum target ---------- */
export function ShareBar({ label, value, target = 0.5, tone = 'brand', className }: { label: string; value: number; target?: number; tone?: ChartTone; className?: string }) {
  const meets = value >= target;
  return (
    <div className={className} role="img" aria-label={`${label}: ${pct(value)}, ${meets ? 'meets' : 'below'} the ${pct(target)} minimum`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-display font-bold tabular-nums">{pct(value)}</span>
          <span className={cx('text-xs font-semibold', meets ? 'text-ok' : 'text-brand')}>{meets ? 'Meets' : 'Below'}</span>
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-surface-2">
        <div className={cx('h-full rounded-full', bgTone[tone])} style={{ width: `${Math.min(100, value * 100)}%` }} />
        <span className="absolute -top-1 h-5 w-0.5 rounded-full bg-ink" style={{ left: `${target * 100}%` }} />
      </div>
    </div>
  );
}

/* ---------- 100% stacked bar ---------- */
export function StackBar({ title, segments, format = num, className }: { title: string; segments: { label: string; value: number; tone: ChartTone }[]; format?: Fmt; className?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const summary = `${title}. ${segments.map(s => `${s.label}: ${format(s.value)} (${pct(s.value / total)})`).join('; ')}.`;
  return (
    <figure className={className} aria-label={summary}>
      <figcaption className="sr-only">{summary}</figcaption>
      <div aria-hidden>
        <div className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-surface-2">
          {segments.map(s => <div key={s.label} className={bgTone[s.tone]} style={{ width: `${(s.value / total) * 100}%` }} />)}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {segments.map(s => (
            <li key={s.label} className="flex items-center gap-2">
              <span className={cx('size-2.5 rounded-full', bgTone[s.tone])} />
              <span className="text-muted">{s.label}</span>
              <span className="font-semibold tabular-nums">{pct(s.value / total)}</span>
              <span className="text-subtle tabular-nums">{format(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
