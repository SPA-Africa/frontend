'use client';

import { useState } from 'react';
import { Avatar, Button, Select } from '@/components/ui';
import { Async, DataTable, Meter, PageHead, Panel, Skeleton, SkeletonPanel, StackBar, StatusPill, type Column } from '@/components/dash';
import { PillarScope, useRepPillar } from '@/components/console/ConsoleKit';
import { ShareMeter } from '@/components/console/bits';
import { useApi } from '@/lib/api/hooks';
import { authoring, learners } from '@/lib/api/services';
import type { AgeBand, Gender, LearnerQuery, PillarLearner } from '@/lib/api/services/core/learners';
import { useT } from '@/lib/i18n';
import type { EnrollmentStatus } from '@/lib/types';
import { pct } from '@/lib/format';

const GENDERS: Gender[] = ['Female', 'Male'];
const AGES: AgeBand[] = ['15 to 24', '25 to 35', '36 and over'];
const STATUSES: EnrollmentStatus[] = ['enrolled', 'in_progress', 'completed', 'dropped'];
const PAGE = 50;

export default function ConsoleLearners() {
  const t = useT();
  const pillarId = useRepPillar();
  const [filters, setFilters] = useState<Pick<LearnerQuery, 'courseId' | 'gender' | 'ageBand' | 'status'>>({});
  const [size, setSize] = useState(PAGE);
  const list = useApi(() => learners.listLearners({ query: { ...filters, pageSize: size } }), [pillarId, filters, size]);
  const courses = useApi(() => authoring.listCourses(), [pillarId]);

  const setFilter = (k: keyof typeof filters, v: string) => { setSize(PAGE); setFilters(f => ({ ...f, [k]: v || undefined })); };
  const s = list.data?.summary;
  const anyFilter = Object.values(filters).some(Boolean);

  const columns: Column<PillarLearner>[] = [
    { id: 'name', header: t('ui.name'), value: r => r.name, cell: r => <span className="flex items-center gap-3"><Avatar name={r.name} size={32} /><span className="font-semibold">{r.name}</span></span> },
    { id: 'country', header: t('console.learners.country'), value: r => r.country, hideOnMobile: true, cell: r => <span className="text-sm">{r.country}</span> },
    { id: 'gender', header: t('console.learners.gender'), value: r => r.gender, hideOnMobile: true, cell: r => <span className="text-sm">{t(`console.gender.${r.gender}`)}</span> },
    { id: 'age', header: t('console.learners.age'), value: r => r.ageBand, hideOnMobile: true, cell: r => <span className="whitespace-nowrap text-sm">{t(`console.age.${r.ageBand}`)}</span> },
    { id: 'course', header: t('console.courses.course'), value: r => r.courseTitle, hideOnMobile: true, cell: r => <span className="text-sm text-muted">{r.courseTitle}</span> },
    {
      id: 'progress', header: t('console.learners.progress'), value: r => Math.round(r.progress * 100),
      cell: r => <span className="flex w-28 items-center gap-2"><Meter value={r.progress} tone={r.progress === 1 ? 'ok' : 'brand'} label={`${r.name}: ${pct(r.progress)}`} /><span className="w-10 shrink-0 text-right text-sm tabular-nums">{pct(r.progress)}</span></span>,
    },
    { id: 'status', header: t('ui.status'), value: r => r.status, cell: r => <StatusPill status={r.status} /> },
  ];

  const selectCls = 'h-10! min-w-[150px] rounded-full! text-sm';
  const toolbar = (
    <>
      <label><span className="sr-only">{t('console.courses.course')}</span>
        <Select className={selectCls} value={filters.courseId ?? ''} onChange={e => setFilter('courseId', e.target.value)}>
          <option value="">{t('console.learners.allCourses')}</option>
          {courses.data?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
      </label>
      <label><span className="sr-only">{t('console.learners.gender')}</span>
        <Select className={selectCls} value={filters.gender ?? ''} onChange={e => setFilter('gender', e.target.value)}>
          <option value="">{t('console.learners.gender')}: {t('ui.all')}</option>
          {GENDERS.map(g => <option key={g} value={g}>{t(`console.gender.${g}`)}</option>)}
        </Select>
      </label>
      <label><span className="sr-only">{t('console.learners.age')}</span>
        <Select className={selectCls} value={filters.ageBand ?? ''} onChange={e => setFilter('ageBand', e.target.value)}>
          <option value="">{t('console.learners.age')}: {t('ui.all')}</option>
          {AGES.map(a => <option key={a} value={a}>{t(`console.age.${a}`)}</option>)}
        </Select>
      </label>
      <label><span className="sr-only">{t('ui.status')}</span>
        <Select className={selectCls} value={filters.status ?? ''} onChange={e => setFilter('status', e.target.value)}>
          <option value="">{t('ui.status')}: {t('ui.all')}</option>
          {STATUSES.map(st => <option key={st} value={st}>{t(`status.${st}`)}</option>)}
        </Select>
      </label>
      {anyFilter && <Button variant="link" size="sm" onClick={() => { setSize(PAGE); setFilters({}); }}>{t('ui.clearFilters')}</Button>}
    </>
  );

  return (
    <>
      <PageHead title={t('nav.learners')} meta={<PillarScope pillarId={pillarId} />} />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Panel>
          {s ? <ShareMeter label={t('console.home.women')} value={s.womenShare} minimum={s.minimumShare} tone="brand"
            status={s.womenShare >= s.minimumShare ? t('console.learners.meets', { pct: pct(s.minimumShare) }) : t('console.learners.below', { pct: pct(s.minimumShare) })} /> : <Skeleton className="h-16" />}
        </Panel>
        <Panel>
          {s ? <ShareMeter label={t('console.home.youth')} value={s.youthShare} minimum={s.minimumShare} tone="gold"
            status={s.youthShare >= s.minimumShare ? t('console.learners.meets', { pct: pct(s.minimumShare) }) : t('console.learners.below', { pct: pct(s.minimumShare) })} /> : <Skeleton className="h-16" />}
        </Panel>
        <Panel>
          {s ? (
            <>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted">{t('console.courses.completion')}</span>
                <span className="font-display text-[26px] font-bold leading-none tabular-nums">{pct(s.completionRate)}</span>
              </div>
              <StackBar title={t('console.learners.byStatus')} segments={[
                { label: t('status.completed'), value: s.byStatus.completed, tone: 'ok' },
                { label: t('status.in_progress'), value: s.byStatus.in_progress + s.byStatus.enrolled, tone: 'info' },
                { label: t('status.dropped'), value: s.byStatus.dropped, tone: 'subtle' },
              ]} />
            </>
          ) : <Skeleton className="h-16" />}
        </Panel>
      </div>
      {anyFilter && s && <p className="-mt-3 mb-4 text-sm text-muted" aria-live="polite">{t('console.learners.filtered', { n: s.total })}</p>}

      <Async state={list} skeleton={<SkeletonPanel rows={6} />}>
        {page => (
          <>
            <DataTable rows={page.items} columns={columns} rowKey={r => `${r.id}-${r.courseId}`} caption={t('nav.learners')}
              search={r => `${r.name} ${r.country}`} searchPlaceholder={t('console.learners.search')}
              toolbar={toolbar} exportName={`learners-${pillarId}`}
              empty={<p className="text-muted">{t('console.learners.none')}</p>} />
            {page.total > page.items.length && (
              <div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted">
                {t('console.learners.loaded', { n: page.items.length, total: page.total })}
                <Button variant="ghost" size="sm" onClick={() => setSize(x => x + PAGE)} disabled={list.loading}>{t('console.learners.loadMore')}</Button>
              </div>
            )}
          </>
        )}
      </Async>
    </>
  );
}
