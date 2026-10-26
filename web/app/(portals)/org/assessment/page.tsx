'use client';

// Needs assessment (FR-C3). Questions come from core-svc so they can be configured;
// scoring and recommendations come from ai-svc.

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { Async, ErrorState, Legend, Meter, PageHead, Panel, Skeleton, SkeletonPanel } from '@/components/dash';
import { ScoreBar, useOrgLabels } from '@/components/org/bits';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { assessment, capacity } from '@/lib/api/services';
import type { AssessmentResult } from '@/lib/api/services/ai/assessment';
import type { Questionnaire } from '@/lib/api/services/core/capacity';
import { useT } from '@/lib/i18n';
import { cx, date, rwf } from '@/lib/format';

export default function AssessmentPage() {
  const t = useT();
  const questionnaire = useApi(() => capacity.getQuestionnaire(), []);
  const latest = useApi(() => assessment.latest(), []);
  const [retake, setRetake] = useState(false);

  const loading = (questionnaire.loading && !questionnaire.data) || (latest.loading && latest.data === undefined);
  const failed = questionnaire.error ? questionnaire : latest.error ? latest : null;
  if (loading || failed) {
    return (
      <>
        <PageHead title={t('nav.assessment')} />
        {failed ? <ErrorState error={failed.error} onRetry={failed.reload} /> : <SkeletonPanel rows={5} className="max-w-3xl" />}
      </>
    );
  }
  const q = questionnaire.data!;
  const r = latest.data ?? null;

  if (r && !retake) return <Results q={q} r={r} onRetake={() => { setRetake(true); window.scrollTo({ top: 0 }); }} />;
  return (
    <Wizard q={q} initial={r?.answers ?? {}} onCancel={r ? () => setRetake(false) : undefined}
      onDone={res => { latest.setData(res); setRetake(false); window.scrollTo({ top: 0 }); }} />
  );
}

function Wizard({ q, initial, onDone, onCancel }: {
  q: Questionnaire; initial: Record<string, number>; onDone: (r: AssessmentResult) => void; onCancel?: () => void;
}) {
  const t = useT();
  const { toast, toastNode } = useToast();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>(initial);
  const [busy, setBusy] = useState(false);
  const area = q.areas[step];
  const qs = q.questions.filter(x => x.areaId === area.id);
  const answeredAll = qs.every(x => answers[x.id]);
  const answered = q.questions.filter(x => answers[x.id]).length;
  const last = step === q.areas.length - 1;

  const next = async () => {
    if (!answeredAll) { toast(t('org.assess.answerAll')); return; }
    if (!last) { setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setBusy(true);
    try {
      onDone(await assessment.submit({ body: { version: q.version, answers } }));
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title={t('nav.assessment')}
        actions={onCancel && <Button variant="ghost" onClick={onCancel}>{t('ui.cancel')}</Button>} />

      <div className="mb-6 max-w-3xl">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold">{t('org.assess.section', { n: step + 1, total: q.areas.length })}</span>
          <span className="text-muted">{t('org.assess.answered', { n: answered, total: q.questions.length })}</span>
        </div>
        <Meter value={answered / q.questions.length} label={t('org.assess.answered', { n: answered, total: q.questions.length })} />
      </div>

      <Panel key={area.id} className="fade-in max-w-3xl">
        <h2 className="text-xl font-bold">{area.title}</h2>
        <p className="mt-1 text-muted">{area.intro}</p>

        <div className="mt-7 space-y-8">
          {qs.map(x => (
            <fieldset key={x.id}>
              <legend className="text-[17px] font-semibold leading-snug">
                <span className="mr-2 text-subtle">{q.questions.indexOf(x) + 1}.</span>{x.text}
              </legend>
              <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
                {q.scale.map(sc => {
                  const on = answers[x.id] === sc.value;
                  return (
                    <label key={sc.value} className={cx('flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-center transition focus-within:ring-4 focus-within:ring-brand/15',
                      on ? 'border-brand bg-brand-light dark:bg-brand/15' : 'border-line hover:bg-surface')}>
                      <input type="radio" name={x.id} value={sc.value} checked={on} className="sr-only"
                        onChange={() => setAnswers(a => ({ ...a, [x.id]: sc.value }))} />
                      <span className={cx('grid size-9 place-items-center rounded-full font-display text-lg font-bold transition', on ? 'bg-brand text-white' : 'bg-surface text-ink')}>{sc.value}</span>
                      <span className={cx('text-[11px] leading-tight sm:text-xs', on ? 'font-semibold text-ink' : 'text-muted')}>{sc.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-5">
          <Button variant="ghost" onClick={() => setStep(s => s - 1)} disabled={step === 0}><ArrowLeft size={18} aria-hidden="true" /> {t('ui.back')}</Button>
          <Button onClick={next} disabled={!answeredAll || busy}>
            {last ? (busy ? t('org.assess.scoring') : t('org.assess.seeResults')) : <>{t('ui.next')} <ArrowRight size={18} aria-hidden="true" /></>}
          </Button>
        </div>
      </Panel>
      {toastNode}
    </>
  );
}

function Results({ q, r, onRetake }: { q: Questionnaire; r: AssessmentResult; onRetake: () => void }) {
  const t = useT();
  const L = useOrgLabels();
  const hist = useApi(() => assessment.history(), [r.id]);
  const sorted = [...q.areas].sort((a, b) => (r.areaScores[a.id] ?? 0) - (r.areaScores[b.id] ?? 0));
  const areaTitle = (id: string) => q.areas.find(a => a.id === id)?.title ?? id;
  const delta = r.previousOverall !== null ? L.score(r.overall) - L.score(r.previousOverall) : null;

  return (
    <>
      <PageHead title={t('org.assess.results')} meta={t('org.home.completed', { date: date(r.completedAt.slice(0, 10)) })}
        actions={<Button variant="ghost" onClick={onRetake}><RotateCcw size={17} aria-hidden="true" /> {t('org.assess.retake')}</Button>} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={t('org.assess.byArea')}>
          <div className="mb-7 flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-line pb-6">
            <div>
              <div className="text-sm text-muted">{t('org.assess.overall')}</div>
              <div className="font-display text-[44px] font-bold leading-none tabular-nums">{L.score(r.overall)}<span className="text-lg font-semibold text-muted">/100</span></div>
            </div>
            <div className="pb-1">
              <div className="font-bold">{L.band(r.overall)}</div>
              {delta !== null && (
                <div className={cx('text-sm font-semibold', delta >= 0 ? 'text-ok' : 'text-brand')}>
                  {t('org.assess.change', { delta: `${delta > 0 ? '+' : ''}${delta}` })}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-5">
            {sorted.map(a => <ScoreBar key={a.id} label={a.title} value={r.areaScores[a.id] ?? 0} highlight={r.weakest.includes(a.id)} />)}
          </div>
          <Legend className="mt-6" items={[
            { label: t('org.assess.legendLow'), tone: 'brand' },
            { label: t('org.assess.legendMid'), tone: 'gold' },
            { label: t('org.assess.legendHigh'), tone: 'ok' },
          ]} />
        </Panel>

        <div className="min-w-0 space-y-6">
          <Panel title={t('org.assess.recommended')}>
            <ul className="space-y-3">
              {r.topics.map(x => (
                <li key={x.id} className="rounded-2xl bg-surface p-4">
                  <div className="text-xs font-semibold text-muted">{t('org.assess.forArea', { area: areaTitle(x.areaId) })}</div>
                  <div className="mt-0.5 font-bold">{x.title}</div>
                  <div className="mt-1 text-sm text-muted">{x.duration} · {x.modes.map(m => L.mode(m)).join(', ')}</div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-line p-4">
              <div>
                <div className="text-xs font-semibold text-muted">{t('org.assess.package')}</div>
                <div className="font-bold">{r.packageName}</div>
              </div>
              <Badge tone="gold">{r.packagePrice === null ? t('org.pkg.quoted') : rwf(r.packagePrice)}</Badge>
            </div>
            <Button href={`/org/book?topics=${r.topics.map(x => x.id).join(',')}&package=${r.packageId}`} className="mt-5 w-full">
              <Check size={18} aria-hidden="true" /> {t('org.assess.bookThese')}
            </Button>
            <p className="mt-3 text-center text-sm text-muted">{t('org.assess.changeLater')}</p>
          </Panel>

          <Panel title={t('org.assess.history')}>
            <Async state={hist} skeleton={<Skeleton className="h-20" />} empty={d => d.length === 0} emptyView={null}>
              {d => (
                <ul className="divide-y divide-line">
                  {d.map((h, i) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className={i === 0 ? 'font-semibold' : 'text-muted'}>{date(h.completedAt.slice(0, 10))}</span>
                      <span className="font-display font-bold tabular-nums">{L.score(h.overall)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Async>
          </Panel>
        </div>
      </div>
    </>
  );
}
