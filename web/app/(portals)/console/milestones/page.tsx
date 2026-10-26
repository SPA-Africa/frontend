'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Badge, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { Modal, useToast } from '@/components/ui/client';
import { Async, PageHead, Panel, SkeletonPanel } from '@/components/dash';
import { CURRENT_QUARTER, FormError, PillarScope, quarterLabel, useRepPillar } from '@/components/console/ConsoleKit';
import { QuarterChip } from '@/components/console/bits';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { milestones } from '@/lib/api/services';
import type { MilestoneRecord, Phase } from '@/lib/api/services/core/milestones';
import { useT } from '@/lib/i18n';
import { date } from '@/lib/format';

const PHASES: Phase[] = [1, 2, 3, 4, 5, 6];
const blank = () => ({ title: '', phase: '1', quarter: CURRENT_QUARTER, note: '' });

function MilestoneLog() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const pillarId = useRepPillar();
  const log = useApi(() => milestones.listMilestones(), [pillarId]);
  const [phase, setPhase] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();

  useEffect(() => {
    if (params.get('new')) { setOpen(true); router.replace('/console/milestones'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const groups = useMemo(() => {
    const map = new Map<string, MilestoneRecord[]>();
    (log.data ?? []).filter(m => !phase || m.phase === Number(phase)).forEach(m => map.set(m.quarter, [...(map.get(m.quarter) ?? []), m]));
    return [...map.entries()];
  }, [log.data, phase]);

  const save = async () => {
    setError(null);
    if (form.title.trim().length < 5) { setError(t('console.milestones.titleShort')); return; }
    setBusy(true);
    try {
      const rec = await milestones.createMilestone({ body: { title: form.title, phase: Number(form.phase) as Phase, quarter: form.quarter, note: form.note } });
      log.setData(d => [rec, ...(d ?? [])].sort((a, b) => b.quarter.localeCompare(a.quarter)));
      setOpen(false);
      setForm(blank());
      toast(t('console.milestones.logged'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title={t('nav.milestones')} meta={<PillarScope pillarId={pillarId} />}
        actions={<Button onClick={() => setOpen(true)}><Plus size={17} /> {t('console.milestones.add')}</Button>} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="w-full sm:w-64"><span className="sr-only">{t('console.milestones.phase')}</span>
          <Select className="h-10! rounded-full! text-sm" value={phase} onChange={e => setPhase(e.target.value)}>
            <option value="">{t('console.milestones.phase')}: {t('ui.all')}</option>
            {PHASES.map(p => <option key={p} value={p}>{t('console.phase.label', { n: p })} · {t(`console.phase.${p}`)}</option>)}
          </Select>
        </label>
        {log.data && <span className="text-sm text-muted">{t('console.milestones.count', { n: log.data.length })}</span>}
      </div>

      <Async state={log} skeleton={<SkeletonPanel rows={4} />} empty={() => groups.length === 0}
        emptyView={<Panel><div className="py-8 text-center"><p className="font-semibold">{t('console.milestones.none')}</p><Button size="sm" className="mt-3" onClick={() => setOpen(true)}>{t('console.milestones.add')}</Button></div></Panel>}>
        {() => (
          <div className="flex flex-col gap-5">
            {groups.map(([quarter, list]) => (
              <Panel key={quarter} title={<span className="flex items-center gap-2">{quarterLabel(quarter)}{quarter === CURRENT_QUARTER && <Badge tone="gold">{t('console.milestones.current')}</Badge>}</span>}
                action={<span className="text-sm text-muted">{t('console.milestones.count', { n: list.length })}</span>}>
                <ul className="divide-y divide-line">
                  {list.map(m => (
                    <li key={m.id} className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
                      <QuarterChip quarter={m.quarter} current={quarter === CURRENT_QUARTER} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-snug">{m.title}</div>
                        {m.note && <p className="mt-0.5 text-sm text-muted">{m.note}</p>}
                        {m.loggedAt && <p className="mt-1 text-xs text-subtle">{t('console.milestones.loggedBy', { name: m.loggedBy ?? '', date: date(m.loggedAt.slice(0, 10)) })}</p>}
                      </div>
                      <Badge tone="info" className="shrink-0 self-start">{t('console.phase.label', { n: m.phase })} · {t(`console.phase.${m.phase}`)}</Badge>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        )}
      </Async>

      <Modal open={open} onClose={() => setOpen(false)} title={t('console.milestones.add')}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>{t('ui.cancel')}</Button><Button onClick={save} disabled={busy}>{t('ui.save')}</Button></>}>
        <div className="flex flex-col gap-5">
          <Field label={t('console.milestones.title')} htmlFor="ms-title">
            <Input id="ms-title" value={form.title} maxLength={160} onChange={e => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('console.milestones.phase')} htmlFor="ms-phase">
              <Select id="ms-phase" value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
                {PHASES.map(p => <option key={p} value={p}>{t('console.phase.label', { n: p })} · {t(`console.phase.${p}`)}</option>)}
              </Select>
            </Field>
            <Field label={t('console.milestones.quarter')} htmlFor="ms-quarter">
              <Select id="ms-quarter" value={form.quarter} onChange={e => setForm({ ...form, quarter: e.target.value })}>
                {milestones.loggableQuarters(CURRENT_QUARTER).map(q => <option key={q} value={q}>{quarterLabel(q)}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={t('console.milestones.note')} htmlFor="ms-note" optional>
            <Textarea id="ms-note" value={form.note} maxLength={1000} onChange={e => setForm({ ...form, note: e.target.value })} />
          </Field>
          <FormError message={error} />
        </div>
      </Modal>
      {toastNode}
    </>
  );
}

export default function MilestonesPage() {
  return <Suspense fallback={<SkeletonPanel rows={4} />}><MilestoneLog /></Suspense>;
}
