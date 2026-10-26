'use client';

// One published quarterly report, read-only. Unpublished quarters return 404 from the API.

import { useParams } from 'next/navigation';
import { FileText, Printer } from 'lucide-react';
import { PageHead, SkeletonPanel } from '@/components/dash';
import { Button, EmptyState } from '@/components/ui';
import { ReportView } from '@/components/internal/ReportView';
import { ReadOnlyPill, quarterLabel } from '@/components/admin/kit';
import { useApi } from '@/lib/api/hooks';
import { ApiError } from '@/lib/api/http';
import { reporting } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { date } from '@/lib/format';
import { ErrorState } from '@/components/dash';

export default function BoardReport() {
  const t = useT();
  const { quarter } = useParams<{ quarter: string }>();
  const state = useApi(() => reporting.getReport({ params: { quarter } }), [quarter]);
  const crumbs = [{ href: '/board/reports', label: t('nav.quarterly') }, { label: quarterLabel(quarter) }];
  const notFound = state.error instanceof ApiError && state.error.status === 404;

  if (notFound) {
    return (
      <div>
        <PageHead title={t('board.reports.unavailable')} crumbs={crumbs} meta={<ReadOnlyPill />} />
        <EmptyState icon={<FileText size={22} />} title={t('board.reports.notPublished')} action={<Button href="/board/reports" size="sm">{t('board.reports.back')}</Button>} />
      </div>
    );
  }

  const r = state.data;
  return (
    <div>
      <PageHead title={t('admin.reports.reportFor', { quarter: quarterLabel(quarter) })} crumbs={crumbs}
        meta={<><ReadOnlyPill />{r?.publishedAt && <span>{t('admin.reports.publishedOn', { date: date(r.publishedAt) })}</span>}</>}
        actions={<Button variant="ghost" onClick={() => window.print()} className="print:hidden"><Printer size={16} /> {t('ui.print')}</Button>} />
      {state.error ? <ErrorState error={state.error} onRetry={state.reload} /> : r ? <ReportView report={r} /> : <SkeletonPanel rows={6} />}
    </div>
  );
}
