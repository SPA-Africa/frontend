'use client';

// Board of Trustees overview. Read-only: the board_auditor role has SELECT access only.

import { TrendingDown } from 'lucide-react';
import {
  Async, BarList, KpiTile, PageHead, Panel, PanelLink, PillarTag, Row, ShareBar, Skeleton, SkeletonPanel, StatusPill, TargetBar,
} from '@/components/dash';
import { ReadOnlyPill } from '@/components/admin/kit';
import { useApi } from '@/lib/api/hooks';
import { metrics, reporting } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { cx, date, num, pct } from '@/lib/format';

export default function BoardOverview() {
  const t = useT();
  const summary = useApi(() => reporting.getSummary(), []);
  const kpis = useApi(() => metrics.listKpis({ query: { pillar: 'all' } }), []);

  const headline = kpis.data?.find(k => k.pillarId === 'all');
  const sk = <Skeleton className="h-7 w-16" />;
  const s = summary.data;
  const current = s?.phases.find(p => p.status === 'current');

  return (
    <div className="space-y-6">
      <PageHead title={t('board.home.title')} meta={<><ReadOnlyPill />{s && <span>{t('admin.common.asOf', { date: date(s.asOf) })}</span>}</>} />

      <Panel title={current ? t('board.home.phase', { n: current.n, name: current.name }) : t('board.home.phaseLoading')}
        action={current && <span className="text-sm text-muted">{current.years}</span>}>
        {!s ? <Skeleton className="h-16 w-full" /> : (
          <>
            <ol className="grid grid-cols-6 gap-1.5" aria-label={t('board.plan.phases')}>
              {s.phases.map(p => (
                <li key={p.n} className="min-w-0">
                  <div className={cx('h-2.5 rounded-full', p.status === 'current' ? 'bg-brand' : p.status === 'done' ? 'bg-ok' : 'bg-surface-2')} />
                  <div className={cx('mt-2 truncate text-xs', p.status === 'current' ? 'font-bold text-ink' : 'text-muted')}>
                    <span className="sm:hidden">P{p.n}</span><span className="hidden sm:inline">{p.n}. {p.name}</span>
                  </div>
                  <span className="sr-only">{t(`board.plan.status.${p.status}`)}</span>
                </li>
              ))}
            </ol>
            {current && (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <div className="text-sm font-semibold sm:col-span-2">{t('board.plan.outputsBy', { year: current.by })}</div>
                {current.outputs.map(o => <div key={o} className="rounded-xl bg-surface px-3 py-2 text-sm">{o}</div>)}
              </div>
            )}
          </>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label={t('admin.home.learners')} value={s ? num(s.totals.learners) : sk} spark={s?.monthly.map(m => m.value)} />
        <KpiTile label={t('admin.home.trained')} value={headline ? num(headline.actual) : sk} spark={headline?.trend.map(x => x.actual)}
          hint={headline ? t('admin.home.ofTarget', { target: num(headline.target), year: headline.dueYear }) : undefined} />
        <KpiTile label={t('board.inclusion.women')} value={s ? pct(s.totals.women) : sk} tone={s && s.totals.women >= s.inclusionTarget ? 'ok' : 'brand'}
          hint={s ? t('board.inclusion.minimum', { pct: pct(s.inclusionTarget) }) : undefined} />
        <KpiTile label={t('board.inclusion.youth')} value={s ? pct(s.totals.youth) : sk} tone={s && s.totals.youth >= s.inclusionTarget ? 'ok' : 'brand'}
          hint={s ? t('board.inclusion.minimum', { pct: pct(s.inclusionTarget) }) : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t('board.home.byPillar')}>
          <Async state={summary} skeleton={<SkeletonPanel rows={5} className="border-0 p-0" />}>
            {d => <BarList title={t('board.home.byPillar')} data={d.reach.map(r => ({ label: t(`pillar.${r.pillarId}`), value: r.learners }))} />}
          </Async>
        </Panel>
        <Panel title={t('board.home.inclusion')} action={<PanelLink href="/board/inclusion">{t('nav.inclusion')}</PanelLink>}>
          <Async state={summary} skeleton={<SkeletonPanel rows={2} className="border-0 p-0" />}>
            {d => (
              <div className="space-y-6">
                <ShareBar label={t('board.inclusion.women')} value={d.totals.women} target={d.inclusionTarget} tone="brand" />
                <ShareBar label={t('board.inclusion.youthAges')} value={d.totals.youth} target={d.inclusionTarget} tone="gold" />
                <p className="flex items-center gap-2 text-xs text-muted"><span className="h-3.5 w-0.5 rounded-full bg-ink" aria-hidden /> {t('board.inclusion.minimum', { pct: pct(d.inclusionTarget) })}</p>
              </div>
            )}
          </Async>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={t('board.home.kpis')}>
          <Async state={kpis} skeleton={<SkeletonPanel rows={6} className="border-0 p-0" />}>
            {data => (
              <>
                <ul className="grid gap-x-10 gap-y-6 md:grid-cols-2">
                  {data.filter(k => k.pillarId !== 'all').map(k => (
                    <li key={k.id}>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="mr-auto font-semibold">{k.label}</span>
                        {k.pillarId !== 'all' && <PillarTag id={k.pillarId} label={t(`pillar.${k.pillarId}`)} className="text-xs" />}
                      </div>
                      <TargetBar label={k.label} actual={k.actual} target={k.target} expected={k.expected} behind={k.status === 'behind'} unit={k.unit} />
                    </li>
                  ))}
                </ul>
                <p className="mt-6 flex items-center gap-2 text-xs text-muted"><span className="h-3.5 w-0.5 rounded-full bg-ink" aria-hidden /> {t('admin.common.expectedMarker')}</p>
              </>
            )}
          </Async>
        </Panel>

        <Panel title={t('board.home.behind')}>
          <Async state={kpis} skeleton={<div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>}
            empty={d => !d.some(k => k.status === 'behind')} emptyView={<p className="text-sm text-muted">{t('board.home.noneBehind')}</p>}>
            {data => (
              <ul className="-mx-2 divide-y divide-line">
                {data.filter(k => k.status === 'behind').map(k => (
                  <li key={k.id}>
                    <Row leading={<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted"><TrendingDown size={18} /></span>}
                      title={k.label}
                      sub={`${k.pillarId === 'all' ? t('admin.common.allPillars') : t(`pillar.${k.pillarId}`)} · ${num(k.actual)} / ${num(k.target)}${k.unit ? ` ${k.unit}` : ''} · ${t('admin.home.ofExpected', { pct: pct(k.ratio) })}`}
                      trailing={<StatusPill status="behind" />} />
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Panel>
      </div>
    </div>
  );
}
