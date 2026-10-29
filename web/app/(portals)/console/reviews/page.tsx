'use client';

// Answer reviews (SRS FR-A2.6): short quiz answers from the pillar's learners with the AI's suggested
// verdict and feedback. The Pillar Representative confirms or rewrites it; the learner sees the
// review in their quiz and gets a notification.

import { useEffect, useState } from 'react';
import { Bot, MessageSquareText, RefreshCw, UserCheck } from 'lucide-react';
import { Badge, Button, EmptyState, Field, Select, Textarea, type Tone } from '@/components/ui';
import { Modal, Tabs, useToast } from '@/components/ui/client';
import { Async, PageHead, Panel, SkeletonPanel } from '@/components/dash';
import { FormError, PillarScope, useRepPillar } from '@/components/console/ConsoleKit';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { authoring, reviews } from '@/lib/api/services';
import { MAX_REVIEW_FEEDBACK, VERDICTS, type ReviewItem, type ReviewStatus, type ShortAnswerVerdict } from '@/lib/api/services/core/reviews';
import { useT } from '@/lib/i18n';
import { cx, date } from '@/lib/format';

const PAGE_SIZE = 10;
const STATUSES: ReviewStatus[] = ['pending', 'reviewed', 'all'];
const VERDICT_TONE: Record<ShortAnswerVerdict, Tone> = { meets: 'ok', partly: 'gold', not_yet: 'brand' };

export default function AnswerReviews() {
  const t = useT();
  const pillarId = useRepPillar();
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [courseId, setCourseId] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ReviewItem | null>(null);
  const { toast, toastNode } = useToast();

  const courses = useApi(() => authoring.listCourses(), [pillarId]);
  const list = useApi(
    () => reviews.listReviews({ query: { status, courseId: courseId || undefined, page, pageSize: PAGE_SIZE } }),
    [pillarId, status, courseId, page],
  );

  // AI suggestions arrive a few seconds after a learner submits: refresh while one is being written
  const waiting = !!list.data?.items.some(r => r.ai.status === 'pending');
  const { reload } = list;
  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(reload, 5000);
    return () => clearTimeout(id);
  }, [waiting, list.data, reload]);

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const filter = (fn: () => void) => { fn(); setPage(1); };

  const saved = (item: ReviewItem) => {
    setEditing(null);
    toast(t('ai.reviews.saved'));
    if (status === 'pending') {
      // the answer leaves this queue; step back a page when it was the last one here
      const last = list.data?.items.length === 1 && page > 1;
      if (last) setPage(p => p - 1);
      else list.setData(d => d && { ...d, items: d.items.filter(r => r.id !== item.id), total: Math.max(0, d.total - 1) });
    } else {
      list.setData(d => d && { ...d, items: d.items.map(r => (r.id === item.id ? item : r)) });
    }
  };

  return (
    <>
      <PageHead title={t('nav.answerReviews')} meta={<PillarScope pillarId={pillarId} />}
        actions={<Button variant="ghost" onClick={list.reload} disabled={list.loading}><RefreshCw size={16} className={cx(list.loading && 'animate-spin')} aria-hidden /> {t('ai.reviews.refresh')}</Button>} />
      <p className="mb-5 max-w-3xl text-muted">{t('ai.reviews.intro')}</p>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs tabs={STATUSES.map(s => ({ id: s, label: t(`ai.reviews.status.${s}`) }))} value={status} onChange={s => filter(() => setStatus(s))} />
        <label className="w-full sm:w-72">
          <span className="sr-only">{t('ai.reviews.course')}</span>
          <Select className="h-10! rounded-full! text-sm" value={courseId} onChange={e => filter(() => setCourseId(e.target.value))}>
            <option value="">{t('ai.reviews.allCourses')}</option>
            {(courses.data ?? []).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </Select>
        </label>
        {list.data && <span className="text-sm text-muted" aria-live="polite">{t('ai.reviews.count', { n: list.data.total })}</span>}
      </div>

      <Async state={list} skeleton={<div className="flex flex-col gap-4"><SkeletonPanel rows={4} /><SkeletonPanel rows={4} /></div>}
        empty={d => d.items.length === 0}
        emptyView={status === 'pending' && !courseId
          ? <EmptyState icon={<MessageSquareText size={22} />} title={t('ai.reviews.emptyPending')} text={t('ai.reviews.emptyPendingText')} />
          : <EmptyState icon={<MessageSquareText size={22} />} title={t('ui.noResults')} />}>
        {d => (
          <>
            <ol className="flex flex-col gap-4">
              {d.items.map(r => <li key={r.id}><ReviewCard item={r} onReview={() => setEditing(r)} /></li>)}
            </ol>
            {pages > 1 && (
              <nav className="mt-6 flex items-center justify-between gap-3" aria-label={t('ai.reviews.page', { page, pages })}>
                <Button variant="ghost" size="sm" disabled={page <= 1 || list.loading} onClick={() => setPage(p => p - 1)}>{t('ui.previous')}</Button>
                <span className="text-sm text-muted">{t('ai.reviews.page', { page, pages })}</span>
                <Button variant="ghost" size="sm" disabled={page >= pages || list.loading} onClick={() => setPage(p => p + 1)}>{t('ui.next')}</Button>
              </nav>
            )}
          </>
        )}
      </Async>

      {editing && <ReviewForm item={editing} onClose={() => setEditing(null)} onSaved={saved} />}
      {toastNode}
    </>
  );
}

function ReviewCard({ item: r, onReview }: { item: ReviewItem; onReview: () => void }) {
  const t = useT();
  const label = 'text-xs font-semibold uppercase tracking-wide text-subtle';
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{r.courseTitle} · {r.lessonTitle}</p>
          <p className="mt-0.5 font-semibold">{r.learnerName}</p>
          <p className="text-xs text-subtle">{t('ai.reviews.submitted', { date: date(r.submittedAt.slice(0, 10)) })}</p>
        </div>
        {r.final
          ? <Badge tone="ok"><UserCheck size={12} aria-hidden /> {t('ai.reviews.status.reviewed')}</Badge>
          : <Badge tone="info">{t('ai.reviews.status.pending')}</Badge>}
      </div>

      <dl className="mt-4 flex flex-col gap-3">
        <div><dt className={label}>{t('ai.reviews.question')}</dt><dd className="mt-1">{r.prompt}</dd></div>
        {r.guidance && <div><dt className={label}>{t('ai.reviews.guidance')}</dt><dd className="mt-1 text-sm text-muted">{r.guidance}</dd></div>}
        <div><dt className={label}>{t('ai.reviews.answer')}</dt><dd className="mt-1 whitespace-pre-line rounded-xl bg-surface p-3 text-[15px]">{r.answer}</dd></div>
      </dl>

      <div className="mt-4 rounded-xl border border-line p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx(label, 'inline-flex items-center gap-1')}><Bot size={13} aria-hidden /> {t('ai.reviews.aiSuggestion')}</span>
          {r.ai.status === 'done' && r.ai.verdict && <Badge tone={VERDICT_TONE[r.ai.verdict]}>{t(`ai.verdict.${r.ai.verdict}`)}</Badge>}
        </div>
        <p className={cx('mt-1 text-sm', r.ai.status === 'done' ? '' : 'text-muted')}>
          {r.ai.status === 'done' ? r.ai.feedback
            : r.ai.status === 'pending' ? t('ai.reviews.aiPending')
              : r.ai.status === 'failed' ? t('ai.reviews.aiFailed') : t('ai.reviews.aiOff')}
        </p>
      </div>

      {r.final && (
        <div className="mt-3 rounded-xl bg-ok-light/40 p-3 dark:bg-ok/10">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={VERDICT_TONE[r.final.verdict]}>{t(`ai.verdict.${r.final.verdict}`)}</Badge>
            <span className="text-xs text-muted">{t('ai.reviews.reviewedBy', { name: r.final.reviewerName, date: date(r.final.reviewedAt.slice(0, 10)) })}</span>
          </div>
          <p className="mt-1 whitespace-pre-line text-sm">{r.final.feedback}</p>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button size="sm" variant={r.final ? 'ghost' : 'primary'} onClick={onReview}>{r.final ? t('ai.reviews.edit') : t('ai.reviews.review')}</Button>
      </div>
    </Panel>
  );
}

/** Verdict and feedback, prefilled with the saved review or else the AI suggestion */
function ReviewForm({ item, onClose, onSaved }: { item: ReviewItem; onClose: () => void; onSaved: (item: ReviewItem) => void }) {
  const t = useT();
  const [verdict, setVerdict] = useState<ShortAnswerVerdict | ''>(item.final?.verdict ?? item.ai.verdict ?? '');
  const [feedback, setFeedback] = useState(item.final?.feedback ?? item.ai.feedback ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const prefilled = !item.final && item.ai.status === 'done' && !!item.ai.feedback;

  const save = async () => {
    setError(null);
    if (!verdict) { setError(t('ai.reviews.chooseVerdict')); return; }
    if (!feedback.trim()) { setError(t('ai.reviews.feedbackRequired')); return; }
    if (feedback.trim().length > MAX_REVIEW_FEEDBACK) { setError(t('ai.reviews.feedbackTooLong')); return; }
    setBusy(true);
    try {
      onSaved(await reviews.saveReview({ params: { id: item.id }, body: { verdict, feedback: feedback.trim() } }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={t('ai.reviews.formTitle')} wide
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('ui.cancel')}</Button>
        <Button onClick={save} disabled={busy}>{t('ai.reviews.save')}</Button>
      </>}>
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm text-muted">{item.learnerName} · {item.courseTitle} · {item.lessonTitle}</p>
          <p className="mt-2 font-semibold">{item.prompt}</p>
          {item.guidance && <p className="mt-1 text-sm text-muted">{t('ai.reviews.guidance')}: {item.guidance}</p>}
          <p className="mt-3 whitespace-pre-line rounded-xl bg-surface p-3 text-[15px]">{item.answer}</p>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t('ai.reviews.verdict')}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {VERDICTS.map(v => (
              <label key={v} className={cx('inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                verdict === v ? 'border-brand bg-brand-light/50 dark:bg-brand/10' : 'border-line hover:bg-surface')}>
                <input type="radio" name="verdict" value={v} checked={verdict === v} onChange={() => setVerdict(v)} className="size-4 accent-brand" />
                {t(`ai.verdict.${v}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label={t('ai.reviews.feedback')} htmlFor="review-feedback" hint={prefilled ? t('ai.reviews.prefilled') : t('ai.reviews.feedbackHint')}>
          <Textarea id="review-feedback" value={feedback} maxLength={MAX_REVIEW_FEEDBACK} onChange={e => setFeedback(e.target.value)} />
        </Field>
        <p className="-mt-3 text-right text-xs text-subtle tabular-nums">{t('ai.reviews.chars', { n: feedback.trim().length })}</p>
        <FormError message={error} />
      </div>
    </Modal>
  );
}
