'use client';

// Pillar Representative home: headline figures, KPIs against the time-prorated target,
// enrolments per month, courses that need work and the latest milestones. Data from services only.

import { Flag, Plus } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import {
  Async, ColumnChart, CourseCover, KpiTile, Legend, Meter, PageHead, Panel, PanelLink, Row, Skeleton, StatusPill,
} from '@/components/dash';
import { PillarScope, useRepPillar } from '@/components/console/ConsoleKit';
import { QuarterChip, monthLabel } from '@/components/console/bits';
import { useApi } from '@/lib/api/hooks';
import { authoring, metrics, milestones } from '@/lib/api/services';
import { useI18n } from '@/lib/i18n';
import { num, pct } from '@/lib/format';

const signed = (n: number, f: (n: number) => string = num) => `${n >= 0 ? '+' : '-'}${f(Math.abs(n))}`;

export default function ConsoleOverview() {
  const { t, locale } = useI18n();
  const pillarId = useRepPillar();
  const overview = useApi(() => metrics.getPillarOverview({ params: { pillarId } }), [pillarId]);
  const kpis = useApi(() => metrics.listKpis({ query: { pillar: pillarId } }), [pillarId]);
  const trend = useApi(() => metrics.getEnrolmentTrend({ query: { pillar: pillarId } }), [pillarId]);
  const courses = useApi(() => authoring.listCourses(), [pillarId]);
  const log = useApi(() => milestones.listMilestones(), [pillarId]);

  const o = overview.data;
  const tileSkeleton = <Skeleton className="h-7 w-16" />;
  const behind = kpis.data?.filter(k => k.status === 'behind').length ?? 0;
  const attention = courses.data?.filter(c => c.flags.length > 0) ?? [];

  return (
    <div className="space-y-6">
      <PageHead
        title={t('console.home.title', { pillar: t(`pillar.${pillarId}`) })}
        meta={<PillarScope pillarId={pillarId} />}
        actions={<>
          <Button href="/console/milestones?new=1" variant="ghost"><Flag size={17} /> {t('console.milestones.add')}</Button>
          <Button href="/console/courses/new"><Plus size={17} /> {t('console.courses.new')}</Button>
        </>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label={t('console.home.learners')} value={o ? num(o.learners.value) : tileSkeleton} spark={o?.learners.spark}
          delta={o && { value: signed(o.learners.value - o.learners.previous) }} hint={o && t('console.home.thisMonth')} />
        <KpiTile label={t('console.home.enrolments')} value={o ? num(o.enrolments.value) : tileSkeleton} spark={o?.enrolments.spark}
          delta={o && { value: signed((o.enrolments.value - o.enrolments.previous) / (o.enrolments.previous || 1), pct), good: o.enrolments.value >= o.enrolments.previous }}
          hint={o && t('console.home.vsLastMonth')} />
        <KpiTile label={t('console.home.women')} value={o ? pct(o.womenShare.value) : tileSkeleton} spark={o?.womenShare.spark}
          tone={o && o.womenShare.value < o.inclusionMinimum ? 'brand' : undefined}
          hint={o && t('console.home.minimum', { pct: pct(o.inclusionMinimum) })} />
        <KpiTile label={t('console.home.youth')} value={o ? pct(o.youthShare.value) : tileSkeleton} spark={o?.youthShare.spark}
          tone={o && o.youthShare.value < o.inclusionMinimum ? 'brand' : undefined}
          hint={o && t('console.home.minimum', { pct: pct(o.inclusionMinimum) })} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={t('console.home.kpis')} action={<PanelLink href="/console/kpis">{t('ui.viewAll')}</PanelLink>}>
          <Async state={kpis} skeleton={<div className="space-y-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>}
            empty={d => d.length === 0} emptyView={<p className="py-4 text-sm text-muted">{t('console.kpis.none')}</p>}>
            {data => (
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <Legend items={[{ label: t('status.on_track'), tone: 'ok' }, { label: t('status.behind'), tone: 'brand' }, { label: t('console.kpis.expectedNow'), tone: 'brand', marker: true }]} />
                  {behind > 0 && (
                    <span className="text-sm font-semibold text-brand">{t('console.home.behindCount', { n: behind, total: data.length })}</span>
                  )}
                </div>
                <ul className="flex flex-col gap-5">
                  {data.map(k => (
                    <li key={k.id}>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <span className="min-w-0 font-semibold leading-snug">{k.label}</span>
                        <StatusPill status={k.status} className="shrink-0" />
                      </div>
                      <Meter value={k.progress} expected={k.expected / k.target} tone={k.status === 'behind' ? 'brand' : 'ok'}
                        label={`${k.label}: ${num(k.actual)} / ${num(k.target)}`} />
                      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-sm text-muted">
                        <span><span className="font-semibold tabular-nums text-ink">{num(k.actual)}</span> / {num(k.target)}{k.unit ? ` ${k.unit}` : ''}</span>
                        <span className="tabular-nums">{t('console.kpis.expectedValue', { n: num(k.expected) })} · {t('console.kpis.due', { year: k.dueYear })}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Async>
        </Panel>

        <Panel title={t('console.home.enrolmentsByMonth')}>
          <Async state={trend} skeleton={<Skeleton className="h-48" />}>
            {data => (
              <ColumnChart title={t('console.home.enrolmentsByMonth')} height={190}
                data={data.map((d, i) => ({ label: monthLabel(d.month, locale), value: d.value, tone: i === data.length - 1 ? 'brand' : 'subtle' }))} />
            )}
          </Async>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t('console.home.attention')} action={<PanelLink href="/console/courses">{t('nav.courses')}</PanelLink>}>
          <Async state={courses} skeleton={<div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>}>
            {() => attention.length === 0 ? <p className="py-4 text-sm text-muted">{t('console.home.attentionNone')}</p> : (
              <ul className="-mx-2">
                {attention.slice(0, 5).map(c => (
                  <li key={c.id}>
                    <Row href={`/console/courses/${c.id}`}
                      leading={<CourseCover pillarId={c.pillarId} program={c.program} size="sm" className="w-14 shrink-0" />}
                      title={c.title}
                      sub={<span className="inline-flex flex-wrap gap-1.5 pt-0.5">{c.flags.map(f => <Badge key={f} tone={f === 'draft' ? 'neutral' : 'gold'}>{t(`console.flag.${f}`)}</Badge>)}</span>}
                      trailing={<span className="hidden shrink-0 text-sm text-muted tabular-nums sm:block">{t('console.courses.enrolledN', { n: num(c.enrolled) })}</span>} />
                  </li>
                ))}
              </ul>
            )}
          </Async>
        </Panel>

        <Panel title={t('console.home.milestones')} action={<PanelLink href="/console/milestones">{t('ui.viewAll')}</PanelLink>}>
          <Async state={log} skeleton={<div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>}
            empty={d => d.length === 0} emptyView={<p className="py-4 text-sm text-muted">{t('console.milestones.none')}</p>}>
            {data => (
              <ul className="-mx-2">
                {data.slice(0, 4).map(m => (
                  <li key={m.id}>
                    <Row leading={<QuarterChip quarter={m.quarter} />} title={m.title}
                      sub={`${t('console.phase.label', { n: m.phase })} · ${t(`console.phase.${m.phase}`)}`}
                      href="/console/milestones" />
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
