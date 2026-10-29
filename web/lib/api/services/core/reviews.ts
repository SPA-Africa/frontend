// core-svc / reviews: short quiz answers reviewed by Pillar Representatives with AI suggestions (SRS FR-A2.6)
//
// Every short answer a learner submits becomes a review item in the course's pillar. The AI suggests a
// verdict and feedback right after submission; the Pillar Representative confirms or rewrites it and
// the learner is notified. A later review replaces the earlier one.

import { defineEndpoint, paginate, type Page } from '../../define';
import { nowIso } from '../../mock-db';
import { appendAudit } from '../../mock/console-tables';
import { aiLearningDb, settle, type StoredReview, type Verdict } from '../../mock/ai-learning-tables';
import type { PillarId } from '../../../types';

export type ShortAnswerVerdict = Verdict;
export type ReviewStatus = 'pending' | 'reviewed' | 'all';
export const VERDICTS: ShortAnswerVerdict[] = ['meets', 'partly', 'not_yet'];
export const MAX_REVIEW_FEEDBACK = 1000;

export interface ReviewItem {
  id: string;
  learnerName: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  lessonId: string;
  lessonTitle: string;
  questionId: string;
  prompt: string;
  /** what a good answer includes, from the course editor */
  guidance: string | null;
  answer: string;
  /** the AI suggestion: pending while it is written, failed when it could not, off when AI is turned off */
  ai: { status: 'pending' | 'done' | 'failed' | 'off'; verdict: ShortAnswerVerdict | null; feedback: string | null };
  /** the review the learner sees, once saved */
  final: { verdict: ShortAnswerVerdict; feedback: string; reviewerName: string; reviewedAt: string } | null;
  submittedAt: string;
}

export interface ReviewInput { verdict: ShortAnswerVerdict; feedback: string }

const toItem = (r: StoredReview): ReviewItem => ({
  id: r.id, learnerName: r.learnerName, courseId: r.courseId, courseTitle: r.courseTitle, courseSlug: r.courseSlug,
  lessonId: r.lessonId, lessonTitle: r.lessonTitle, questionId: r.questionId, prompt: r.prompt, guidance: r.guidance, answer: r.answer,
  ai: r.ai, final: r.final, submittedAt: r.submittedAt,
});

/** Ready fake AI suggestions, saved so every later read agrees */
const settled = () => {
  const rows = aiLearningDb.reviews.get();
  const next = rows.map(settle);
  if (next.some((r, i) => r !== rows[i])) aiLearningDb.reviews.set(next);
  return next;
};

export const listReviews = defineEndpoint<Page<ReviewItem>, {
  query?: { status?: ReviewStatus; courseId?: string; page?: number; pageSize?: number; pillar?: PillarId };
}>({
  id: 'reviews.list', service: 'core', method: 'GET', path: '/lms/reviews', paginated: true,
  roles: ['pillar_rep', 'executive_admin'], summary: 'Short quiz answers of the caller\'s pillar with the AI suggestion and any saved review',
  srs: ['FR-A2.6'], response: 'Page<ReviewItem>',
  query: ['status?: "pending" | "reviewed" | "all" (default pending)', 'courseId?: string', 'page?: number', 'pageSize?: number (default 20, max 100)', 'pillar?: PillarId (executive_admin only)'],
  notes: 'RLS: pillar_rep only sees lms.short_answer_reviews rows of their pillar; executive_admin sees all, or one pillar with ?pillar=. Pending oldest first, reviewed newest review first, all newest submission first. learnerName is the only learner detail returned.',
}, ({ args, user }) => {
  const q = args.query ?? {};
  const pillar = user?.role === 'pillar_rep' ? user.pillarId : q.pillar;
  const status = q.status ?? 'pending';
  const rows = settled()
    .filter(r => !pillar || r.pillarId === pillar)
    .filter(r => !q.courseId || r.courseId === q.courseId)
    .filter(r => status === 'all' || (status === 'pending') === !r.final);
  const sorted = status === 'pending'
    ? rows.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    : status === 'reviewed'
      ? rows.sort((a, b) => (b.final?.reviewedAt ?? '').localeCompare(a.final?.reviewedAt ?? ''))
      : rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return paginate(sorted.map(toItem), { ...q, pageSize: Math.min(100, Number(q.pageSize ?? 20)) });
});

export const saveReview = defineEndpoint<ReviewItem, { params: { id: string }; body: ReviewInput }>({
  id: 'reviews.save', service: 'core', method: 'POST', path: '/lms/reviews/:id',
  roles: ['pillar_rep', 'executive_admin'], summary: 'Confirm or rewrite the feedback on a short answer; the learner is notified',
  srs: ['FR-A2.6'], request: 'ReviewInput', response: 'ReviewItem', emits: ['short_answer.reviewed'],
  notes: '400 invalid_verdict, feedback_required, feedback_too_long (1000). 404 review_not_found, also for another pillar\'s answer. Saving again replaces the earlier review; the learner is notified ("Your answer was reviewed", link /app/learn/<slug>) and the audit log records "Reviewed short answer" only when the verdict or text changed.',
}, ({ args, user, fail }) => {
  const { verdict } = args.body ?? ({} as ReviewInput);
  const feedback = (args.body?.feedback ?? '').trim();
  if (!VERDICTS.includes(verdict)) fail(400, 'invalid_verdict', 'Choose a verdict');
  if (!feedback) fail(400, 'feedback_required', 'Write feedback for the learner');
  if (feedback.length > MAX_REVIEW_FEEDBACK) fail(400, 'feedback_too_long', 'Keep the feedback under 1000 characters');
  const row = settled().find(r => r.id === args.params.id);
  if (!row || (user?.role === 'pillar_rep' && row.pillarId !== user.pillarId)) return fail(404, 'review_not_found', 'We could not find this answer');
  if (row.final?.verdict === verdict && row.final.feedback === feedback) return toItem(row);
  const next: StoredReview = { ...row, final: { verdict, feedback, reviewerName: user?.name ?? 'Reviewer', reviewedAt: nowIso() } };
  aiLearningDb.reviews.update(list => list.map(r => (r.id === row.id ? next : r)));
  appendAudit(user, 'Reviewed short answer', `${row.courseTitle}, ${row.lessonTitle}`, row.pillarId);
  return toItem(next);
});
