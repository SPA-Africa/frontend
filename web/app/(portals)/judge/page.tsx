'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui';
import { Tabs, useToast } from '@/components/ui/client';
import { Async, KpiTile, PageHead, Panel, Skeleton, StatusPill } from '@/components/dash';
import { useApi } from '@/lib/api/hooks';
import { judging } from '@/lib/api/services';
import type { QueueStatus } from '@/lib/api/services/core/judging';
import { useT } from '@/lib/i18n';
import { date, usd } from '@/lib/format';

type Tab = 'open' | 'submitted' | 'all';
const actionKey: Record<QueueStatus, string> = { pending: 'judge.queue.start', in_progress: 'judge.queue.continue', submitted: 'judge.queue.view' };

function Queue() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const queue = useApi(() => judging.listQueue(), []);
  const [tab, setTab] = useState<Tab>('open');
  const { toast, toastNode } = useToast();

  useEffect(() => {
    const r = params.get('recused');
    const s = params.get('submitted');
    if (r) toast(t('judge.queue.recusedToast', { code: r }));
    if (s) toast(t('judge.queue.submittedToast', { code: s }));
    if (r || s) router.replace('/judge');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const items = queue.data ?? [];
  const n = (s: QueueStatus) => items.filter(e => e.status === s).length;
  const open = items.filter(e => e.status !== 'submitted');
  const shown = tab === 'all' ? items : tab === 'open' ? open : items.filter(e => e.status === 'submitted');
  const sk = <Skeleton className="h-7 w-10" />;

  return (
    <div className="space-y-6">
      <PageHead title={t('judge.queue.title')} meta={<span className="inline-flex items-center gap-1.5"><EyeOff size={14} aria-hidden /> {t('judge.blind')}</span>} />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <KpiTile label={t('status.pending')} value={queue.data ? n('pending') : sk} />
        <KpiTile label={t('status.in_progress')} value={queue.data ? n('in_progress') : sk} />
        <KpiTile label={t('status.submitted')} value={queue.data ? n('submitted') : sk} tone={queue.data && open.length === 0 ? 'ok' : undefined} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'open', label: t('judge.queue.todo'), count: open.length },
        { id: 'submitted', label: t('status.submitted'), count: n('submitted') },
        { id: 'all', label: t('ui.all'), count: items.length },
      ]} />

      <Async state={queue} skeleton={<div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-32 rounded-[var(--radius-card)]" />)}</div>}>
        {() => shown.length === 0 ? (
          <Panel><p className="py-6 text-center text-muted">{tab === 'open' ? t('judge.queue.allDone') : t('judge.queue.none')}</p></Panel>
        ) : (
          <ul className="flex flex-col gap-3">
            {shown.map(e => (
              <li key={e.code}>
                <Panel bodyClassName="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{e.code}</span>
                      <StatusPill status={e.status} />
                      <Badge tone="info">{e.sector}</Badge>
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed">{e.summary}</p>
                    <div className="mt-1 text-sm text-muted">{e.cycleName} · {t('judge.requesting', { amount: usd(e.fundingRequested) })}{e.status !== 'submitted' && e.dueAt ? ` · ${t('judge.queue.due', { date: date(e.dueAt) })}` : ''}</div>
                  </div>
                  <Link href={`/judge/${e.code}`}
                    className={e.status === 'submitted'
                      ? 'inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:bg-surface md:self-center'
                      : 'inline-flex shrink-0 items-center gap-1 self-start rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark md:self-center'}>
                    {t(actionKey[e.status])} <ArrowRight size={15} aria-hidden /><span className="sr-only">, {e.code}</span>
                  </Link>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </Async>
      {toastNode}
    </div>
  );
}

export default function JudgeQueue() {
  return <Suspense fallback={<Skeleton className="h-40" />}><Queue /></Suspense>;
}
