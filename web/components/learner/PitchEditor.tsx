'use client';

// Pitch entry editor and the read-only submitted view with its receipt (SRS FR-A3).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Check, FileText, Lock, Printer, Save, Send, Trash2, UserPlus } from 'lucide-react';
import { Badge, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { Modal, useToast } from '@/components/ui/client';
import { Async, Panel, Skeleton, StatusPill } from '@/components/dash';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { pitch } from '@/lib/api/services';
import type { LearnerPitch, PitchFile, PitchFileKind, PitchRules } from '@/lib/api/services/core/pitch';
import { useI18n } from '@/lib/i18n';
import { cx, date, num, usd, dateLocale, fmtDate } from '@/lib/format';
import { PrintStyles } from './bits';
import { FileDrop } from './FileDrop';

export const SECTORS = ['Agritech', 'Edtech', 'Fintech', 'Health', 'Clean energy', 'E-commerce', 'Creative industries', 'Manufacturing', 'Other'];
export const sectorKey = (s: string) => `learner.pitch.sector.${s.toLowerCase().replace(/[^a-z]+/g, '_')}`;

function useCountdown(closesAt: string) {
  const end = new Date(`${closesAt}T23:59:59Z`).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const ms = Math.max(0, end - now);
  return { closed: ms === 0, d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60 };
}

type Draft = Pick<LearnerPitch, 'businessName' | 'sector' | 'summary' | 'fundingRequested' | 'team'>;
const draftOf = (p: LearnerPitch): Draft => ({ businessName: p.businessName, sector: p.sector, summary: p.summary, fundingRequested: p.fundingRequested, team: p.team });

export function PitchEditor({ initial, rules }: { initial: LearnerPitch; rules: PitchRules }) {
  const { t } = useI18n();
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const [p, setP] = useState<LearnerPitch>(initial);
  const [d, setD] = useState<Draft>(draftOf(initial));
  const [confirm, setConfirm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<'save' | 'submit' | 'delete' | null>(null);
  const cd = useCountdown(p.closesAt);
  const closed = cd.closed || !p.cycleOpen;
  const dirty = JSON.stringify(d) !== JSON.stringify(draftOf(p));

  if (p.status !== 'draft') return <><SubmittedView p={p} />{toastNode}</>;

  const file = (kind: PitchFileKind) => p.files.find(f => f.kind === kind);
  const errors: Record<string, string> = {};
  if (!d.businessName.trim()) errors.businessName = t('learner.pitch.err.name');
  if (!d.sector) errors.sector = t('learner.pitch.err.sector');
  if (d.summary.trim().length < rules.summaryMin) errors.summary = t('learner.pitch.err.summaryShort', { n: rules.summaryMin });
  if (!d.fundingRequested || d.fundingRequested <= 0) errors.funding = t('learner.pitch.err.funding');
  if (d.team.some(m => !m.name.trim())) errors.team = t('learner.pitch.err.team');
  if (!file('business_plan')) errors.plan = t('learner.pitch.err.plan');
  if (!file('pitch_deck')) errors.deck = t('learner.pitch.err.deck');
  if (p.files.some(f => f.scan !== 'clean')) errors.scan = t('learner.pitch.err.scan');
  const err = (k: string) => (showErrors ? errors[k] : undefined);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }));
  const setFile = (f: PitchFile) => setP(x => ({ ...x, files: [...x.files.filter(y => y.kind !== f.kind), f] }));
  const removeFile = (kind: PitchFileKind) => async () => { const next = await pitch.removeFile({ params: { id: p.id, kind } }); setP(x => ({ ...x, files: next.files })); };

  const persist = async () => {
    const next = await pitch.update({ params: { id: p.id }, body: d });
    setP(next);
    setD(draftOf(next));
    return next;
  };
  const saveDraft = async () => {
    setBusy('save');
    try { await persist(); toast(t('learner.pitch.saved')); } catch (e) { toast(errorMessage(e)); } finally { setBusy(null); }
  };
  const trySubmit = () => {
    setShowErrors(true);
    if (Object.keys(errors).length) { toast(t('learner.pitch.needsAttention')); return; }
    setConfirm(true);
  };
  const submit = async () => {
    setBusy('submit');
    try {
      if (dirty) await persist();
      setP(await pitch.submit({ params: { id: p.id } }));
      setConfirm(false);
      toast(t('learner.pitch.submitted'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast(errorMessage(e)); } finally { setBusy(null); }
  };
  const deleteDraft = async () => {
    setBusy('delete');
    try { await pitch.remove({ params: { id: p.id } }); router.push('/app/pitch'); } catch (e) { toast(errorMessage(e)); setBusy(null); }
  };

  const checklist: [string, boolean][] = [
    [t('learner.pitch.check.details'), !!(d.businessName.trim() && d.sector && d.fundingRequested > 0)],
    [t('learner.pitch.check.summary'), d.summary.trim().length >= rules.summaryMin],
    [t('learner.pitch.check.team'), d.team.every(m => m.name.trim())],
    [t('learner.pitch.file.business_plan'), file('business_plan')?.scan === 'clean'],
    [t('learner.pitch.file.pitch_deck'), file('pitch_deck')?.scan === 'clean'],
  ];

  return (
    <>
      <div className={cx('mb-6 flex flex-col gap-3 rounded-[var(--radius-card)] border p-5 sm:flex-row sm:items-center sm:justify-between',
        closed ? 'border-line bg-bg' : 'border-gold/50 bg-bg')}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-brand">{closed ? <Lock size={18} /> : <CalendarClock size={18} />}</span>
          <div>
            <div className="font-bold">{p.cycleName}</div>
            <div className="text-sm text-muted">{closed ? t('learner.pitch.closedOn', { date: date(p.closesAt) }) : t('learner.pitch.closes', { date: date(p.closesAt) })}</div>
          </div>
        </div>
        {!closed && (
          <div className="flex gap-2 font-display" role="timer" aria-label={t('learner.pitch.timeLeft', { d: cd.d, h: cd.h })}>
            {([['days', cd.d], ['hrs', cd.h], ['min', cd.m], ['sec', cd.s]] as const).map(([l, v]) => (
              <div key={l} className="min-w-14 rounded-xl bg-surface px-2 py-1.5 text-center">
                <div className="text-xl font-bold tabular-nums">{String(v).padStart(2, '0')}</div>
                <div className="font-sans text-[11px] text-muted">{t(`learner.pitch.cd.${l}`)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {closed && <p className="mb-6 rounded-2xl border border-line bg-bg p-4 text-muted">{t('learner.pitch.closedText')}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <fieldset disabled={closed} className="min-w-0 space-y-6">
          <Panel title={t('learner.pitch.business')}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('learner.pitch.name')} htmlFor="bn" error={err('businessName')}>
                <Input id="bn" value={d.businessName} onChange={e => set('businessName', e.target.value)} />
              </Field>
              <Field label={t('learner.pitch.sector')} htmlFor="sector" error={err('sector')}>
                <Select id="sector" value={d.sector} onChange={e => set('sector', e.target.value)}>
                  <option value="">{t('learner.pitch.chooseSector')}</option>
                  {SECTORS.map(s => <option key={s} value={s}>{t(sectorKey(s))}</option>)}
                </Select>
              </Field>
              <Field label={t('learner.pitch.funding')} htmlFor="fund" error={err('funding')} hint={t('learner.pitch.fundingHint')}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle">$</span>
                  <Input id="fund" type="number" inputMode="numeric" min={0} step={100} className="pl-8"
                    value={d.fundingRequested || ''} onChange={e => set('fundingRequested', Number(e.target.value))} />
                </div>
              </Field>
            </div>
            <div className="mt-5">
              <Field label={t('learner.pitch.summary')} htmlFor="sum" error={err('summary')}>
                <Textarea id="sum" rows={8} value={d.summary} maxLength={rules.summaryMax} aria-describedby="sum-count"
                  onChange={e => set('summary', e.target.value)} placeholder={t('learner.pitch.summaryPlaceholder')} />
              </Field>
              <div id="sum-count" className="mt-1.5 flex items-center gap-3 text-sm" aria-live="polite">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className={cx('h-full rounded-full transition-[width]', d.summary.length > rules.summaryMax * 0.9 ? 'bg-gold' : 'bg-brand')} style={{ width: `${(d.summary.length / rules.summaryMax) * 100}%` }} />
                </div>
                <span className={cx('tabular-nums', d.summary.length >= rules.summaryMax ? 'font-semibold text-brand' : 'text-muted')}>{num(d.summary.length)} / {num(rules.summaryMax)}</span>
              </div>
            </div>
          </Panel>

          <Panel title={t('learner.pitch.team')}
            action={<Button type="button" size="sm" variant="ghost" disabled={d.team.length >= rules.teamMax}
              onClick={() => set('team', [...d.team, { name: '', role: '' }])}><UserPlus size={16} /> {t('ui.add')}</Button>}>
            <ul className="space-y-3">
              {d.team.map((m, i) => (
                <li key={i} className="grid grid-cols-[1fr_auto] gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Input aria-label={t('learner.pitch.memberName', { n: i + 1 })} placeholder={t('learner.pitch.fullName')} value={m.name}
                    onChange={e => set('team', d.team.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <Input aria-label={t('learner.pitch.memberRole', { n: i + 1 })} placeholder={t('learner.pitch.role')} value={m.role} className="order-3 col-span-2 sm:order-none sm:col-span-1"
                    onChange={e => set('team', d.team.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} />
                  <button type="button" disabled={d.team.length === 1} onClick={() => set('team', d.team.filter((_, j) => j !== i))}
                    aria-label={t('learner.pitch.removeMember', { n: i + 1 })} className="grid size-12 place-items-center rounded-xl border border-line text-muted hover:text-brand disabled:opacity-40">
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
            {err('team') && <p className="mt-2 text-sm text-brand">{err('team')}</p>}
            <p className="mt-3 text-sm text-muted">{t('learner.pitch.teamLimit', { n: d.team.length, max: rules.teamMax })}</p>
          </Panel>

          <Panel title={t('learner.pitch.documents')}>
            <div className="grid gap-5">
              {(['business_plan', 'pitch_deck'] as const).map(kind => (
                <div key={kind}>
                  <FileDrop entryId={p.id} kind={kind} rule={rules.files[kind]} value={file(kind)} onChange={setFile} onRemove={removeFile(kind)} disabled={closed} />
                  {err(kind === 'business_plan' ? 'plan' : 'deck') && <p className="mt-1.5 text-sm text-brand">{err(kind === 'business_plan' ? 'plan' : 'deck')}</p>}
                </div>
              ))}
              {err('scan') && <p className="text-sm text-brand">{err('scan')}</p>}
            </div>
          </Panel>
        </fieldset>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Panel>
            <div className="flex items-center justify-between"><span className="font-bold">{t('ui.status')}</span><StatusPill status={p.status} /></div>
            <p className="mt-1 text-sm text-muted">{dirty ? t('learner.pitch.unsaved') : t('learner.pitch.lastSaved', { date: date(p.updatedAt) })}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {checklist.map(([l, ok]) => (
                <li key={l} className="flex items-center gap-2">
                  <span className={cx('grid size-5 place-items-center rounded-full', ok ? 'bg-ok text-white' : 'border border-line')}>{ok && <Check size={12} strokeWidth={3} />}</span>
                  <span className={ok ? '' : 'text-muted'}>{l}</span>
                  <span className="sr-only">{ok ? t('status.completed') : t('learner.player.notDone')}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-2">
              <Button type="button" variant="ghost" onClick={saveDraft} disabled={closed || !dirty || !!busy}><Save size={18} /> {busy === 'save' ? t('learner.pitch.saving') : t('learner.pitch.saveDraft')}</Button>
              <Button type="button" onClick={trySubmit} disabled={closed || !!busy}><Send size={18} /> {t('learner.pitch.submit')}</Button>
              <Button type="button" variant="link" size="sm" className="justify-self-center" onClick={() => setConfirmDelete(true)} disabled={!!busy}><Trash2 size={15} /> {t('learner.pitch.deleteDraft')}</Button>
            </div>
          </Panel>
          <p className="px-1 text-sm text-muted">{t('learner.pitch.anonymous')}</p>
        </aside>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={t('learner.pitch.confirmTitle')}
        footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>{t('learner.pitch.keepEditing')}</Button><Button onClick={submit} disabled={busy === 'submit'}><Send size={18} /> {busy === 'submit' ? t('learner.pitch.submitting') : t('learner.pitch.confirmSubmit')}</Button></>}>
        <p className="text-muted">{t('learner.pitch.confirmText', { cycle: p.cycleName })}</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-surface p-4 text-sm">
          <dt className="text-muted">{t('learner.pitch.name')}</dt><dd className="font-semibold">{d.businessName}</dd>
          <dt className="text-muted">{t('learner.pitch.fundingShort')}</dt><dd className="font-semibold">{usd(d.fundingRequested)}</dd>
          <dt className="text-muted">{t('learner.pitch.team')}</dt><dd className="font-semibold">{t('learner.pitch.people', { n: d.team.length })}</dd>
          <dt className="text-muted">{t('learner.pitch.documents')}</dt><dd className="font-semibold">{p.files.length}</dd>
        </dl>
      </Modal>
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('learner.pitch.deleteTitle')}
        footer={<><Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t('ui.cancel')}</Button><Button variant="danger" onClick={deleteDraft} disabled={busy === 'delete'}><Trash2 size={16} /> {t('ui.delete')}</Button></>}>
        <p className="text-muted">{t('learner.pitch.deleteText')}</p>
      </Modal>
      {toastNode}
    </>
  );
}

/* ---------- read-only view + receipt ---------- */
function SubmittedView({ p }: { p: LearnerPitch }) {
  const { t } = useI18n();
  const receipt = useApi(() => pitch.receipt({ params: { id: p.id } }), [p.id, p.status]);
  const steps = [
    { label: t('status.submitted'), done: true },
    { label: t('status.under_review'), done: p.status !== 'submitted' },
    { label: t('learner.pitch.resultsOut'), done: ['finalist', 'winner', 'not_selected'].includes(p.status) },
  ];
  return (
    <>
      <PrintStyles />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="no-print min-w-0 space-y-6">
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral"><Lock size={12} /> {t('ui.readOnly')}</Badge>
              <StatusPill status={p.status} />
            </div>
            <ol className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2" aria-label={t('learner.pitch.progress')}>
              {steps.map((s, i) => (
                <li key={s.label} className="flex flex-1 items-center gap-2">
                  <span className={cx('grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold', s.done ? 'bg-ok text-white' : 'bg-surface-2 text-muted')}>{s.done ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                  <span className={cx('text-sm font-semibold', !s.done && 'text-muted')}>{s.label}</span>
                  {i < steps.length - 1 && <span className="hidden h-px flex-1 bg-line sm:block" />}
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-muted">{t('learner.pitch.afterSubmit')}</p>
          </Panel>
          <Panel title={p.businessName}>
            <p className="text-sm text-muted">{t(sectorKey(p.sector))}</p>
            <p className="mt-3 whitespace-pre-line leading-relaxed">{p.summary}</p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-sm text-muted">{t('learner.pitch.fundingShort')}</dt><dd className="font-display text-2xl font-bold">{usd(p.fundingRequested)}</dd></div>
              <div><dt className="text-sm text-muted">{t('learner.pitch.team')}</dt><dd className="mt-1 space-y-0.5">{p.team.map(m => <div key={m.name}><span className="font-semibold">{m.name}</span>{m.role && <span className="text-muted">, {m.role}</span>}</div>)}</dd></div>
            </dl>
            <ul className="mt-6 grid gap-2">
              {p.files.map(f => (
                <li key={f.kind} className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm">
                  <FileText size={16} className="text-brand" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span>
                  <span className="text-muted">{f.sizeMb} MB</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Panel className="print-sheet" title={t('learner.pitch.receipt')} action={<Check size={20} className="text-ok" />}>
            <Async state={receipt} skeleton={<div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-6" />)}</div>}>
              {r => (
                <>
                  <dl className="space-y-3 text-sm">
                    {([
                      [t('learner.pitch.reference'), r.reference],
                      [t('learner.pitch.name'), r.businessName],
                      [t('learner.pitch.competition'), r.cycleName],
                      [t('status.submitted'), fmtDate(new Date(r.submittedAt), { dateStyle: 'medium', timeStyle: 'short' })],
                      [t('learner.pitch.documents'), t('learner.pitch.filesClean', { n: r.files.length })],
                    ] as const).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 border-b border-line pb-3 last:border-0">
                        <dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <Button variant="ghost" size="sm" className="no-print mt-4 w-full" onClick={() => window.print()}><Printer size={16} /> {t('learner.pitch.printReceipt')}</Button>
                </>
              )}
            </Async>
          </Panel>
        </aside>
      </div>
    </>
  );
}
