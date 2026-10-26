'use client';

// Ten-year plan: six phases, the outputs each must deliver, and milestone evidence logged so far. Read-only.

import { CheckCircle2, Circle } from 'lucide-react';
import { Async, PageHead, Panel, PillarTag, SkeletonPanel, StatusPill } from '@/components/dash';
import { ReadOnlyPill, quarterLabel } from '@/components/admin/kit';
import { useApi } from '@/lib/api/hooks';
import { reporting } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { cx } from '@/lib/format';

export default function TenYearPlan() {
  const t = useT();
  const summary = useApi(() => reporting.getSummary(), []);

  return (
    <div>
      <PageHead title={t('nav.plan')} meta={<ReadOnlyPill />} />
      <Async state={summary} skeleton={<div className="space-y-4">{[0, 1, 2].map(i => <SkeletonPanel key={i} rows={2} />)}</div>}>
        {d => (
          <ol className="relative space-y-5" aria-label={t('board.plan.phases')}>
            <span className="absolute bottom-6 left-[19px] top-6 w-0.5 bg-line" aria-hidden />
            {d.phases.map(p => {
              const current = p.status === 'current';
              return (
                <li key={p.n} className="relative flex gap-4">
                  <span className={cx('relative z-10 grid size-10 shrink-0 place-items-center rounded-full font-display font-bold',
                    current ? 'bg-brand text-white' : p.status === 'done' ? 'bg-ok text-white' : 'border border-line bg-bg text-muted')}>{p.n}</span>
                  <Panel className={cx('flex-1', current && 'border-brand/40')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="mr-auto text-lg font-bold">{p.name}</h2>
                      <span className="text-sm text-muted">{p.years}</span>
                      <StatusPill status={current ? 'in_progress' : p.status === 'done' ? 'completed' : 'upcoming'} />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold">{t('board.plan.outputsBy', { year: p.by })}</h3>
                    <ul className="mt-2 space-y-1.5">
                      {p.outputs.map(o => (
                        <li key={o} className="flex items-start gap-2 text-[15px]"><Circle size={14} className="mt-1 shrink-0 text-gold" aria-hidden /> {o}</li>
                      ))}
                    </ul>
                    {(current || p.evidence.length > 0) && (
                      <div className="mt-5 border-t border-line pt-4">
                        <h3 className="mb-2 text-sm font-semibold">{t('board.plan.evidence', { n: p.evidence.length })}</h3>
                        {p.evidence.length === 0 ? <p className="text-sm text-subtle">{t('board.plan.noEvidence')}</p> : (
                          <ul className="space-y-3">
                            {p.evidence.map(m => (
                              <li key={m.id} className="flex items-start gap-2 text-sm">
                                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden />
                                <span className="min-w-0">
                                  <span className="font-semibold">{m.title}</span>
                                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-muted">
                                    <PillarTag id={m.pillarId} label={t(`pillar.${m.pillarId}`)} className="text-xs" />
                                    <span>{quarterLabel(m.quarter)}</span>
                                  </span>
                                  <span className="block text-muted">{m.note}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </Panel>
                </li>
              );
            })}
          </ol>
        )}
      </Async>
    </div>
  );
}
