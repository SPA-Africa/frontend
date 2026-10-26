'use client';

// Executive Office overview. An operations dashboard: KPI row with sparklines, the things that need
// a decision today as compact rows, KPIs grouped by pillar, recent audit activity and unpaid invoices.

import { FileText, Receipt, TrendingDown } from 'lucide-react';
import {
  Async, KpiTile, Meter, PageHead, Panel, PanelLink, PillarTag, Row, Skeleton, SkeletonPanel, StatusPill,
} from '@/components/dash';
import { Avatar, Badge } from '@/components/ui';
import { dateTime, quarterLabel } from '@/components/admin/kit';
import { useApi } from '@/lib/api/hooks';
import { governance, metrics, reporting } from '@/lib/api/services';
import type { KpiWithStatus } from '@/lib/api/services/ai/metrics';
import { useT } from '@/lib/i18n';
import { date, num, pct, rwf } from '@/lib/format';
import type { PillarId } from '@/lib/types';

const PILLARS: PillarId[] = ['technology', 'education', 'leadership', 'young_startups', 'agriculture'];

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted">{children}</span>
);

export default function AdminOverview() {
  const t = useT();
  const summary = useApi(() => reporting.getSummary(), []);
  const kpis = useApi(() => metrics.listKpis({ query: { pillar: 'all' } }), []);
  const pending = useApi(() => governance.listStaffRequests({ query: { status: 'pending_approval' } }), []);
  const reports = useApi(() => reporting.listReports(), []);
  const invoices = useApi(() => governance.listInvoices({ query: { pageSize: 200 } }), []);
  const audit = useApi(() => governance.listAudit({ query: { pageSize: 6 } }), []);

  const headline = kpis.data?.find(k => k.pillarId === 'all');
  const tracked = kpis.data?.filter(k => k.pillarId !== 'all') ?? [];
  const behind = tracked.filter(k => k.status === 'behind');
  const onTrackSpark = tracked.length ? tracked[0].trend.map((_, i) => tracked.filter(k => k.trend[i].actual >= k.trend[i].expected * 0.7).length) : undefined;
  const review = reports.data?.find(r => r.status === 'in_review');
  const overdue = invoices.data?.items.filter(i => i.status === 'overdue') ?? [];
  const unpaid = invoices.data?.items.filter(i => i.balance > 0) ?? [];
  const lastMonth = summary.data?.monthly.at(-1)?.value;
  const pillarLabel = (id: PillarId | 'all') => (id === 'all' ? t('admin.common.allPillars') : t(`pillar.${id}`));

  const attentionLoading = pending.loading || reports.loading || invoices.loading || kpis.loading;
  const attentionCount = (pending.data?.length ?? 0) + (review ? 1 : 0) + overdue.length + behind.length;
  const sk = <Skeleton className="h-7 w-16" />;

  return (
    <div className="space-y-6">
      <PageHead title={t('admin.home.title')} meta={summary.data && <span>{t('admin.common.asOf', { date: date(summary.data.asOf) })}</span>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label={t('admin.home.learners')} value={summary.data ? num(summary.data.totals.learners) : sk}
          spark={summary.data?.monthly.map(m => m.value)}
          delta={lastMonth !== undefined ? { value: `+${num(lastMonth)}` } : undefined} hint={lastMonth !== undefined ? t('admin.home.thisMonth') : undefined} />
        <KpiTile label={t('admin.home.trained')} value={headline ? num(headline.actual) : sk}
          spark={headline?.trend.map(x => x.actual)}
          hint={headline ? t('admin.home.ofTarget', { target: num(headline.target), year: headline.dueYear }) : undefined} />
        <KpiTile label={t('admin.home.kpisOnTrack')} value={kpis.data ? `${tracked.length - behind.length}/${tracked.length}` : sk}
          tone={behind.length ? undefined : 'ok'} spark={onTrackSpark}
          delta={kpis.data && behind.length ? { value: t('admin.home.nBehind', { n: behind.length }), good: false } : undefined} />
        <KpiTile label={t('admin.home.outstanding')} value={invoices.data ? <span className="text-[22px] sm:text-[26px]">{rwf(invoices.data.totals.outstanding)}</span> : sk}
          delta={invoices.data && invoices.data.totals.overdue > 0 ? { value: t('admin.home.overdueAmount', { amount: rwf(invoices.data.totals.overdue) }), good: false } : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={<span className="flex items-center gap-2">{t('admin.home.attention')}{!attentionLoading && attentionCount > 0 && <Badge tone="brand">{attentionCount}</Badge>}</span>}>
          {attentionLoading ? <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
            : attentionCount === 0 ? <p className="py-4 text-sm text-muted">{t('admin.home.nothingToDo')}</p> : (
              <ul className="-mx-2 divide-y divide-line">
                {pending.data?.map(p => (
                  <li key={p.id}>
                    <Row href="/admin/approvals" leading={<Avatar name={p.name} size={40} />} title={p.name}
                      sub={`${t(`role.${p.role}`)}${p.pillarId ? ` · ${t(`pillar.${p.pillarId}`)}` : ''} · ${t('admin.home.requested', { date: date(p.joinedAt) })}`}
                      trailing={<StatusPill status="pending_approval" />} />
                  </li>
                ))}
                {review && (
                  <li>
                    <Row href="/admin/reports" leading={<Chip><FileText size={18} /></Chip>} title={t('admin.home.reportReady', { quarter: quarterLabel(review.quarter) })}
                      sub={t('admin.home.reportReadySub')} trailing={<StatusPill status="in_review" />} />
                  </li>
                )}
                {overdue.map(i => (
                  <li key={i.id}>
                    <Row href="/admin/finance" leading={<Chip><Receipt size={18} /></Chip>} title={`${i.number} · ${i.organisation}`}
                      sub={t('admin.home.dueOn', { date: date(i.dueAt), amount: rwf(i.balance) })} trailing={<StatusPill status="overdue" />} />
                  </li>
                ))}
                {behind.map(k => (
                  <li key={k.id}>
                    <Row href="/admin/reports" leading={<Chip><TrendingDown size={18} /></Chip>} title={k.label}
                      sub={`${pillarLabel(k.pillarId)} · ${t('admin.home.ofExpected', { pct: pct(k.ratio) })}`} trailing={<StatusPill status="behind" />} />
                  </li>
                ))}
              </ul>
            )}
        </Panel>

        <Panel title={t('admin.home.activity')} action={<PanelLink href="/admin/audit">{t('nav.audit')}</PanelLink>}>
          <Async state={audit} skeleton={<div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-10" />)}</div>}
            empty={d => d.items.length === 0} emptyView={<p className="text-sm text-muted">{t('ui.empty')}</p>}>
            {d => (
              <ol className="space-y-4">
                {d.items.map(e => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-line" aria-hidden />
                    <div className="min-w-0">
                      <div><span className="font-semibold">{e.actor === 'system' ? t('admin.common.system') : e.actor}</span> <span className="text-muted">{e.action.toLowerCase()}</span></div>
                      <div className="truncate text-muted">{e.target}</div>
                      <time dateTime={e.at} className="text-xs text-subtle">{dateTime(e.at)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Async>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={t('admin.home.kpisByPillar')} action={<PanelLink href="/admin/reports">{t('nav.reports')}</PanelLink>}>
          <Async state={kpis} skeleton={<div className="space-y-3">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}</div>}>
            {data => (
              <div className="space-y-6">
                {PILLARS.map(pid => {
                  const rows = data.filter(k => k.pillarId === pid);
                  if (rows.length === 0) return null;
                  return (
                    <section key={pid} aria-label={t(`pillar.${pid}`)}>
                      <PillarTag id={pid} label={t(`pillar.${pid}`)} />
                      <ul className="mt-2 space-y-3">{rows.map(k => <KpiLine key={k.id} k={k} />)}</ul>
                    </section>
                  );
                })}
                <p className="flex items-center gap-2 text-xs text-muted"><span className="h-3.5 w-0.5 rounded-full bg-ink" aria-hidden /> {t('admin.common.expectedMarker')}</p>
              </div>
            )}
          </Async>
        </Panel>

        <Panel title={t('admin.home.unpaid')} action={<PanelLink href="/admin/finance">{t('nav.finance')}</PanelLink>}>
          <Async state={invoices} skeleton={<SkeletonPanel rows={3} className="border-0 p-0" />}
            empty={() => unpaid.length === 0} emptyView={<p className="text-sm text-muted">{t('admin.home.allPaid')}</p>}>
            {() => (
              <ul className="-mx-2">
                {unpaid.map(i => (
                  <li key={i.id}>
                    <Row href="/admin/finance" title={i.organisation} sub={`${i.number} · ${t('admin.home.due', { date: date(i.dueAt) })}`}
                      trailing={<span className="flex flex-col items-end gap-1"><span className="text-sm font-semibold tabular-nums">{rwf(i.balance)}</span><StatusPill status={i.status} /></span>} />
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

function KpiLine({ k }: { k: KpiWithStatus }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
      <span className="min-w-0 truncate text-sm">{k.label}</span>
      <span className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-1 sm:col-start-2">
        <Meter value={k.progress} expected={k.expected / k.target} tone={k.status === 'behind' ? 'brand' : 'ok'} label={k.label} />
      </span>
      <span className="text-right text-sm tabular-nums">
        <span className="font-semibold">{num(k.actual)}</span><span className="text-muted"> / {num(k.target)}{k.unit ? ` ${k.unit}` : ''}</span>
      </span>
    </li>
  );
}
