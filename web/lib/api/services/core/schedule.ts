// core-svc / schedule: live sessions, deadlines and events for learners

import { defineEndpoint } from '../../define';
import { db } from '../../mock/tables';
import { learnerDb } from '../../mock/learner-tables';

export interface ScheduleItem {
  id: string;
  kind: 'live' | 'deadline' | 'event';
  title: string;
  courseId: string | null;
  startsAt: string; // ISO datetime, UTC
  minutes: number;
  /** Live sessions only. Revealed 15 minutes before start. */
  joinUrl?: string;
}

/** How early the Join link opens before a live session starts. */
export const JOIN_WINDOW_MINUTES = 15;

const joinOpen = (s: { startsAt: string; minutes: number }, now = Date.now()) => {
  const start = new Date(s.startsAt).getTime();
  return now >= start - JOIN_WINDOW_MINUTES * 60_000 && now <= start + s.minutes * 60_000;
};

const allSessions = (): ScheduleItem[] => [...db.sessions.get(), ...learnerDb.extraSessions.get()];

export const listUpcoming = defineEndpoint<ScheduleItem[], { query?: { from?: string; to?: string; limit?: number } }>({
  id: 'schedule.upcoming', service: 'core', method: 'GET', path: '/schedule/me',
  roles: ['beneficiary'], summary: 'Upcoming live sessions, deadlines and events for the learner, soonest first',
  response: 'ScheduleItem[]', query: ['from?: ISO date (default now)', 'to?: ISO date', 'limit?: number'],
  notes: 'Only items for courses the learner is enrolled in, plus platform-wide deadlines and events. Leave joinUrl out until 15 minutes before start. A live session still running counts as upcoming.',
}, ({ args }) => {
  const enrolled = new Set(db.learning.get().enrollments.map(e => e.courseId));
  const from = args.query?.from ?? '2026-10-24T00:00:00Z';
  const to = args.query?.to;
  const items = allSessions()
    .filter(s => (!s.courseId || enrolled.has(s.courseId))
      && new Date(s.startsAt).getTime() + s.minutes * 60_000 >= new Date(from).getTime()
      && (!to || s.startsAt <= to))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map(s => (s.kind === 'live' && !joinOpen(s) ? { ...s, joinUrl: undefined } : s));
  return args.query?.limit ? items.slice(0, args.query.limit) : items;
});

export const join = defineEndpoint<{ joinUrl: string }, { params: { id: string } }>({
  id: 'schedule.sessions.join', service: 'core', method: 'POST', path: '/schedule/sessions/:id/join',
  roles: ['beneficiary'], summary: 'Get the join link for a live session and record attendance', response: '{ joinUrl: string }',
  emits: ['session.joined'],
  notes: '409 "too_early" more than 15 minutes before start, 410 "session_ended" after it ends. Attendance feeds M&E participation metrics.',
}, ({ args, fail }) => {
  const s = allSessions().find(x => x.id === args.params.id && x.kind === 'live');
  if (!s?.joinUrl) return fail(404, 'session_not_found', 'We could not find this session');
  const start = new Date(s.startsAt).getTime();
  if (Date.now() < start - JOIN_WINDOW_MINUTES * 60_000) return fail(409, 'too_early', 'This session opens 15 minutes before it starts');
  if (Date.now() > start + s.minutes * 60_000) return fail(410, 'session_ended', 'This session has ended');
  return { joinUrl: s.joinUrl };
});
