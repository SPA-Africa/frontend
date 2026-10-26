// Mock tables for the learner domains (LMS extras, pitch uploads, agri-market, profile).
// Shared tables (courses, learning, certificates, pitches, listings, settings) live in tables.ts.

import { mockTable } from '../mock-db';
import { quizzes } from '../../mock/data';
import type { PillarId, QuizQuestion } from '../../types';

export type Language = 'en' | 'fr' | 'rw';

export interface LearnerConsents {
  /** Required to hold an account. Withdrawing it means asking for deletion. */
  dataProcessing: boolean;
  aiRecommendations: boolean;
  emailUpdates: boolean;
  smsUpdates: boolean;
  analytics: boolean;
  shareWithPartners: boolean;
  showInPublicResults: boolean;
}

export interface StoredProfile {
  userId: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  bio: string;
  gender: 'female' | 'male' | 'prefer_not';
  birthYear: number;
  pillars: PillarId[];
  language: Language;
  dataSaver: boolean;
  consents: LearnerConsents;
  deletionRequestedAt: string | null;
  deletionReason: string | null;
  exportRequestedAt: string | null;
}

export interface StoredUpload {
  id: string;
  entryId: string;
  kind: 'business_plan' | 'pitch_deck';
  name: string;
  sizeMb: number;
  contentType: string;
  status: 'requested' | 'uploaded';
  /** when the client confirmed the upload; the mock scan finishes a few seconds later */
  uploadedAt: string | null;
}

export interface SellerMessage {
  id: string;
  listingId: string;
  fromUserId: string;
  name: string;
  phone: string;
  text: string;
  sentAt: string;
}

const inMinutes = (m: number) => {
  const d = new Date(Date.now() + m * 60_000);
  d.setSeconds(0, 0);
  return d.toISOString();
};

export const learnerDb = {
  /** Video resume positions in seconds, keyed `${courseId}:${lessonId}` */
  videoPositions: mockTable<Record<string, number>>('lms.videoPositions', () => ({ 'c-ai-foundations:m3-l1': 252 })),

  /** Question bank keyed `${courseId}:${lessonId}`; `default` is used when a quiz has no own bank */
  quizBank: mockTable<Record<string, QuizQuestion[]>>('lms.quizBank', () => ({ default: quizzes.default })),

  /** Attempt history, newest last, keyed `${courseId}:${lessonId}` */
  quizAttempts: mockTable<Record<string, { at: string; score: number; passed: boolean; offline: boolean }[]>>('lms.quizAttempts', () => ({})),

  /** Extra live sessions for the demo. One starts ten minutes after the first visit so the Join button can be tried. */
  extraSessions: mockTable('schedule.extra', () => [
    { id: 's-office', kind: 'live' as const, title: 'Office hours with your mentor', courseId: 'c-startup-bootcamp', startsAt: inMinutes(10), minutes: 45, joinUrl: 'https://meet.example.org/spa-office-hours' },
  ]),

  pitchUploads: mockTable<StoredUpload[]>('pitch.uploads', () => [
    { id: 'up-seed-1', entryId: 'p-1', kind: 'business_plan', name: 'SokoFresh-business-plan.pdf', sizeMb: 2.4, contentType: 'application/pdf', status: 'uploaded', uploadedAt: '2026-10-21T09:00:00Z' },
  ]),

  /** Submission time per entry (PitchEntry has no field for it) */
  pitchSubmittedAt: mockTable<Record<string, string>>('pitch.submittedAt', () => ({ 'p-2': '2026-06-28T14:12:00Z' })),

  sellerMessages: mockTable<SellerMessage[]>('market.messages', () => []),

  profiles: mockTable<Record<string, StoredProfile>>('profile.profiles', () => ({
    'u-ben-1': {
      userId: 'u-ben-1', name: 'Aline Uwase', email: 'aline@example.com', phone: '', country: 'Rwanda', city: 'Kigali',
      bio: 'Founder of SokoFresh. Learning AI tools to grow my agribusiness.', gender: 'female', birthYear: 2001,
      pillars: ['technology', 'young_startups', 'leadership'], language: 'en', dataSaver: false,
      consents: { dataProcessing: true, aiRecommendations: true, emailUpdates: true, smsUpdates: false, analytics: true, shareWithPartners: false, showInPublicResults: false },
      deletionRequestedAt: null, deletionReason: null, exportRequestedAt: null,
    },
  })),

  /** Courses the learner dismissed from recommendations */
  dismissedRecommendations: mockTable<string[]>('recommendations.dismissed', () => []),
};

/** The stored profile for a user, created with sensible defaults on first read. */
export function profileFor(user: { id: string; name: string; email: string; country?: string }): StoredProfile {
  const existing = learnerDb.profiles.get()[user.id];
  if (existing) return existing;
  const fresh: StoredProfile = {
    userId: user.id, name: user.name, email: user.email, phone: '', country: user.country ?? 'Rwanda', city: '', bio: '',
    gender: 'prefer_not', birthYear: 2000, pillars: [], language: 'en', dataSaver: false,
    consents: { dataProcessing: true, aiRecommendations: true, emailUpdates: true, smsUpdates: false, analytics: false, shareWithPartners: false, showInPublicResults: false },
    deletionRequestedAt: null, deletionReason: null, exportRequestedAt: null,
  };
  learnerDb.profiles.update(d => { d[user.id] = fresh; });
  return fresh;
}
