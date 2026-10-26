'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { Async, CourseCover, DataTable, PageHead, SkeletonPanel, StatusPill, type Column } from '@/components/dash';
import { PillarScope, useRepPillar } from '@/components/console/ConsoleKit';
import { useApi } from '@/lib/api/hooks';
import { authoring } from '@/lib/api/services';
import type { AuthoringCourseRow } from '@/lib/api/services/core/authoring';
import { useT } from '@/lib/i18n';
import { date, num, pct } from '@/lib/format';

export default function ConsoleCourses() {
  const t = useT();
  const router = useRouter();
  const pillarId = useRepPillar();
  const courses = useApi(() => authoring.listCourses(), [pillarId]);

  const columns: Column<AuthoringCourseRow>[] = [
    {
      id: 'title', header: t('console.courses.course'), value: r => r.title,
      cell: r => (
        <span className="flex min-w-56 items-center gap-3">
          <CourseCover pillarId={r.pillarId} program={r.program} size="sm" className="w-14 shrink-0" />
          <span className="min-w-0">
            <Link href={`/console/courses/${r.id}`} className="block font-semibold leading-snug hover:text-brand">{r.title}</Link>
            <span className="block text-sm text-muted">{t(`console.level.${r.level}`)} · {r.hours} h</span>
          </span>
        </span>
      ),
    },
    { id: 'program', header: t('console.courses.programme'), value: r => r.program, hideOnMobile: true, cell: r => <span className="text-sm text-muted">{r.program}</span> },
    { id: 'status', header: t('ui.status'), value: r => (r.published ? 'published' : 'draft'), cell: r => <StatusPill status={r.published ? 'published' : 'draft'} /> },
    { id: 'lessons', header: t('console.courses.lessons'), value: r => r.lessons, align: 'right', hideOnMobile: true, cell: r => num(r.lessons) },
    { id: 'quizzes', header: t('console.courses.quizzes'), value: r => r.quizzes, align: 'right', hideOnMobile: true, cell: r => num(r.quizzes) },
    { id: 'enrolled', header: t('console.courses.enrolled'), value: r => r.enrolled, align: 'right', cell: r => num(r.enrolled) },
    { id: 'completion', header: t('console.courses.completion'), value: r => Math.round(r.completionRate * 100), align: 'right', hideOnMobile: true, cell: r => (r.enrolled ? pct(r.completionRate) : <span className="text-subtle">0%</span>) },
    { id: 'updated', header: t('console.courses.updated'), value: r => r.updatedAt, hideOnMobile: true, cell: r => <span className="whitespace-nowrap text-sm text-muted">{date(r.updatedAt.slice(0, 10))}</span> },
  ];

  return (
    <>
      <PageHead title={t('nav.courses')} meta={<PillarScope pillarId={pillarId} />}
        actions={<Button href="/console/courses/new"><Plus size={17} /> {t('console.courses.new')}</Button>} />
      <Async state={courses} skeleton={<SkeletonPanel rows={5} />}>
        {rows => (
          <DataTable rows={rows} columns={columns} rowKey={r => r.id} caption={t('nav.courses')}
            search={r => `${r.title} ${r.program}`} searchPlaceholder={t('console.courses.search')}
            filters={[
              { id: 'status', label: t('ui.status'), get: r => (r.published ? 'published' : 'draft'), options: [{ value: 'published', label: t('status.published') }, { value: 'draft', label: t('status.draft') }] },
              { id: 'level', label: t('console.courses.level'), get: r => r.level, options: ['Beginner', 'Intermediate', 'Advanced'].map(l => ({ value: l, label: t(`console.level.${l}`) })) },
            ]}
            exportName={`courses-${pillarId}`}
            onRowClick={r => router.push(`/console/courses/${r.id}`)}
            empty={<div className="py-4"><p className="font-semibold">{t('console.courses.none')}</p><Button href="/console/courses/new" size="sm" className="mt-3">{t('console.courses.new')}</Button></div>} />
        )}
      </Async>
    </>
  );
}
