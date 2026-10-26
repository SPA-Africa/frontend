// Mock tables for the Pillar Representative console and the Judge / Mentor grading terminal.
// Shared tables (courses, cycles, cycleEntries, judgeQueue, catalogue, milestones, learners) stay in
// tables.ts; these hold the extra state those domains need (quiz content, per-judge scores, drafts,
// recusals, routing log, publication records).

import { mockId, mockTable, nowIso } from '../mock-db';
import { db } from './tables';
import { quizzes as seedQuizzes } from '../../mock/data';
import { judgeHistory, otherJudgesAverage } from '../../mock/internal';
import type { PillarId, QuizQuestion, User } from '../../types';

export interface QuizDefinition {
  /** 1..100, percent */
  passMark: number;
  maxRetakes: number;
  questions: QuizQuestion[];
}

export interface JudgeScoreRecord {
  judgeId: string;
  code: string;
  cycleId: string;
  sector: string;
  submittedAt: string;
  scores: Record<string, number>;
  comment: string;
}

export interface JudgeDraft { scores: Record<string, number>; comment: string; savedAt: string }

export interface RecusalRecord { code: string; judgeId: string; reason: string; at: string }

export interface RoutingRecord { code: string; cycleId: string; fromJudgeId: string | null; toJudgeId: string; reason: 'initial' | 'recusal'; at: string }

export const DEMO_JUDGE_ID = 'u-judge-1';

/** Seed quiz content for a quiz lesson that has never been edited. */
export const defaultQuiz = (): QuizDefinition => ({
  passMark: 70,
  maxRetakes: 3,
  questions: seedQuizzes.default.map(q => ({ ...q, options: q.options ? [...q.options] : undefined, answer: q.answer ? [...q.answer] : undefined })),
});

export const consoleDb = {
  /** quiz content keyed `${courseId}:${lessonId}` */
  quizzes: mockTable('console.quizzes', () => ({}) as Record<string, QuizDefinition>),
  /** authoring timestamps per course */
  courseMeta: mockTable('console.courseMeta', () => ({
    'c-ai-foundations': { updatedAt: '2026-10-12T09:20:00Z', publishedAt: '2026-05-04T08:00:00Z' },
    'c-digital-marketing': { updatedAt: '2026-10-21T09:48:00Z', publishedAt: '2026-10-21T09:48:00Z' },
  }) as Record<string, { updatedAt: string; publishedAt?: string }>),

  /** every submitted score, one row per judge and entry */
  judgeScores: mockTable('console.judgeScores', () => judgeHistory.map(h => ({ ...h, judgeId: DEMO_JUDGE_ID })) as JudgeScoreRecord[]),
  /** unsubmitted work, keyed `${judgeId}:${code}` */
  judgeDrafts: mockTable('console.judgeDrafts', () => ({
    [`${DEMO_JUDGE_ID}:PITCH-2026-00188`]: { scores: { innovation: 8, market: 7 }, comment: '', savedAt: '2026-10-22T18:10:00Z' },
  }) as Record<string, JudgeDraft>),
  /** mean of the other judges' weighted scores per entry (computed by ai-svc) */
  peerAverages: mockTable('console.peerAverages', () => ({ ...otherJudgesAverage }) as Record<string, number>),
  recusals: mockTable('console.recusals', () => [] as RecusalRecord[]),
  routing: mockTable('console.routing', () => [] as RoutingRecord[]),
  /** results publication per cycle */
  publications: mockTable('console.publications', () => ({}) as Record<string, { publishedAt: string; publishedBy: string }>),
};

/** Append to the shared audit log (the Executive Office audit page reads it). */
export function appendAudit(user: User | null, action: string, target: string, pillarId?: PillarId) {
  db.audit.update(list => {
    list.unshift({ id: mockId('ae'), at: nowIso().slice(0, 19), actor: user?.name ?? 'system', role: user?.role ?? 'system', action, target, pillarId });
  });
}
