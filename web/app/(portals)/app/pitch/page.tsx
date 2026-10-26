'use client';

// Pitch competitions and the learner's entries.

import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarClock, Plus, Rocket, Users } from 'lucide-react';
import { Button } from '@/components/ui';
import { Async, DataTable, PageHead, Panel, Skeleton, StatusPill, type Column } from '@/components/dash';
import { sectorKey } from '@/components/learner/PitchEditor';
import { useApi } from '@/lib/api/hooks';
import { pitch } from '@/lib/api/services';
import type { LearnerPitch, LearnerPitchStatus } from '@/lib/api/services/core/pitch';
import { useT } from '@/lib/i18n';
import { date, num, usd } from '@/lib/format';

const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(`${iso}T23:59:59Z`).getTime() - Date.now()) / 864e5));
const STATUSES: LearnerPitchStatus[] = ['draft', 'submitted', 'under_review', 'finalist', 'winner', 'not_selected'];

export default function PitchHome() {
  const t = useT();
  const router = useRouter();
  const cycles = useApi(() => pitch.listCycles(), []);
  const mine = useApi(() => pitch.listMine(), []);
  const hasOpen = cycles.data?.some(c => c.status === 'open' && !c.myEntryId);

  const columns: Column<LearnerPitch>[] = [
    { id: 'name', header: t('learner.pitch.name'), value: r => r.businessName || t('learner.pitch.untitled'),
      cell: r => <div className="min-w-0"><div className="font-semibold">{r.businessName || t('learner.pitch.untitled')}</div><div className="text-sm text-muted md:hidden">{r.cycleName}</div></div> },
    { id: 'cycle', header: t('learner.pitch.competition'), value: r => r.cycleName, cell: r => r.cycleName, hideOnMobile: true },
    { id: 'sector', header: t('learner.pitch.sector'), value: r => r.sector, cell: r => (r.sector ? t(sectorKey(r.sector)) : ''), hideOnMobile: true },
    { id: 'funding', header: t('learner.pitch.fundingShort'), align: 'right', value: r => r.fundingRequested, cell: r => (r.fundingRequested ? usd(r.fundingRequested) : ''), hideOnMobile: true },
    { id: 'updated', header: t('learner.pitch.updated'), value: r => r.updatedAt, cell: r => date(r.updatedAt), hideOnMobile: true },
    { id: 'status', header: t('ui.status'), value: r => r.status, cell: r => <StatusPill status={r.status} /> },
  ];

  return (
    <>
      <PageHead title={t('nav.pitch')} actions={hasOpen && <Button href="/app/pitch/new"><Plus size={18} /> {t('learner.pitch.start')}</Button>} />

      <Async state={cycles} skeleton={<div className="grid gap-4 md:grid-cols-2">{[0, 1].map(i => <Skeleton key={i} className="h-56 rounded-[var(--radius-card)]" />)}</div>}
        empty={d => d.length === 0} emptyView={<Panel><p className="py-4 text-center text-muted">{t('learner.pitch.noCycles')}</p></Panel>}>
        {data => (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map(c => (
              <article key={c.id} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-bg p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-light text-brand dark:bg-brand/15"><Rocket size={20} /></span>
                  <StatusPill status={c.status} />
                </div>
                <h2 className="mt-4 text-lg font-bold leading-snug">{c.name}</h2>
                <p className="text-sm text-muted">{c.region}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1.5"><CalendarClock size={16} className="text-brand" />
                    {c.status === 'upcoming' ? t('learner.pitch.opens', { date: date(c.opensAt) }) : t('learner.pitch.closes', { date: date(c.closesAt) })}
                  </span>
                  <span className="inline-flex items-center gap-1.5"><Users size={16} className="text-brand" /> {t('learner.pitch.entries', { n: num(c.entries) })}</span>
                </div>
                {c.status === 'open' && <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold"><span className="size-2 rounded-full bg-gold" aria-hidden />{t('learner.pitch.daysLeft', { n: daysLeft(c.closesAt) })}</p>}
                <div className="mt-auto pt-5">
                  {c.myEntryId
                    ? <Button size="sm" variant="ghost" href={`/app/pitch/${c.myEntryId}`}>{t('learner.pitch.openEntry')} <ArrowRight size={16} /></Button>
                    : c.status === 'open'
                      ? <Button size="sm" href={`/app/pitch/new?cycle=${c.id}`}>{t('learner.pitch.enter')}</Button>
                      : <Button size="sm" variant="ghost" disabled>{c.status === 'upcoming' ? t('learner.pitch.notOpen') : t('learner.pitch.closedShort')}</Button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </Async>

      <h2 className="mb-4 mt-10 text-lg font-bold">{t('learner.pitch.myEntries')}</h2>
      <Async state={mine} skeleton={<Skeleton className="h-48 rounded-[var(--radius-card)]" />}>
        {rows => (
          <DataTable rows={rows} columns={columns} rowKey={r => r.id} caption={t('learner.pitch.myEntries')}
            search={r => `${r.businessName} ${r.cycleName} ${r.code}`} searchPlaceholder={t('learner.pitch.searchEntries')}
            filters={[{ id: 'status', label: t('ui.status'), get: r => r.status, options: STATUSES.map(s => ({ value: s, label: t(`status.${s}`) })) }]}
            exportName="my-pitches" onRowClick={r => router.push(`/app/pitch/${r.id}`)}
            empty={<p className="text-muted">{t('learner.pitch.noEntries')}</p>} />
        )}
      </Async>
    </>
  );
}
