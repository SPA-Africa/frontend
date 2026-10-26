// Dashboard building blocks shared by every portal.
// Rules: one card style (white on the warm canvas, 1px line, 20px radius), headings are short
// labels, numbers use the display face, colour means something (red = act, gold = detail,
// green = on track). No decorative icons on stat tiles, no gradients.

import Link from 'next/link';
import { ChevronRight, Cpu, GraduationCap, Rocket, Sprout, Star } from 'lucide-react';
import { cx, dateLocale, fmtDate } from '@/lib/format';
import { AFRICA_ASPECT, AFRICA_POINTS } from '@/lib/africa-points';
import type { PillarId } from '@/lib/types';

/* ---------- pillars ---------- */
export const pillarIcon: Record<PillarId, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  technology: Cpu, education: GraduationCap, leadership: Star, young_startups: Rocket, agriculture: Sprout,
};
export const pillarColor: Record<PillarId, string> = {
  technology: 'var(--color-p-technology)', education: 'var(--color-p-education)', leadership: 'var(--color-p-leadership)',
  young_startups: 'var(--color-p-young_startups)', agriculture: 'var(--color-p-agriculture)',
};

export function PillarTag({ id, label, className }: { id: PillarId; label: string; className?: string }) {
  const Icon = pillarIcon[id];
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-sm font-semibold', className)} style={{ color: pillarColor[id] }}>
      <Icon size={15} /> {label}
    </span>
  );
}

/* ---------- page head ---------- */
export interface Crumb { href?: string; label: string }

export function PageHead({ title, crumbs, actions, meta }: { title: string; crumbs?: Crumb[]; actions?: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-sm text-muted">
            {crumbs.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {c.href ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span>{c.label}</span>}
                {i < crumbs.length - 1 && <ChevronRight size={14} className="text-subtle" />}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[28px] font-bold leading-tight md:text-[32px]">{title}</h1>
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- panel ---------- */
export function Panel({ title, action, children, className, bodyClassName, flush, id }: {
  title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string; flush?: boolean; id?: string;
}) {
  return (
    <section id={id} className={cx('min-w-0 rounded-[var(--radius-card)] border border-line bg-bg', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {action}
        </header>
      )}
      <div className={cx(flush ? '' : 'p-5', !flush && !!(title || action) && 'pt-3', bodyClassName)}>{children}</div>
    </section>
  );
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark">{children}<ChevronRight size={15} /></Link>;
}

/* ---------- KPI tile ---------- */
export function KpiTile({ label, value, delta, hint, tone, spark, className }: {
  label: string; value: React.ReactNode; delta?: { value: string; good?: boolean }; hint?: React.ReactNode; tone?: 'brand' | 'ok';
  spark?: number[]; className?: string;
}) {
  return (
    <div className={cx('min-w-0 rounded-[var(--radius-card)] border border-line bg-bg px-5 py-4', className)}>
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <div className={cx('font-display text-[28px] font-bold leading-none tracking-tight tabular-nums', tone === 'brand' && 'text-brand', tone === 'ok' && 'text-ok')}>{value}</div>
        {spark && <Sparkline values={spark} />}
      </div>
      {(delta || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
          {delta && <span className={cx('font-semibold tabular-nums', delta.good === false ? 'text-brand' : 'text-ok')}>{delta.value}</span>}
          {hint && <span className="text-muted">{hint}</span>}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, width = 84, height = 28, className }: { values: number[]; width?: number; height?: number; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cx('shrink-0 overflow-visible', className)} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--color-brand)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill="var(--color-brand)" />
    </svg>
  );
}

/* ---------- meter (thin progress with optional expected marker) ---------- */
export function Meter({ value, expected, tone = 'brand', className, label }: { value: number; expected?: number; tone?: 'brand' | 'ok' | 'gold'; className?: string; label?: string }) {
  const c = tone === 'ok' ? 'bg-ok' : tone === 'gold' ? 'bg-gold' : 'bg-brand';
  const clamp = (n: number) => Math.min(100, Math.max(0, n * 100));
  return (
    <div className={cx('relative h-2 w-full rounded-full bg-surface-2', className)} role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx('h-full rounded-full transition-[width] duration-700', c)} style={{ width: `${clamp(value)}%` }} />
      {expected !== undefined && <span className="absolute -top-1 h-4 w-0.5 rounded bg-ink" style={{ left: `calc(${clamp(expected)}% - 1px)` }} aria-hidden="true" />}
    </div>
  );
}

/* ---------- date badge (upcoming lists) ---------- */
export function DateBadge({ iso, tone = 'neutral' }: { iso: string; tone?: 'neutral' | 'brand' }) {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  return (
    <span className={cx('flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none',
      tone === 'brand' ? 'bg-brand text-white' : 'bg-surface text-ink')}>
      <span className={cx('text-[11px] font-semibold uppercase', tone === 'brand' ? 'text-white/85' : 'text-muted')}>{fmtDate(d, { month: 'short' })}</span>
      <span className="font-display text-lg font-bold">{d.getDate()}</span>
    </span>
  );
}

/* ---------- skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cx('block animate-pulse rounded-lg bg-surface-2', className)} aria-hidden="true" />;
}

export function SkeletonPanel({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx('rounded-[var(--radius-card)] border border-line bg-bg p-5', className)} aria-busy="true">
      <Skeleton className="mb-5 h-4 w-40" />
      <div className="space-y-3">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
    </div>
  );
}

/* ---------- Africa mark (from the logo silhouette, used as a quiet brand motif) ---------- */
export function AfricaMark({ className, color = 'currentColor', step = 4, dot = 0.0042 }: { className?: string; color?: string; step?: number; dot?: number }) {
  const pts = AFRICA_POINTS.filter((_, i) => i % step === 0);
  return (
    <svg viewBox={`0 0 ${AFRICA_ASPECT} 1`} className={className} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={dot} fill={color} />)}
    </svg>
  );
}

/* ---------- list row ---------- */
export function Row({ href, leading, title, sub, trailing, onClick }: {
  href?: string; leading?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; trailing?: React.ReactNode; onClick?: () => void;
}) {
  const inner = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
      </span>
      {trailing}
    </>
  );
  const cls = 'flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-surface';
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cx(cls, 'hover:bg-transparent')}>{inner}</div>;
}
