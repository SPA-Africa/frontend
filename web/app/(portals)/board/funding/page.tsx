'use client';

// Funding pipeline by stage and type, with the 60/40 grants and earned income target mix. Read-only.

import { Async, BarList, KpiTile, PageHead, Panel, Skeleton, SkeletonPanel, StackBar } from '@/components/dash';
import { Badge, type Tone } from '@/components/ui';
import { ReadOnlyPill } from '@/components/admin/kit';
import { useApi } from '@/lib/api/hooks';
import { governance } from '@/lib/api/services';
import type { FundingItem, FundingType } from '@/lib/api/services/core/governance';
import { useT } from '@/lib/i18n';
import { num, pct, usd } from '@/lib/format';

const typeTone: Record<FundingType, Tone> = { grant: 'brand', partnership: 'info', earned: 'gold' };
const sum = (xs: FundingItem[]) => xs.reduce((s, f) => s + f.amountUsd, 0);

export default function FundingPipeline() {
  const t = useT();
  const state = useApi(() => governance.listFunding(), []);
  const d = state.data;
  const sk = <Skeleton className="h-7 w-20" />;

  return (
    <div className="space-y-6">
      <PageHead title={t('nav.funding')} meta={<><ReadOnlyPill />{d && <span>{t('board.funding.rate', { rate: num(d.rwfPerUsd) })}</span>}</>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(d?.stages ?? ['prospect', 'proposal', 'committed', 'received']).map(s => {
          const items = d?.items.filter(f => f.stage === s) ?? [];
          return <KpiTile key={s} label={t(`board.funding.stage.${s}`)} value={d ? <span className="text-[22px] sm:text-[28px]">{usd(sum(items))}</span> : sk}
            hint={d ? t('board.funding.items', { n: items.length }) : undefined} />;
        })}
      </div>

      <Async state={state} skeleton={<div className="grid gap-6 lg:grid-cols-2"><SkeletonPanel rows={3} /><SkeletonPanel rows={4} /></div>}>
        {data => {
          const secured = data.items.filter(f => f.stage === 'committed' || f.stage === 'received');
          const grants = sum(secured.filter(f => f.type !== 'earned'));
          const earned = sum(secured.filter(f => f.type === 'earned'));
          const earnedShare = earned / (grants + earned || 1);
          return (
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title={t('board.funding.mix')}>
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">{t('board.funding.secured')}</h3>
                    <StackBar title={t('board.funding.secured')} format={usd} segments={[
                      { label: t('board.funding.grants'), value: grants, tone: 'brand' },
                      { label: t('board.funding.earned'), value: earned, tone: 'gold' },
                    ]} />
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">{t('board.funding.target')}</h3>
                    <StackBar title={t('board.funding.target')} format={pct} segments={[
                      { label: t('board.funding.grants'), value: data.targetMix.grants, tone: 'brand' },
                      { label: t('board.funding.earned'), value: data.targetMix.earned, tone: 'gold' },
                    ]} />
                  </div>
                  <p className="text-sm text-muted">
                    {earnedShare < data.targetMix.earned
                      ? t('board.funding.short', { share: pct(earnedShare), gap: pct(data.targetMix.earned - earnedShare), target: pct(data.targetMix.earned) })
                      : t('board.funding.meets', { share: pct(earnedShare), target: pct(data.targetMix.earned) })}
                  </p>
                </div>
              </Panel>
              <Panel title={t('board.funding.byStage')}>
                <BarList title={t('board.funding.byStage')} format={usd}
                  data={data.stages.map(s => ({ label: t(`board.funding.stage.${s}`), value: sum(data.items.filter(f => f.stage === s)), tone: s === 'received' || s === 'committed' ? 'ok' as const : 'gold' as const }))} />
                <h3 className="mb-3 mt-6 text-sm font-semibold">{t('board.funding.byType')}</h3>
                <BarList title={t('board.funding.byType')} format={usd}
                  data={(['grant', 'partnership', 'earned'] as FundingType[]).map(ty => ({ label: t(`board.funding.type.${ty}`), value: sum(data.items.filter(f => f.type === ty)), tone: ty === 'earned' ? 'gold' as const : ty === 'grant' ? 'brand' as const : 'info' as const }))} />
              </Panel>
            </div>
          );
        }}
      </Async>

      <Async state={state} skeleton={<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <SkeletonPanel key={i} rows={3} />)}</div>}>
        {data => (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {data.stages.map(s => {
              const items = data.items.filter(f => f.stage === s);
              return (
                <Panel key={s} title={t(`board.funding.stage.${s}`)} action={<span className="text-sm font-semibold text-muted tabular-nums">{usd(sum(items))}</span>}>
                  {items.length === 0 ? <p className="text-sm text-subtle">{t('board.funding.empty')}</p> : (
                    <ul className="space-y-2">
                      {items.map(f => (
                        <li key={f.id} className="rounded-xl border border-line p-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold leading-snug">{f.source}</span>
                            <span className="shrink-0 font-display font-bold tabular-nums">{usd(f.amountUsd)}</span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <Badge tone={typeTone[f.type]} className="py-0.5">{t(`board.funding.type.${f.type}`)}</Badge>
                            <span className="text-xs text-muted">{f.note}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              );
            })}
          </div>
        )}
      </Async>
    </div>
  );
}
