'use client';

// Start a pitch: choose an open competition, then the draft is created and opened in the editor.

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button, Field, Select } from '@/components/ui';
import { Async, PageHead, Panel, Skeleton } from '@/components/dash';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { pitch } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { date } from '@/lib/format';

export default function NewPitchPage() {
  return <Suspense fallback={<Skeleton className="h-64" />}><NewPitch /></Suspense>;
}

function NewPitch() {
  const t = useT();
  const router = useRouter();
  const wanted = useSearchParams().get('cycle');
  const cycles = useApi(() => pitch.listCycles(), []);
  const open = cycles.data?.filter(c => c.status === 'open' && !c.myEntryId) ?? [];
  const [cycleId, setCycleId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cycles.data || cycleId) return;
    const existing = cycles.data.find(c => c.id === wanted)?.myEntryId;
    if (existing) { router.replace(`/app/pitch/${existing}`); return; }
    setCycleId(open.find(c => c.id === wanted)?.id ?? open[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycles.data]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleId) return;
    setBusy(true);
    setError(null);
    try {
      const entry = await pitch.create({ body: { cycleId } });
      router.replace(`/app/pitch/${entry.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title={t('learner.pitch.newTitle')} crumbs={[{ href: '/app/pitch', label: t('nav.pitch') }, { label: t('learner.pitch.newTitle') }]} />
      <Async state={cycles} skeleton={<Skeleton className="h-48 max-w-xl rounded-[var(--radius-card)]" />}>
        {() => open.length === 0 ? (
          <Panel className="max-w-xl">
            <p className="text-muted">{t('learner.pitch.noOpen')}</p>
            <Button className="mt-4" variant="ghost" href="/app/pitch">{t('ui.back')}</Button>
          </Panel>
        ) : (
          <Panel className="max-w-xl">
            <form onSubmit={start} className="space-y-5">
              <Field label={t('learner.pitch.competition')} htmlFor="cycle" error={error ?? undefined}>
                <Select id="cycle" value={cycleId} onChange={e => setCycleId(e.target.value)}>
                  {open.map(c => <option key={c.id} value={c.id}>{c.name} ({t('learner.pitch.closes', { date: date(c.closesAt) })})</option>)}
                </Select>
              </Field>
              <Button type="submit" disabled={busy || !cycleId}>{busy ? t('learner.pitch.creating') : t('learner.pitch.createDraft')} <ArrowRight size={18} /></Button>
            </form>
          </Panel>
        )}
      </Async>
    </>
  );
}
