// ai-svc / recommendations: course recommendations (SRS FR-A2.15)

import { defineEndpoint } from '../../define';
import { db } from '../../mock/tables';
import { learnerDb, profileFor } from '../../mock/learner-tables';
import type { Course } from '../../../types';

export interface Recommendation { course: Course; reason: string }

export const forMe = defineEndpoint<Recommendation[], { query?: { limit?: number } }>({
  id: 'recommendations.courses', service: 'ai', method: 'GET', path: '/recommendations/courses',
  roles: ['beneficiary'], summary: 'Courses to suggest next, with a short human-readable reason',
  srs: ['FR-A2.15', 'NFR-COMPLY.2'], response: 'Recommendation[]', query: ['limit?: number (default 3)'],
  notes: 'Return an empty list when the learner has not consented to AI recommendations. Skip courses the learner dismissed. Reasons are in the Accept-Language locale.',
}, ({ args, user }) => {
  if (user && !profileFor(user).consents.aiRecommendations) return [];
  const interests = new Set(user ? profileFor(user).pillars : []);
  const dismissed = new Set(learnerDb.dismissedRecommendations.get());
  const enrolled = new Set(db.learning.get().enrollments.map(e => e.courseId));
  const mine = db.courses.get().filter(c => enrolled.has(c.id));
  const takenPillars = new Set(mine.map(c => c.pillarId));
  return db.courses.get()
    .filter(c => c.published && !enrolled.has(c.id) && !dismissed.has(c.id))
    .sort((a, b) => Number(takenPillars.has(a.pillarId)) - Number(takenPillars.has(b.pillarId))
      || Number(interests.has(b.pillarId)) - Number(interests.has(a.pillarId))
      || b.enrolled - a.enrolled)
    .slice(0, args.query?.limit ?? 3)
    .map(course => ({ course, reason: takenPillars.has(course.pillarId) ? `More in ${course.program}` : 'A pillar you have not tried yet' }));
});

export const dismiss = defineEndpoint<void, { params: { courseId: string } }>({
  id: 'recommendations.courses.dismiss', service: 'ai', method: 'POST', path: '/recommendations/courses/:courseId/dismiss',
  roles: ['beneficiary'], summary: 'Hide a suggested course and use it as negative feedback', srs: ['FR-A2.15'], response: 'void',
}, ({ args }) => { learnerDb.dismissedRecommendations.update(d => (d.includes(args.params.courseId) ? d : [...d, args.params.courseId])); });
