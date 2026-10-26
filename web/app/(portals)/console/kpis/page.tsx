'use client';

import { useState } from 'react';
import { Select } from '@/components/ui';
import { Async, BarList, Legend, LineChart, Meter, PageHead, Panel, Skeleton, SkeletonPanel, StatusPill } from '@/components/dash';
import { PillarScope, quarterLabel, useRepPillar } from '@/components/console/ConsoleKit';
import { useApi } from '@/lib/api/hooks';
import { metrics } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { num, pct } from '@/lib/format';

export default function ConsoleKpis() {
  const t = useT();
  const pillarId = useRepPillar();
  const kpis = useApi(() => metrics.listKpis({ query: { pillar: pillarId } }), [pillarId]);
  const [sel, setSel] = useState('');

  return (
    <>
      <PageHead title={t('nav.kpis')} meta={<PillarScope pillarId={pillarId} />} />
      <Async state={kpis} skeleton={<div className="grid gap-5 md:grid-cols-2"><SkeletonPanel rows={2} /><SkeletonPanel rows={2} /></div>}
        empty={d => d.length === 0} emptyView={<Panel><p className="py-6 text-center text-muted">{t('console.kpis.none')}</p></Panel>}>
        {data => {
          const selected = data.find(k => k.id === sel) ?? data[0];
          const behind = data.filter(k => k.status === 'behind');
          const people = data.filter(k => k.womenShare > 0 || k.youthShare > 0);
          return (
            <div className="space-y-6">
              {behind.length > 0 && (
                <p role="status" className="rounded-2xl bg-brand-light px-4 py-3 text-sm text-brand-dark dark:bg-brand/20 dark:text-[#ffb59a]">
                  <span className="font-semibold">{t('console.home.behindCount', { n: behind.length, total: data.length })}.</span> {t('console.kpis.behindRule')}
                </p>
              )}

              <Panel title={t('console.kpis.targets')} action={<Legend items={[{ label: t('status.on_track'), tone: 'ok' }, { label: t('status.behind'), tone: 'brand' }, { label: t('console.kpis.expectedNow'), tone: 'brand', marker: true }]} />}>
                <ul className="grid gap-x-8 gap-y-6 md:grid-cols-2">
                  {data.map(k => (
                    <li key={k.id}>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <span className="min-w-0 font-semibold leading-snug">{k.label}</span>
                        <StatusPill status={k.status} className="shrink-0" />
                      </div>
                      <div className="mb-2 flex items-baseline gap-2">
                        <span className="font-display text-2xl font-bold tabular-nums">{num(k.actual)}</span>
                        <span className="text-sm text-muted">/ {num(k.target)}{k.unit ? ` ${k.unit}` : ''} · {pct(k.progress)}</span>
                      </div>
                      <Meter value={k.progress} expected={k.expected / k.target} tone={k.status === 'behind' ? 'brand' : 'ok'} label={`${k.label}: ${pct(k.progress)}`} />
                      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-sm text-muted">
                        <span className="tabular-nums">{t('console.kpis.expectedValue', { n: num(k.expected) })} · {t('console.kpis.ratio', { pct: pct(k.ratio) })}</span>
                        <span>{t('console.kpis.due', { year: k.dueYear })}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <Panel title={t('console.kpis.trend')}
                  action={<label className="w-48 sm:w-64"><span className="sr-only">{t('console.kpis.kpi')}</span>
                    <Select className="h-10! rounded-full! text-sm" value={selected.id} onChange={e => setSel(e.target.value)}>
                      {data.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </Select></label>}>
                  {selected ? (
                    <LineChart title={`${selected.label}, ${t('console.kpis.cumulative')}`}
                      labels={selected.trend.map(p => quarterLabel(p.quarter))}
                      series={[
                        { name: t('console.kpis.actual'), tone: 'brand', values: selected.trend.map(p => p.actual) },
                        { name: t('console.kpis.expected'), tone: 'gold', dashed: true, values: selected.trend.map(p => p.expected) },
                      ]} />
                  ) : <Skeleton className="h-48" />}
                </Panel>

                <Panel title={t('console.kpis.reach')}>
                  {people.length === 0 ? <p className="text-sm text-muted">{t('console.kpis.noPeople')}</p> : (
                    <div className="flex flex-col gap-6">
                      {people.map(k => (
                        <div key={k.id}>
                          <div className="mb-3 text-sm font-semibold">{k.label}</div>
                          <BarList title={k.label} max={1} format={pct} marker={0.5}
                            data={[{ label: t('console.gender.Female'), value: k.womenShare, tone: 'brand' }, { label: t('console.kpis.youth'), value: k.youthShare, tone: 'gold' }]} />
                        </div>
                      ))}
                      <Legend items={[{ label: t('console.kpis.minimum', { pct: '50%' }), tone: 'brand', marker: true }]} />
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          );
        }}
      </Async>
    </>
  );
}
