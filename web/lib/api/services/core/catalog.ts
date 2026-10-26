// core-svc / catalog: the public course catalogue (SRS FR-A2.1, FR-A2.2)

import { defineEndpoint, paginate, type Page } from '../../define';
import { db } from '../../mock/tables';
import { pillars as pillarSeed } from '../../../mock/data';
import type { Course, Pillar, PillarId } from '../../../types';

export type CatalogQuery = {
  q?: string;
  pillar?: PillarId;
  level?: Course['level'];
  language?: Course['language'][number];
  page?: number;
  pageSize?: number;
};

export const listPillars = defineEndpoint<Pillar[]>({
  id: 'catalog.pillars.list', service: 'core', method: 'GET', path: '/catalog/pillars',
  roles: ['public'], summary: 'The five pillars with their programmes, for filters and sign-up', srs: ['FR-A2.1'], response: 'Pillar[]',
}, () => pillarSeed);

export const listCourses = defineEndpoint<Page<Course>, { query?: CatalogQuery }>({
  id: 'catalog.courses.list', service: 'core', method: 'GET', path: '/catalog/courses',
  roles: ['public'], summary: 'Published courses, most popular first', srs: ['FR-A2.1', 'NFR-BW.5'],
  response: 'Page<Course>', paginated: true,
  query: ['q?: string (title, summary, programme)', 'pillar?: PillarId', "level?: 'Beginner' | 'Intermediate' | 'Advanced'", "language?: 'English' | 'French' | 'Kinyarwanda'", 'page?: number', 'pageSize?: number (default 12)'],
  notes: 'Only published courses. Cache publicly for 5 minutes; invalidate on course.published.',
}, ({ args }) => {
  const q = args.query ?? {};
  const term = q.q?.trim().toLowerCase();
  const items = db.courses.get()
    .filter(c => c.published
      && (!term || [c.title, c.summary, c.program].some(s => s.toLowerCase().includes(term)))
      && (!q.pillar || c.pillarId === q.pillar)
      && (!q.level || c.level === q.level)
      && (!q.language || c.language.includes(q.language)))
    .sort((a, b) => b.enrolled - a.enrolled);
  return paginate(items, q, 12);
});

export const getCourse = defineEndpoint<Course, { params: { slug: string } }>({
  id: 'catalog.courses.get', service: 'core', method: 'GET', path: '/catalog/courses/:slug',
  roles: ['public'], summary: 'One published course with its outline and outcomes', srs: ['FR-A2.2'], response: 'Course',
  notes: 'Return 404 "course_not_found" for unknown or unpublished slugs. Lesson content is not included.',
}, ({ args, fail }) => {
  const c = db.courses.get().find(x => x.slug === args.params.slug && x.published);
  return c ?? fail(404, 'course_not_found', 'We could not find this course');
});
