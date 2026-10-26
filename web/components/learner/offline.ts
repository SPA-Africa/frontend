'use client';

// Device storage for things the learner keeps offline (SRS FR-A1.4, FR-A2.9):
// downloaded quizzes, quiz attempts waiting to sync, and agri-market listings created without a connection.
// Every read and write is wrapped because storage can be unavailable (private mode, quota).

import { useEffect, useState } from 'react';
import type { OfflineQuizPackage, QuizSubmission } from '@/lib/api/services/core/lms';
import type { NewListing } from '@/lib/api/services/core/agrimarket';

const read = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  window.dispatchEvent(new Event('spa-offline-store'));
};

/* ---------- quizzes ---------- */
const quizKey = (courseId: string, lessonId: string) => `spa-offline-quiz:${courseId}:${lessonId}`;
const attemptKey = (courseId: string, lessonId: string) => `spa-offline-attempt:${courseId}:${lessonId}`;

export const offlineQuiz = {
  get: (courseId: string, lessonId: string) => read<OfflineQuizPackage | null>(quizKey(courseId, lessonId), null),
  save: (pkg: OfflineQuizPackage) => write(quizKey(pkg.courseId, pkg.lessonId), pkg),
  remove: (courseId: string, lessonId: string) => write(quizKey(courseId, lessonId), undefined),
  pending: (courseId: string, lessonId: string) => read<QuizSubmission | null>(attemptKey(courseId, lessonId), null),
  queue: (courseId: string, lessonId: string, s: QuizSubmission) => write(attemptKey(courseId, lessonId), s),
  clearPending: (courseId: string, lessonId: string) => write(attemptKey(courseId, lessonId), undefined),
};

/* ---------- listings ---------- */
export interface QueuedListing extends NewListing { queueId: string }
const LISTINGS = 'spa-offline-listings';

export const offlineListings = {
  all: () => read<QueuedListing[]>(LISTINGS, []),
  add: (l: NewListing) => {
    const item: QueuedListing = { ...l, queueId: `q-${Date.now().toString(36)}`, createdOfflineAt: new Date().toISOString() };
    write(LISTINGS, [item, ...offlineListings.all()]);
    return item;
  },
  remove: (queueId: string) => write(LISTINGS, offlineListings.all().filter(l => l.queueId !== queueId)),
};

/** Re-render when any offline store changes (this tab or another). */
export function useOfflineStore<T>(get: () => T): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const sync = () => setValue(get());
    sync();
    window.addEventListener('spa-offline-store', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('spa-offline-store', sync); window.removeEventListener('storage', sync); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

/** Browser connection state, with an override so the offline flow can be shown in a demo. */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return [online, setOnline] as const;
}
