'use client';

import Link from 'next/link';
import { Badge, Button } from '@/components/ui';
import { Async, KpiTile, PageHead, Panel, Skeleton } from '@/components/dash';
import { useApi } from '@/lib/api/hooks';
import { judging } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { date } from '@/lib/format';

export default function JudgeHistory() {
  const t = useT();
  const scores = useApi(() => judging.listMyScores(), []);
  const cycleId = scores.data?.[0]?.cycleId;
  const rubric = useApi(() => judging.getRubric({ params: { cycleId: cycleId! } }), [cycleId], { enabled: !!cycleId });
  const label = (id: string) => rubric.data?.find(r => r.id === id)?.label ?? id;

  const list = scores.data ?? [];
  const avg = list.length ? list.reduce((s, x) => s + x.weighted, 0) / list.length : 0;
  const withPeers = list.filter(x => x.peerAverage !== null);
  const gap = withPeers.length ? withPeers.reduce((s, x) => s + (x.weighted - (x.peerAverage ?? 0)), 0) / withPeers.length : 0;
  const sk = <Skeleton className="h-7 w-12" />;

  return (
    <div className="space-y-6">
      <PageHead title={t('judge.history.title')} />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <KpiTile label={t('judge.history.count')} value={scores.data ? list.length : sk} />
        <KpiTile label={t('judge.history.average')} value={scores.data ? avg.toFixed(1) : sk} />
        <KpiTile label={t('judge.history.gap')} value={scores.data ? `${gap >= 0 ? '+' : '-'}${Math.abs(gap).toFixed(1)}` : sk} />
      </div>

      <Async state={scores} skeleton={<div className="space-y-3">{[0, 1].map(i => <Skeleton key={i} className="h-44 rounded-[var(--radius-card)]" />)}</div>}
        empty={d => d.length === 0}
        emptyView={<Panel><div className="py-8 text-center"><p className="text-muted">{t('judge.history.none')}</p><Button href="/judge" size="sm" className="mt-3">{t('judge.queue.title')}</Button></div></Panel>}>
        {data => (
          <ul className="flex flex-col gap-4">
            {data.map(h => (
              <li key={h.code}>
                <Panel>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/judge/${h.code}`} className="font-mono text-sm font-semibold hover:text-brand">{h.code}</Link>
                        <Badge tone="info">{h.sector}</Badge>
                        <span className="text-sm text-muted">{h.cycleName} · {date(h.submittedAt.slice(0, 10))}</span>
                      </div>
                      <p className="mt-3 text-[15px] leading-relaxed">{h.comment}</p>
                    </div>
                    <dl className="flex shrink-0 gap-3 sm:flex-col sm:text-right">
                      <div className="rounded-xl bg-surface px-4 py-2"><dt className="text-xs text-muted">{t('judge.yourScore')}</dt><dd className="font-display text-2xl font-bold tabular-nums">{h.weighted.toFixed(1)}</dd></div>
                      {h.peerAverage !== null && <div className="rounded-xl bg-surface px-4 py-2"><dt className="text-xs text-muted">{t('judge.peers')}</dt><dd className="font-display text-2xl font-bold tabular-nums">{h.peerAverage.toFixed(1)}</dd></div>}
                    </dl>
                  </div>
                  <ul className="mt-4 flex flex-wrap gap-2 text-sm" aria-label={t('judge.rubric')}>
                    {Object.entries(h.scores).map(([id, v]) => (
                      <li key={id} className="rounded-full bg-surface px-3 py-1"><span className="text-muted">{label(id)}</span> <span className="font-bold tabular-nums">{v}</span></li>
                    ))}
                  </ul>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </div>
  );
}
