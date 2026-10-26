// Shared mock database. Every service's mock handler reads and writes these tables, so a change
// in one portal shows up in the others (a course a Pillar Rep publishes appears for learners,
// a booking an organisation makes appears for the Executive Office, and so on).
// Seeds come from lib/mock/*. Tables persist in localStorage (see mock-db.ts).

import { mockTable } from '../mock-db';
import {
  agriListings, bookings, catalogue, certificates, competitionCycles, courses, invoices, kpis, milestones,
  myEnrollments, myPitches, packages,
} from '../../mock/data';
import {
  auditEvents, catalogueStatus, cycleEntries, fundingPipeline, judgeHistory, learners, otherInvoices, people, quarterReports,
} from '../../mock/internal';
import { judgeQueue } from '../../mock/data';
import type { Course } from '../../types';

const lessonsOf = (c: Course) => c.modules.flatMap(m => m.lessons);

export const db = {
  courses: mockTable('courses', () => courses),
  certificates: mockTable('certificates', () => certificates),

  /** The demo learner's learning state (enrolments, completed lessons, quiz attempts) */
  learning: mockTable('learning', () => {
    const completed: Record<string, string[]> = {};
    const quiz: Record<string, { attempts: number; best: number; passed: boolean }> = {};
    for (const e of myEnrollments) {
      const c = courses.find(x => x.id === e.courseId);
      if (!c) continue;
      const ls = lessonsOf(c);
      const n = e.status === 'completed' ? ls.length : Math.round(ls.length * e.progress);
      completed[c.id] = ls.slice(0, n).map(l => l.id);
      if (e.status === 'completed') ls.filter(l => l.type === 'quiz').forEach(l => { quiz[`${c.id}:${l.id}`] = { attempts: 1, best: 0.86, passed: true }; });
    }
    return {
      enrollments: myEnrollments.map(e => ({ courseId: e.courseId, status: e.status as 'enrolled' | 'in_progress' | 'completed', lastLessonId: e.lastLessonId, lastActive: e.lastActive })),
      completed,
      quiz,
    };
  }),

  /** Live sessions and deadlines for the learner schedule */
  sessions: mockTable('sessions', () => [
    { id: 's-1', kind: 'live' as const, title: 'Q&A with the facilitator', courseId: 'c-ai-foundations', startsAt: '2026-10-27T16:00:00Z', minutes: 60, joinUrl: 'https://meet.example.org/spa-ai-qa' },
    { id: 's-2', kind: 'live' as const, title: 'Pitch clinic: telling your story', courseId: 'c-startup-bootcamp', startsAt: '2026-10-30T15:00:00Z', minutes: 90, joinUrl: 'https://meet.example.org/spa-pitch-clinic' },
    { id: 's-3', kind: 'deadline' as const, title: 'Module 3 quiz due', courseId: 'c-ai-foundations', startsAt: '2026-11-02T21:00:00Z', minutes: 0 },
    { id: 's-4', kind: 'deadline' as const, title: 'East Africa Youth Pitch closes', courseId: null, startsAt: '2026-11-15T21:00:00Z', minutes: 0 },
    { id: 's-5', kind: 'live' as const, title: 'Leadership circle (alumni)', courseId: 'c-values-leadership', startsAt: '2026-11-05T16:30:00Z', minutes: 60, joinUrl: 'https://meet.example.org/spa-leaders' },
    { id: 's-6', kind: 'event' as const, title: 'Kigali Pilot Pitch Night results', courseId: null, startsAt: '2026-11-08T17:00:00Z', minutes: 120 },
  ]),

  cycles: mockTable('cycles', () => competitionCycles),
  pitches: mockTable('pitches', () => myPitches),
  cycleEntries: mockTable('cycleEntries', () => cycleEntries),
  judgeQueue: mockTable('judgeQueue', () => judgeQueue),
  judgeHistory: mockTable('judgeHistory', () => judgeHistory),

  listings: mockTable('listings', () => ({ all: agriListings, mine: ['l-2'] as string[] })),

  catalogue: mockTable('catalogue', () => catalogue.map(t => ({ ...t, status: catalogueStatus[t.id] ?? 'published' }))),
  packages: mockTable('packages', () => packages),
  bookings: mockTable('bookings', () => bookings),
  invoices: mockTable('invoices', () => [...invoices, ...otherInvoices]),

  kpis: mockTable('kpis', () => kpis),
  milestones: mockTable('milestones', () => milestones),
  learners: mockTable('learners', () => learners),
  people: mockTable('people', () => people),
  audit: mockTable('audit', () => auditEvents),
  reports: mockTable('reports', () => quarterReports),
  funding: mockTable('funding', () => fundingPipeline),

  settings: mockTable('settings', () => ({
    minimumAge: 15,
    quizPassMark: 0.7,
    maxQuizAttempts: 3,
    languages: ['en', 'fr'] as string[],
    deletionSlaDays: 30,
    uploadLimitsMb: { businessPlan: 20, pitchDeck: 30 },
    certificateVerification: true,
    vatRate: 0.18,
    invoiceNumberFormat: 'SPA-INV-{YEAR}-{SEQ}',
    paymentTermsDays: 30,
  })),
};

export type Db = typeof db;
