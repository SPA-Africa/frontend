'use client';

// Quiz player (SRS FR-A2.6 to FR-A2.9). Rules come from the API: pass mark and attempts from settings,
// grading on the server. A quiz can be downloaded to the device; an attempt taken offline is
// queued and graded when the connection comes back.

import { useEffect, useState } from 'react';
import { Check, CloudDownload, CloudOff, Hourglass, Lock, RotateCcw, X } from 'lucide-react';
import { Badge, Button, Textarea } from '@/components/ui';
import { Async, Meter, Panel, Skeleton } from '@/components/dash';
import { ApiError } from '@/lib/api/http';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { lms } from '@/lib/api/services';
import type { LearnerQuestion, Quiz, QuizResult, QuizSubmission } from '@/lib/api/services/core/lms';
import { useT } from '@/lib/i18n';
import { cx, pct } from '@/lib/format';
import { offlineQuiz, useOfflineStore, useOnline } from './offline';

type Answers = Record<string, number[] | string>;

export function QuizEngine({ courseId, lessonId, onResult, onToast }: {
  courseId: string; lessonId: string; onResult: (r: QuizResult) => void; onToast: (m: string) => void;
}) {
  const t = useT();
  const quiz = useApi(() => lms.getQuiz({ params: { courseId, lessonId } }), [courseId, lessonId]);
  const [online] = useOnline();
  const saved = useOfflineStore(() => offlineQuiz.get(courseId, lessonId));
  const pending = useOfflineStore(() => offlineQuiz.pending(courseId, lessonId));
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [retaking, setRetaking] = useState(false);
  const [busy, setBusy] = useState(false);

  // when offline, fall back to the downloaded copy
  const q: Quiz | undefined = quiz.data ?? saved ?? undefined;

  const send = async (submission: QuizSubmission) => {
    setBusy(true);
    try {
      const r = await lms.submitQuiz({ params: { courseId, lessonId }, body: submission });
      offlineQuiz.clearPending(courseId, lessonId);
      setResult(r);
      quiz.setData(d => d && { ...d, attemptsUsed: r.attemptsUsed, attemptsLeft: r.attemptsLeft, best: r.best, passed: r.passed });
      onResult(r);
      if (!r.passed) onToast(t('learner.quiz.scored', { score: pct(r.score), mark: pct(r.passMark) }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      // the server rejected the attempt (for example no attempts left): drop the queued copy
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) offlineQuiz.clearPending(courseId, lessonId);
      onToast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // replay an attempt taken offline once the connection is back
  useEffect(() => {
    if (online && pending && !busy) send({ ...pending, offline: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, pending]);

  const toggleOffline = async () => {
    if (saved) { offlineQuiz.remove(courseId, lessonId); onToast(t('learner.quiz.offlineRemoved')); return; }
    try {
      offlineQuiz.save(await lms.downloadQuiz({ params: { courseId, lessonId } }));
      onToast(t('learner.quiz.offlineSaved'));
    } catch (e) { onToast(errorMessage(e)); }
  };

  if (!q) {
    return (
      <Async state={quiz} skeleton={<div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}>
        {() => null}
      </Async>
    );
  }

  const locked = !q.passed && q.attemptsLeft <= 0 && !result;
  const showPassed = q.passed && !result && !retaking;
  const answered = q.questions.filter(x => {
    const v = answers[x.id];
    return x.type === 'short' ? typeof v === 'string' && v.trim().length > 0 : Array.isArray(v) && v.length > 0;
  }).length;
  const feedback = (id: string) => result?.feedback.find(f => f.questionId === id);

  const submit = () => {
    const submission: QuizSubmission = { answers, startedAt: new Date().toISOString() };
    if (!online) {
      offlineQuiz.queue(courseId, lessonId, submission);
      onToast(t('learner.quiz.queued'));
      return;
    }
    send(submission);
  };
  const retake = () => { setAnswers({}); setResult(null); setRetaking(true); };
  const pick = (qid: string, idx: number, multi: boolean) => {
    if (result) return;
    setAnswers(a => {
      const cur = (a[qid] as number[] | undefined) ?? [];
      return { ...a, [qid]: multi ? (cur.includes(idx) ? cur.filter(i => i !== idx) : [...cur, idx]) : [idx] };
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <div className="flex gap-1"><dt className="text-muted">{t('learner.quiz.questions')}</dt><dd className="font-semibold">{q.questions.length}</dd></div>
          <div className="flex gap-1"><dt className="text-muted">{t('learner.quiz.passMark')}</dt><dd className="font-semibold">{pct(q.passMark)}</dd></div>
          <div className="flex gap-1"><dt className="text-muted">{t('learner.quiz.attemptsLeft')}</dt><dd className="font-semibold">{q.attemptsLeft} / {q.maxAttempts}</dd></div>
        </dl>
        <button type="button" role="switch" aria-checked={!!saved} onClick={toggleOffline} disabled={!online && !saved}
          className="inline-flex items-center gap-3 self-start text-sm font-semibold disabled:opacity-50 sm:self-auto">
          <CloudDownload size={18} className="text-brand" />
          {t('learner.quiz.offline')}
          <span className={cx('relative h-6 w-11 rounded-full transition', saved ? 'bg-brand' : 'bg-surface-2 ring-1 ring-line')}>
            <span className={cx('absolute top-1 size-4 rounded-full bg-bg shadow transition-all', saved ? 'left-6' : 'left-1')} />
          </span>
        </button>
      </div>

      {pending && (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-line bg-bg p-4 text-sm">
          <CloudOff size={18} className="shrink-0 text-brand" />
          <span className="flex-1">{online ? t('learner.quiz.syncing') : t('learner.quiz.waitingSync')}</span>
        </div>
      )}

      {showPassed && (
        <Panel>
          <div className="flex flex-col items-start gap-3">
            <Badge tone="ok"><Check size={14} /> {t('learner.quiz.passed')}</Badge>
            <p className="text-lg font-semibold">{t('learner.quiz.passedWith', { score: pct(q.best) })}</p>
            {q.attemptsLeft > 0 && <Button variant="ghost" size="sm" onClick={retake}><RotateCcw size={16} /> {t('learner.quiz.practise')}</Button>}
          </div>
        </Panel>
      )}

      {locked && (
        <Panel>
          <div className="flex flex-col items-start gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-gold-light text-ink dark:bg-gold/20"><Lock size={20} /></span>
            <h3 className="text-lg font-bold">{t('learner.quiz.lockedTitle', { n: q.maxAttempts })}</h3>
            <p className="text-muted">{t('learner.quiz.lockedText', { score: pct(q.best) })}</p>
          </div>
        </Panel>
      )}

      {result && (
        <Panel className={result.passed ? 'border-ok/40' : 'border-brand/40'}>
          <div aria-live="polite">
            <div className="flex flex-wrap items-center gap-4">
              <div className="font-display text-5xl font-bold tabular-nums">{pct(result.score)}</div>
              <div>
                <Badge tone={result.passed ? 'ok' : 'brand'}>{result.passed ? t('learner.quiz.passed') : t('learner.quiz.notYet')}</Badge>
                <p className="mt-1 text-sm text-muted">{t('learner.quiz.resultNote', { mark: pct(result.passMark) })}</p>
              </div>
            </div>
            <Meter className="mt-5" value={result.score} expected={result.passMark} tone={result.passed ? 'ok' : 'brand'} label={t('learner.quiz.score')} />
            {!result.passed && (result.attemptsLeft > 0
              ? <Button className="mt-5" onClick={retake}><RotateCcw size={18} /> {t('learner.quiz.tryAgain', { n: result.attemptsLeft })}</Button>
              : <p className="mt-5 font-semibold">{t('learner.quiz.lastAttempt')}</p>)}
          </div>
        </Panel>
      )}

      {!showPassed && !locked && (
        <ol className="space-y-4">
          {q.questions.map((question, i) => (
            <QuestionCard key={question.id} n={i + 1} q={question} value={answers[question.id]} fb={feedback(question.id)} disabled={!!result}
              onPick={(idx, multi) => pick(question.id, idx, multi)} onText={v => setAnswers(a => ({ ...a, [question.id]: v }))} />
          ))}
        </ol>
      )}

      {!result && !showPassed && !locked && !pending && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted">{t('learner.quiz.answered', { n: answered, total: q.questions.length })}</span>
          <Button onClick={submit} disabled={busy || answered < q.questions.length}>
            {busy ? t('learner.quiz.grading') : online ? t('learner.quiz.submit') : t('learner.quiz.submitOffline')}
          </Button>
        </div>
      )}
    </div>
  );
}

function QuestionCard({ n, q, value, fb, disabled, onPick, onText }: {
  n: number; q: LearnerQuestion; value: number[] | string | undefined; fb?: QuizResult['feedback'][number]; disabled: boolean;
  onPick: (idx: number, multi: boolean) => void; onText: (v: string) => void;
}) {
  const t = useT();
  const multi = q.type === 'multiple';
  const chosen = Array.isArray(value) ? value : [];
  return (
    <li>
      <fieldset className={cx('rounded-[var(--radius-card)] border bg-bg p-5 transition',
        fb?.result === 'correct' ? 'border-ok/50' : fb?.result === 'incorrect' ? 'border-brand/50' : 'border-line')}>
        <legend className="sr-only">{t('learner.quiz.question', { n })}</legend>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-subtle">{t('learner.quiz.question', { n })} · {t(`learner.quiz.type.${q.type}`)}</div>
            <p className="mt-1 font-semibold">{q.prompt}</p>
          </div>
          {fb?.result === 'correct' && <Badge tone="ok"><Check size={12} /> {t('learner.quiz.correct')}</Badge>}
          {fb?.result === 'incorrect' && <Badge tone="brand"><X size={12} /> {t('learner.quiz.incorrect')}</Badge>}
          {fb?.result === 'review' && <Badge tone="info"><Hourglass size={12} /> {t('learner.quiz.review')}</Badge>}
        </div>
        {q.type === 'short' ? (
          <Textarea aria-label={t('learner.quiz.answerTo', { n })} className="mt-4" disabled={disabled}
            value={typeof value === 'string' ? value : ''} onChange={e => onText(e.target.value)} placeholder={t('learner.quiz.writeAnswer')} />
        ) : (
          <div className="mt-4 grid gap-2" role={multi ? 'group' : 'radiogroup'} aria-label={q.prompt}>
            {q.options?.map((o, idx) => {
              const on = chosen.includes(idx);
              const isAnswer = fb?.correctOptions?.includes(idx);
              return (
                <label key={idx} className={cx('flex items-center gap-3 rounded-xl border px-4 py-3 text-[15px] transition',
                  isAnswer ? 'border-ok bg-ok-light/50 dark:bg-ok/10' : on ? 'border-brand bg-brand-light/50 dark:bg-brand/10' : 'border-line hover:bg-surface',
                  disabled ? 'cursor-default' : 'cursor-pointer')}>
                  <input type={multi ? 'checkbox' : 'radio'} name={q.id} checked={on} disabled={disabled}
                    onChange={() => onPick(idx, multi)} className="size-4 shrink-0 accent-brand" />
                  <span className="flex-1">{o}</span>
                  {isAnswer && <Check size={16} className="text-ok" aria-label={t('learner.quiz.correctAnswer')} />}
                </label>
              );
            })}
          </div>
        )}
        {fb?.result === 'incorrect' && <p className="mt-3 text-sm text-muted">{fb.correctOptions ? t('learner.quiz.seeCorrect') : t('learner.quiz.hidden')}</p>}
        {fb?.result === 'review' && <p className="mt-3 text-sm text-muted">{t('learner.quiz.reviewNote')}</p>}
      </fieldset>
    </li>
  );
}
