'use client';

import { useState } from 'react';
import { Megaphone, Trophy } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { Async, DataTable, KpiTile, Meter, PageHead, Panel, PillarTag, Skeleton, SkeletonPanel, StatusPill, type Column } from '@/components/dash';
import { ConfirmDialog, FormError } from '@/components/console/ConsoleKit';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { competitions } from '@/lib/api/services';
import type { CycleSummary, GradingProgress, LeaderboardRow } from '@/lib/api/services/core/competitions';
import { useT } from '@/lib/i18n';
import { cx, date, num, pct } from '@/lib/format';

type ProgressRow = GradingProgress['rows'][number];
const stateTone = { complete: 'ok', in_progress: 'gold', not_started: 'neutral' } as const;

export default function ConsoleCompetitions() {
  const t = useT();
  const cycles = useApi(() => competitions.listCycles(), []);
  const [picked, setPicked] = useState<string | null>(null);
  const current = cycles.data?.find(c => c.id === picked) ?? cycles.data?.[0];

  return (
    <>
      <PageHead title={t('nav.competitions')}
        meta={<><PillarTag id="young_startups" label={t('pillar.young_startups')} /><span className="text-muted">{t('console.comp.host')}</span></>} />

      <Async state={cycles} skeleton={<div className="space-y-6"><Skeleton className="h-28" /><SkeletonPanel rows={5} /></div>}
        empty={d => d.length === 0} emptyView={<Panel><p className="py-6 text-center text-muted">{t('console.comp.none')}</p></Panel>}>
        {data => (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label={t('console.comp.cycles')}>
              {data.map(c => {
                const on = c.id === current?.id;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => setPicked(c.id)}
                    className={cx('rounded-[var(--radius-card)] border bg-bg p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                      on ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-brand/40')}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold leading-snug">{c.name}</span>
                      <StatusPill status={c.status} className="shrink-0" />
                    </div>
                    <div className="mt-1 text-sm text-muted">{c.region}</div>
                    <div className="mt-3 flex items-baseline justify-between gap-2 text-sm">
                      <span><span className="font-display text-lg font-bold tabular-nums">{num(c.entries)}</span> <span className="text-muted">{t('console.comp.entries')}</span></span>
                      <span className="text-muted">{date(c.closesAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {current && <CycleDetail key={current.id} cycle={current} onPublished={cycles.reload} />}
          </div>
        )}
      </Async>
    </>
  );
}

function CycleDetail({ cycle, onPublished }: { cycle: CycleSummary; onPublished: () => void }) {
  const t = useT();
  const published = cycle.status === 'published';
  const progress = useApi(() => competitions.getGradingProgress({ params: { id: cycle.id } }), [cycle.id], { enabled: cycle.status === 'judging' });
  const board = useApi(() => competitions.getLeaderboard({ params: { id: cycle.id } }), [cycle.id], { enabled: published });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, toastNode } = useToast();

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      await competitions.publishResults({ params: { id: cycle.id } });
      setConfirm(false);
      toast(t('console.comp.publishedToast'));
      onPublished();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const progressCols: Column<ProgressRow>[] = [
    { id: 'code', header: t('console.comp.code'), value: r => r.code, cell: r => <span className="font-mono text-sm font-semibold">{r.code}</span> },
    { id: 'sector', header: t('console.comp.sector'), value: r => r.sector, cell: r => <span className="text-sm">{r.sector}</span> },
    {
      id: 'judges', header: t('console.comp.judgesScored'), value: r => r.scoresIn,
      cell: r => (
        <span className="flex items-center gap-1.5">
          {Array.from({ length: r.judgesAssigned }, (_, i) => <span key={i} aria-hidden className={cx('size-2.5 rounded-full', i < r.scoresIn ? 'bg-ok' : 'bg-surface-2 ring-1 ring-inset ring-line')} />)}
          <span className="ml-1 text-sm tabular-nums text-muted">{t('console.comp.nOfM', { n: r.scoresIn, m: r.judgesAssigned })}</span>
        </span>
      ),
    },
    { id: 'state', header: t('ui.status'), value: r => r.state, cell: r => <Badge tone={stateTone[r.state]} dot>{t(`console.comp.state.${r.state}`)}</Badge> },
  ];

  const boardCols: Column<LeaderboardRow>[] = [
    { id: 'rank', header: t('console.comp.rank'), value: r => r.rank, cell: r => <span className={cx('grid size-8 place-items-center rounded-full font-display font-bold tabular-nums', r.rank <= 3 ? 'bg-gold-light text-ink dark:bg-gold/25' : 'bg-surface text-muted')}>{r.rank}</span> },
    { id: 'business', header: t('console.comp.business'), value: r => r.businessName, cell: r => <span><span className="block font-semibold">{r.businessName}</span><span className="block font-mono text-xs text-muted">{r.code}</span></span> },
    { id: 'sector', header: t('console.comp.sector'), value: r => r.sector, hideOnMobile: true, cell: r => <span className="text-sm text-muted">{r.sector}</span> },
    { id: 'score', header: t('console.comp.aggregate'), value: r => r.aggregate, align: 'right', cell: r => <span><span className="font-display font-bold tabular-nums">{r.aggregate.toFixed(1)}</span><span className="text-sm text-muted"> / 10</span></span> },
    { id: 'outcome', header: t('console.comp.outcome'), value: r => r.outcome, cell: r => <StatusPill status={r.outcome} /> },
  ];

  if (cycle.status === 'open' || cycle.status === 'upcoming') {
    return (
      <Panel title={cycle.name}>
        <p className="text-muted">{t(cycle.status === 'open' ? 'console.comp.openNote' : 'console.comp.upcomingNote', { opens: date(cycle.opensAt), closes: date(cycle.closesAt) })}</p>
      </Panel>
    );
  }

  if (published) {
    return (
      <>
      <Panel title={<span className="flex items-center gap-2"><Trophy size={18} className="text-gold" aria-hidden /> {t('console.comp.leaderboard')}</span>}
        action={cycle.publishedAt && <span className="text-sm text-muted">{t('console.comp.publishedOn', { date: date(cycle.publishedAt.slice(0, 10)) })}</span>}>
        <Async state={board} skeleton={<SkeletonPanel rows={6} />}>
          {b => <DataTable rows={b.rows} columns={boardCols} rowKey={r => r.code} caption={t('console.comp.leaderboard')}
            search={r => `${r.businessName} ${r.code} ${r.sector}`} exportName={`results-${cycle.id}`} pageSize={10} />}
        </Async>
      </Panel>
      {toastNode}
      </>
    );
  }

  return (
    <>
      <Async state={progress} skeleton={<SkeletonPanel rows={6} />}>
        {p => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[var(--radius-card)] border border-line bg-bg px-5 py-4 sm:col-span-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-muted">{t('console.comp.fullyScored')}</span>
                  <span className="text-sm font-semibold tabular-nums">{pct(p.fullyScored / (p.entries || 1))}</span>
                </div>
                <div className="mt-1.5 font-display text-[28px] font-bold leading-none tabular-nums">{t('console.comp.nOfM', { n: p.fullyScored, m: p.entries })}</div>
                <Meter className="mt-3" value={p.fullyScored / (p.entries || 1)} tone="ok" label={t('console.comp.fullyScored')} />
              </div>
              <KpiTile label={t('console.comp.scoresIn')} value={t('console.comp.nOfM', { n: p.scoresIn, m: p.scoresNeeded })} hint={t('console.comp.perEntry', { n: p.judgesPerEntry })} />
            </div>

            <Panel title={cycle.name} flush
              action={<Button size="sm" onClick={() => setConfirm(true)}><Megaphone size={15} /> {t('console.comp.publish')}</Button>}>
              <p className="px-5 pb-4 text-sm text-muted">{t('console.comp.hidden')}</p>
              <div className="border-t border-line [&>div]:rounded-none [&>div]:border-0">
                <DataTable rows={p.rows} columns={progressCols} rowKey={r => r.code} caption={t('console.comp.progress')}
                  search={r => `${r.code} ${r.sector}`}
                  filters={[{ id: 'state', label: t('ui.status'), get: r => r.state, options: (['complete', 'in_progress', 'not_started'] as const).map(s => ({ value: s, label: t(`console.comp.state.${s}`) })) }]} />
              </div>
            </Panel>

            <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} busy={busy} title={t('console.comp.publishTitle')} confirmLabel={t('console.comp.publish')} onConfirm={publish}>
              <p>{t('console.comp.publishBody', { n: p.entries })}</p>
              {p.fullyScored < p.entries && (
                <p className="mt-3 rounded-xl bg-gold-light p-3 text-sm text-ink dark:bg-gold/15">{t('console.comp.incomplete', { n: p.entries - p.fullyScored })}</p>
              )}
              <div className="mt-3"><FormError message={error} /></div>
            </ConfirmDialog>
          </div>
        )}
      </Async>
      {toastNode}
    </>
  );
}
