// core-svc / learners: pillar-scoped learner directory for representatives (SRS FR-B1.3, FR-B3.9)

import { defineEndpoint, paginate, type Page } from '../../define';
import { db } from '../../mock/tables';
import { isYouth, type AgeBand, type Gender } from '../../../mock/internal';
import type { EnrollmentStatus, PillarId } from '../../../types';

export type { AgeBand, Gender } from '../../../mock/internal';

/** One enrolment of a learner in a pillar course. No contact details (FR-B1.3). */
export interface PillarLearner {
  id: string;
  name: string;
  country: string;
  gender: Gender;
  ageBand: AgeBand;
  /** 15 to 35 */
  youth: boolean;
  courseId: string;
  courseTitle: string;
  progress: number;
  status: EnrollmentStatus;
}

/** Inclusion figures for the filtered set (FR-B3.9). Shares are 0..1. */
export interface InclusionSummary {
  total: number;
  women: number;
  youth: number;
  completed: number;
  womenShare: number;
  youthShare: number;
  completionRate: number;
  /** minimum share the plan asks for, per group */
  minimumShare: number;
  byStatus: Record<EnrollmentStatus, number>;
  byAge: Record<AgeBand, number>;
}

export interface LearnerPage extends Page<PillarLearner> { summary: InclusionSummary }

export type LearnerQuery = {
  pillar?: PillarId;
  q?: string;
  courseId?: string;
  gender?: Gender;
  ageBand?: AgeBand;
  status?: EnrollmentStatus;
  page?: number;
  pageSize?: number;
};

export function summarise(rows: PillarLearner[]): InclusionSummary {
  const n = rows.length || 1;
  const women = rows.filter(r => r.gender === 'Female').length;
  const youth = rows.filter(r => r.youth).length;
  const completed = rows.filter(r => r.status === 'completed').length;
  const count = <K extends string>(keys: K[], get: (r: PillarLearner) => K) =>
    Object.fromEntries(keys.map(k => [k, rows.filter(r => get(r) === k).length])) as Record<K, number>;
  return {
    total: rows.length, women, youth, completed,
    womenShare: women / n, youthShare: youth / n, completionRate: completed / n, minimumShare: 0.5,
    byStatus: count<EnrollmentStatus>(['enrolled', 'in_progress', 'completed', 'dropped'], r => r.status),
    byAge: count<AgeBand>(['15 to 24', '25 to 35', '36 and over'], r => r.ageBand),
  };
}

export const listLearners = defineEndpoint<LearnerPage, { query?: LearnerQuery }>({
  id: 'learners.list', service: 'core', method: 'GET', path: '/learners',
  roles: ['pillar_rep', 'executive_admin'], summary: 'Learners enrolled in the caller\'s pillar courses, filtered and paged, with inclusion shares for the filtered set',
  srs: ['FR-B1.3', 'FR-B3.9', 'NFR-BW.5'], response: 'LearnerPage', paginated: true,
  query: ['pillar?: PillarId (executive_admin only)', 'q?: string (name or country)', 'courseId?: string', 'gender?: "Female" | "Male"', 'ageBand?: "15 to 24" | "25 to 35" | "36 and over"', 'status?: EnrollmentStatus', 'page?: number', 'pageSize?: number (default 20, max 100)'],
  notes: 'RLS on enrolments joined to courses.pillar_id. Never return email, phone or date of birth to pillar_rep: age is bucketed into ageBand server-side. summary is computed over all filtered rows, not just the current page.',
}, ({ args, user }) => {
  const qy = args.query ?? {};
  const pillar = user?.role === 'pillar_rep' ? user.pillarId : qy.pillar;
  const titles = Object.fromEntries(db.courses.get().map(c => [c.id, c.title]));
  const needle = qy.q?.trim().toLowerCase();
  const rows: PillarLearner[] = db.learners.get()
    .filter(l => !pillar || l.pillarId === pillar)
    .filter(l => (!qy.courseId || l.courseId === qy.courseId) && (!qy.gender || l.gender === qy.gender) && (!qy.ageBand || l.ageBand === qy.ageBand) && (!qy.status || l.status === qy.status))
    .filter(l => !needle || `${l.name} ${l.country}`.toLowerCase().includes(needle))
    .map(l => ({ id: l.id, name: l.name, country: l.country, gender: l.gender, ageBand: l.ageBand, youth: isYouth(l.ageBand), courseId: l.courseId, courseTitle: titles[l.courseId] ?? l.courseId, progress: l.progress, status: l.status }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const size = Math.min(100, Number(qy.pageSize ?? 20));
  return { ...paginate(rows, { ...qy, pageSize: size }), summary: summarise(rows) };
});
