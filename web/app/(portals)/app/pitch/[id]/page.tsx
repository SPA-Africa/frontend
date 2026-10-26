'use client';

import { useParams } from 'next/navigation';
import { Button } from '@/components/ui';
import { ErrorState, PageHead, Panel, Skeleton } from '@/components/dash';
import { PitchEditor } from '@/components/learner/PitchEditor';
import { ApiError } from '@/lib/api/http';
import { useApi } from '@/lib/api/hooks';
import { pitch } from '@/lib/api/services';
import { useT } from '@/lib/i18n';

export default function PitchPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const entry = useApi(() => pitch.get({ params: { id } }), [id]);
  const rules = useApi(() => pitch.getRules(), []);
  const crumbs = [{ href: '/app/pitch', label: t('nav.pitch') }];
  const error = entry.error ?? rules.error;

  if (error) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <>
        <PageHead title={missing ? t('learner.pitch.notFound') : t('nav.pitch')} crumbs={crumbs} />
        {missing
          ? <Panel><div className="py-6 text-center"><Button href="/app/pitch">{t('ui.back')}</Button></div></Panel>
          : <ErrorState error={error} onRetry={() => { entry.reload(); rules.reload(); }} />}
      </>
    );
  }
  if (!entry.data || !rules.data) {
    return <><Skeleton className="mb-3 h-4 w-32" /><Skeleton className="mb-8 h-9 w-1/2" /><Skeleton className="h-96 rounded-[var(--radius-card)]" /></>;
  }
  const p = entry.data;
  return (
    <>
      <PageHead title={p.businessName || t('learner.pitch.untitled')} crumbs={[...crumbs, { label: p.code }]}
        meta={<span>{t('learner.pitch.referenceIs', { code: p.code })}</span>} />
      <PitchEditor key={p.id} initial={p} rules={rules.data} />
    </>
  );
}
