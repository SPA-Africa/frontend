'use client';

// Render an ApiState with consistent loading, error and empty states.
//   <Async state={courses} skeleton={<SkeletonPanel />} empty={d => d.length === 0} emptyView={...}>
//     {data => <CourseList items={data} />}
//   </Async>

import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { errorMessage, type ApiState } from '@/lib/api/hooks';
import { useT } from '@/lib/i18n';
import { SkeletonPanel } from './primitives';

export function ErrorState({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const t = useT();
  return (
    <div role="alert" className={compact ? 'flex items-center gap-3 rounded-xl bg-brand/5 p-3 text-sm' : 'flex flex-col items-center rounded-[var(--radius-card)] border border-line bg-bg px-6 py-12 text-center'}>
      <AlertCircle size={compact ? 18 : 28} className="shrink-0 text-brand" />
      <div className={compact ? 'flex-1' : 'mt-3'}>
        <div className="font-semibold">{t('ui.errorTitle')}</div>
        <div className="text-sm text-muted">{errorMessage(error)}</div>
      </div>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className={compact ? '' : 'mt-4'}><RotateCw size={15} /> {t('ui.retry')}</Button>
      )}
    </div>
  );
}

export function Async<T>({ state, children, skeleton, empty, emptyView }: {
  state: ApiState<T>;
  children: (data: T) => React.ReactNode;
  skeleton?: React.ReactNode;
  empty?: (data: T) => boolean;
  emptyView?: React.ReactNode;
}) {
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (state.loading && state.data === undefined) return <>{skeleton ?? <SkeletonPanel />}</>;
  if (state.data === undefined) return null;
  if (empty?.(state.data)) return <>{emptyView ?? null}</>;
  return <>{children(state.data)}</>;
}
