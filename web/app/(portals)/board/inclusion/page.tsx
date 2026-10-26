'use client';

// Women and youth share per pillar against the 50% minimum. Read-only.

import { Async, KpiTile, Legend, PageHead, Panel, PillarTag, ShareBar, Skeleton, SkeletonPanel } from '@/components/dash';
import { ReadOnlyPill } from '@/components/admin/kit';
import { useApi } from '@/lib/api/hooks';
import { reporting } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { cx, num, pct } from '@/lib/format';

export default function Inclusion() {
  const t = useT();
  const summary = useApi(() => reporting.getSummary(), []);
  const s = summary.data;
  const below = s?.reach.filter(r => r.women < s.inclusionTarget || r.youth < s.inclusionTarget) ?? [];
  const sk = <Skeleton className="h-7 w-16" />;

  return (
    <div className="space-y-6">
      <PageHead title={t('nav.inclusion')} meta={<ReadOnlyPill />} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiTile label={t('board.inclusion.womenAll')} value={s ? pct(s.totals.women) : sk} tone={s && s.totals.women >= s.inclusionTarget ? 'ok' : 'brand'} hint={s ? t('board.inclusion.minimum', { pct: pct(s.inclusionTarget) }) : undefined} />
        <KpiTile label={t('board.inclusion.youthAll')} value={s ? pct(s.totals.youth) : sk} tone={s && s.totals.youth >= s.inclusionTarget ? 'ok' : 'brand'} hint={s ? t('board.inclusion.minimum', { pct: pct(s.inclusionTarget) }) : undefined} />
        <KpiTile className="col-span-2 lg:col-span-1" label={t('board.inclusion.below')} value={s ? `${below.length}/${s.reach.length}` : sk} tone={s && below.length === 0 ? 'ok' : 'brand'}
          hint={s ? (below.length ? below.map(b => t(`pillar.${b.pillarId}`)).join(', ') : t('board.inclusion.allMeet')) : undefined} />
      </div>

      <Panel title={t('board.inclusion.byPillar')}>
        <Async state={summary} skeleton={<Skeleton className="h-56 w-full" />}>
          {d => {
            const label = t('board.inclusion.chartLabel', { rows: d.reach.map(r => `${t(`pillar.${r.pillarId}`)}: ${pct(r.women)}, ${pct(r.youth)}`).join('; ') });
            return (
              <>
                <Legend className="mb-5" items={[{ label: t('board.inclusion.women'), tone: 'brand' }, { label: t('board.inclusion.youth'), tone: 'gold' }, { label: t('board.inclusion.minimum', { pct: pct(d.inclusionTarget) }), tone: 'subtle', dashed: true }]} />
                <figure aria-label={label}>
                  <figcaption className="sr-only">{label}</figcaption>
                  <div aria-hidden>
                    <div className="relative flex h-52 items-end gap-3 border-b border-line sm:gap-6">
                      <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-subtle" style={{ bottom: `${d.inclusionTarget * 88}%` }}>
                        <span className="absolute -top-5 right-0 bg-bg pl-1 text-[11px] font-semibold text-muted">{pct(d.inclusionTarget)}</span>
                      </div>
                      {d.reach.map(r => (
                        <div key={r.pillarId} className="flex h-full min-w-0 flex-1 items-end justify-center gap-1">
                          {([['women', 'bg-brand'], ['youth', 'bg-gold']] as const).map(([k, bg]) => (
                            <div key={k} className="flex h-full w-full max-w-9 flex-col items-center justify-end">
                              <span className="mb-1 text-[11px] font-bold tabular-nums">{Math.round(r[k] * 100)}</span>
                              <div className={cx('w-full rounded-t-md', bg)} style={{ height: `${r[k] * 88}%` }} />
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-3 sm:gap-6">
                      {d.reach.map(r => <span key={r.pillarId} className="min-w-0 flex-1 truncate text-center text-xs text-muted">{t(`pillar.${r.pillarId}`)}</span>)}
                    </div>
                  </div>
                </figure>
              </>
            );
          }}
        </Async>
      </Panel>

      <Async state={summary} skeleton={<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <SkeletonPanel key={i} rows={2} />)}</div>}>
        {d => (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {d.reach.map(r => (
              <Panel key={r.pillarId} title={<PillarTag id={r.pillarId} label={t(`pillar.${r.pillarId}`)} className="text-base" />}
                action={<span className="text-sm text-muted">{t('board.inclusion.learners', { n: num(r.learners) })}</span>}>
                <div className="space-y-4">
                  <ShareBar label={t('board.inclusion.women')} value={r.women} target={d.inclusionTarget} tone="brand" />
                  <ShareBar label={t('board.inclusion.youth')} value={r.youth} target={d.inclusionTarget} tone="gold" />
                </div>
              </Panel>
            ))}
          </div>
        )}
      </Async>
    </div>
  );
}
