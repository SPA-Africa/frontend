// core-svc / authoring: pillar-scoped course authoring and publishing (SRS FR-A2.14, FR-B1.3)
//
// Courses live in the same `courses` table learners read from (lms, catalog). Publishing flips
// `published` so the course appears in the public catalogue and can be enrolled in. The writing
// assistant (`assist`) drafts outlines, reading text and quiz questions with AI; nothing is saved
// until the author saves the course.

import { defineEndpoint, type MockContext, type CallArgs } from '../../define';
import { nowIso } from '../../mock-db';
import { db } from '../../mock/tables';
import { appendAudit, consoleDb, defaultQuiz } from '../../mock/console-tables';
import { aiLearningDb, courseLang, fakeOutline, fakeQuestions, fakeReading, type ReadingContent } from '../../mock/ai-learning-tables';
import { pillarById } from '../../../mock/data';
import type { Course, LessonType, PillarId, QuizQuestion } from '../../../types';

export type { ReadingContent } from '../../mock/ai-learning-tables';

/** A question in the editor. Short questions may carry marking guidance, which learners never see. */
export interface AuthoringQuizQuestion extends QuizQuestion {
  /** short answers: what a good answer includes, up to 1000 characters; used by reviewers and AI feedback */
  guidance?: string;
}

export interface QuizDefinition {
  /** 1..100, percent */
  passMark: number;
  maxRetakes: number;
  questions: AuthoringQuizQuestion[];
}

export type CourseLanguage = Course['language'][number];

export interface AuthoringContext {
  pillarId: PillarId;
  /** Programmes of the pillar, used as the course "programme" options */
  programmes: string[];
  languages: CourseLanguage[];
  /** Platform defaults from settings (FR-A2.9) */
  quizDefaults: { passMark: number; maxRetakes: number };
}

/** Why a course shows up in "needs attention" */
export type CourseFlag = 'draft' | 'no_quiz' | 'no_enrolments' | 'low_completion';

export interface AuthoringCourseRow {
  id: string;
  slug: string;
  title: string;
  program: string;
  pillarId: PillarId;
  level: Course['level'];
  hours: number;
  published: boolean;
  modules: number;
  lessons: number;
  quizzes: number;
  enrolled: number;
  /** completed / enrolled among pillar learners, 0..1 */
  completionRate: number;
  updatedAt: string;
  flags: CourseFlag[];
}

/**
 * A lesson in the editor. Quiz lessons carry their quiz; reading lessons may carry their text.
 * On save, leaving `content` out keeps the stored text and `null` clears it.
 */
export interface AuthoringLesson { id: string; title: string; type: LessonType; minutes: number; quiz?: QuizDefinition; content?: ReadingContent | null }
export interface AuthoringModule { id: string; title: string; lessons: AuthoringLesson[] }

/** Body of create and update. Ids of new modules and lessons may be client-generated. */
export interface CourseDraftInput {
  title: string;
  program: string;
  level: Course['level'];
  hours: number;
  languages: CourseLanguage[];
  summary: string;
  outcomes: string[];
  modules: AuthoringModule[];
}

export interface AuthoringCourse extends CourseDraftInput {
  id: string;
  slug: string;
  pillarId: PillarId;
  published: boolean;
  enrolled: number;
  updatedAt: string;
  publishedAt?: string;
}

/* ---------- helpers ---------- */

type Ctx = MockContext<CallArgs>;

const repPillar = ({ user, fail }: Ctx, requested?: PillarId): PillarId | undefined => {
  if (user?.role === 'pillar_rep') return user.pillarId ?? fail(403, 'no_pillar', 'Your account is not linked to a pillar');
  return requested;
};

const lessonsOf = (c: Course) => c.modules.flatMap(m => m.lessons);
const quizKey = (courseId: string, lessonId: string) => `${courseId}:${lessonId}`;
const quizOf = (courseId: string, lessonId: string): QuizDefinition => consoleDb.quizzes.get()[quizKey(courseId, lessonId)] ?? defaultQuiz();
const readingOf = (courseId: string, lessonId: string) => aiLearningDb.readings.get()[quizKey(courseId, lessonId)];

const MAX_GUIDANCE = 1000;
const READING_LIMITS = { intro: 4000, sections: 30, heading: 200, body: 8000, items: 20, item: 500 };

/** Trimmed reading text, null when empty; 400 reading_too_long past the limits */
function parseReading(ctx: Ctx, c: ReadingContent | null | undefined, lessonTitle: string): ReadingContent | null {
  if (!c) return null;
  const sections = (c.sections ?? []).map(s => {
    const body = s.body?.trim() ?? '';
    const list = (s.list ?? []).map(i => i.trim()).filter(Boolean);
    return { heading: s.heading?.trim() ?? '', ...(body ? { body } : {}), ...(list.length ? { list } : {}) };
  }).filter(s => s.heading || s.body || s.list);
  const intro = c.intro?.trim() ?? '';
  const L = READING_LIMITS;
  if (intro.length > L.intro || sections.length > L.sections || sections.some(s => s.heading.length > L.heading || (s.body?.length ?? 0) > L.body
    || (s.list?.length ?? 0) > L.items || (s.list ?? []).some(i => i.length > L.item))) {
    ctx.fail(400, 'reading_too_long', `The reading text of "${lessonTitle || 'Untitled'}" is too long`);
  }
  return intro || sections.length ? { intro, sections } : null;
}

function loadOwned(ctx: Ctx, id: string): Course {
  const course = db.courses.get().find(c => c.id === id);
  if (!course) return ctx.fail(404, 'course_not_found', 'This course does not exist');
  const pillar = repPillar(ctx);
  if (pillar && course.pillarId !== pillar) return ctx.fail(403, 'other_pillar', 'This course belongs to another pillar');
  return course;
}

function toAuthoring(c: Course): AuthoringCourse {
  const meta = consoleDb.courseMeta.get()[c.id];
  return {
    id: c.id, slug: c.slug, pillarId: c.pillarId, published: c.published, enrolled: c.enrolled,
    title: c.title, program: c.program, level: c.level, hours: c.hours, languages: [...c.language], summary: c.summary, outcomes: [...c.outcomes],
    modules: c.modules.map(m => ({
      ...m,
      lessons: m.lessons.map((l): AuthoringLesson => {
        if (l.type === 'quiz') return { ...l, quiz: quizOf(c.id, l.id) };
        const text = l.type === 'reading' ? readingOf(c.id, l.id) : undefined;
        return text ? { ...l, content: text } : { ...l };
      }),
    })),
    updatedAt: meta?.updatedAt ?? '2026-06-01T08:00:00Z',
    publishedAt: meta?.publishedAt,
  };
}

function toRow(c: Course): AuthoringCourseRow {
  const ls = lessonsOf(c);
  const pillarLearners = db.learners.get().filter(l => l.courseId === c.id);
  const done = pillarLearners.filter(l => l.status === 'completed').length;
  const completionRate = pillarLearners.length ? done / pillarLearners.length : 0;
  const quizzes = ls.filter(l => l.type === 'quiz').length;
  const flags: CourseFlag[] = [];
  if (!c.published) flags.push('draft');
  if (quizzes === 0) flags.push('no_quiz');
  if (c.published && c.enrolled === 0) flags.push('no_enrolments');
  if (pillarLearners.length >= 4 && completionRate < 0.25) flags.push('low_completion');
  return {
    id: c.id, slug: c.slug, title: c.title, program: c.program, pillarId: c.pillarId, level: c.level, hours: c.hours, published: c.published,
    modules: c.modules.length, lessons: ls.length, quizzes, enrolled: c.enrolled, completionRate,
    updatedAt: consoleDb.courseMeta.get()[c.id]?.updatedAt ?? '2026-06-01T08:00:00Z', flags,
  };
}

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'course';

function validateDraft(ctx: Ctx, d: CourseDraftInput, pillarId: PillarId) {
  if (!d.title?.trim() || d.title.trim().length < 5) ctx.fail(400, 'title_required', 'Give the course a title of at least 5 characters');
  if (d.title.trim().length > 120) ctx.fail(400, 'title_too_long', 'Keep the title under 120 characters');
  if (!pillarById[pillarId].programs.includes(d.program)) ctx.fail(400, 'invalid_programme', 'Pick a programme of your pillar');
  if (!(d.hours >= 1 && d.hours <= 200)) ctx.fail(400, 'invalid_hours', 'Learning hours must be between 1 and 200');
  d.modules.forEach(m => m.lessons.forEach(l => {
    if (!(l.minutes >= 1 && l.minutes <= 240)) ctx.fail(400, 'invalid_minutes', `Lesson "${l.title || 'Untitled'}" must last between 1 and 240 minutes`);
    if (l.quiz && !(l.quiz.passMark >= 1 && l.quiz.passMark <= 100)) ctx.fail(400, 'invalid_pass_mark', 'Pass mark must be between 1 and 100');
    if (l.quiz?.questions.some(q => (q.guidance?.trim().length ?? 0) > MAX_GUIDANCE)) ctx.fail(400, 'guidance_too_long', 'Keep the marking guidance under 1000 characters');
    if (l.type === 'reading' && l.content) parseReading(ctx, l.content, l.title);
  }));
}

/** Problems that block publication. Empty when the course can go live. */
export function publishProblems(c: AuthoringCourse | CourseDraftInput): string[] {
  const out: string[] = [];
  if (!c.title.trim()) out.push('title');
  if (!c.summary.trim()) out.push('summary');
  if (c.languages.length === 0) out.push('languages');
  if (!c.outcomes.some(o => o.trim())) out.push('outcomes');
  const lessons = c.modules.flatMap(m => m.lessons);
  if (lessons.length === 0) out.push('lessons');
  if (lessons.some(l => !l.title.trim())) out.push('lesson_titles');
  const questionOk = (q: QuizQuestion) => q.prompt.trim() && (q.type === 'short' || ((q.options ?? []).every(o => o.trim()) && (q.answer ?? []).length > 0));
  if (lessons.some(l => l.type === 'quiz' && (!l.quiz || l.quiz.questions.length === 0 || !l.quiz.questions.every(questionOk)))) out.push('quiz_questions');
  return out;
}

function write(ctx: Ctx, courseId: string, d: CourseDraftInput, base: Course): Course {
  const now = nowIso();
  const course: Course = {
    ...base,
    title: d.title.trim(), program: d.program, level: d.level, hours: d.hours, language: d.languages, summary: d.summary.trim(),
    outcomes: d.outcomes.map(o => o.trim()).filter(Boolean),
    modules: d.modules.map(m => ({ id: m.id, title: m.title.trim() || 'Untitled module', lessons: m.lessons.map(l => ({ id: l.id, title: l.title.trim(), type: l.type, minutes: l.minutes })) })),
  };
  consoleDb.quizzes.update(q => {
    Object.keys(q).filter(k => k.startsWith(`${courseId}:`)).forEach(k => delete q[k]);
    d.modules.forEach(m => m.lessons.forEach(l => {
      if (l.type !== 'quiz' || !l.quiz) return;
      const questions = l.quiz.questions.map(x => {
        const guidance = x.type === 'short' ? x.guidance?.trim() : undefined;
        const { guidance: _drop, ...rest } = x;
        return guidance ? { ...rest, guidance } : rest;
      });
      q[quizKey(courseId, l.id)] = { ...l.quiz, questions };
    }));
  });
  // Reading text: absent keeps what is stored, null clears it; text of removed lessons goes
  const lessonIds = new Set(d.modules.flatMap(m => m.lessons.map(l => l.id)));
  aiLearningDb.readings.update(r => {
    Object.keys(r).filter(k => k.startsWith(`${courseId}:`) && !lessonIds.has(k.slice(courseId.length + 1))).forEach(k => delete r[k]);
    d.modules.forEach(m => m.lessons.forEach(l => {
      if (l.type !== 'reading' || l.content === undefined) return;
      const text = parseReading(ctx, l.content, l.title);
      if (text) r[quizKey(courseId, l.id)] = text; else delete r[quizKey(courseId, l.id)];
    }));
  });
  consoleDb.courseMeta.update(m => { m[courseId] = { ...m[courseId], updatedAt: now }; });
  db.courses.update(list => {
    const i = list.findIndex(c => c.id === courseId);
    if (i >= 0) list[i] = course; else list.push(course);
  });
  return course;
}

/* ---------- endpoints ---------- */

export const getContext = defineEndpoint<AuthoringContext, { query?: { pillar?: PillarId } }>({
  id: 'authoring.context.get', service: 'core', method: 'GET', path: '/authoring/context',
  roles: ['pillar_rep', 'executive_admin'], summary: 'Programmes, languages and quiz defaults for authoring in the caller\'s pillar',
  srs: ['FR-A2.14', 'FR-A2.9'], response: 'AuthoringContext', query: ['pillar?: PillarId (executive_admin only)'],
}, ctx => {
  const pillarId = repPillar(ctx, ctx.args.query?.pillar) ?? 'technology';
  const s = db.settings.get();
  return {
    pillarId, programmes: pillarById[pillarId].programs, languages: ['English', 'French', 'Kinyarwanda'],
    quizDefaults: { passMark: Math.round(s.quizPassMark * 100), maxRetakes: s.maxQuizAttempts },
  };
});

export const listCourses = defineEndpoint<AuthoringCourseRow[], { query?: { pillar?: PillarId; status?: 'published' | 'draft' } }>({
  id: 'authoring.courses.list', service: 'core', method: 'GET', path: '/authoring/courses',
  roles: ['pillar_rep', 'executive_admin'], summary: 'Courses of the caller\'s pillar, drafts included, with structure counts, completion and attention flags',
  srs: ['FR-A2.14', 'FR-B1.3'], response: 'AuthoringCourseRow[]', query: ['pillar?: PillarId (executive_admin only)', 'status?: "published" | "draft"'],
  notes: 'RLS: pillar_rep only sees rows where courses.pillar_id = their pillar; executive_admin bypasses. completionRate = completed / enrolled for the course. Flags: draft, no_quiz, no_enrolments (published with 0 enrolled), low_completion (< 25% with at least 4 learners).',
}, ctx => {
  const pillar = repPillar(ctx, ctx.args.query?.pillar);
  const status = ctx.args.query?.status;
  return db.courses.get()
    .filter(c => !pillar || c.pillarId === pillar)
    .filter(c => !status || (status === 'published') === c.published)
    .map(toRow)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
});

export const getCourse = defineEndpoint<AuthoringCourse, { params: { id: string } }>({
  id: 'authoring.courses.get', service: 'core', method: 'GET', path: '/authoring/courses/:id',
  roles: ['pillar_rep', 'executive_admin'], summary: 'One course with modules, lessons and full quiz content (answers included) for editing',
  srs: ['FR-A2.14'], response: 'AuthoringCourse',
  notes: '404 course_not_found; 403 other_pillar when a pillar_rep opens another pillar\'s course. Quiz answers are only ever returned on this authoring route, never on learner routes.',
}, ctx => toAuthoring(loadOwned(ctx, ctx.args.params.id)));

export const createCourse = defineEndpoint<AuthoringCourse, { body: CourseDraftInput; query?: { pillar?: PillarId } }>({
  id: 'authoring.courses.create', service: 'core', method: 'POST', path: '/authoring/courses',
  roles: ['pillar_rep', 'executive_admin'], summary: 'Create a draft course in the caller\'s pillar',
  srs: ['FR-A2.14', 'FR-B1.3'], request: 'CourseDraftInput', response: 'AuthoringCourse', emits: ['course.created'], offline: true,
  query: ['pillar?: PillarId (executive_admin only)'],
  notes: 'pillar_id is taken from the token for pillar_rep, never from the body. Always created unpublished. Slug is derived from the title and made unique. Validation: title 5 to 120 chars, programme must belong to the pillar, hours 1 to 200, lesson minutes 1 to 240, pass mark 1 to 100.',
}, ctx => {
  const pillarId = repPillar(ctx, ctx.args.query?.pillar) ?? ctx.fail(400, 'pillar_required', 'Choose a pillar');
  const d = ctx.args.body;
  validateDraft(ctx, d, pillarId);
  const taken = new Set(db.courses.get().map(c => c.slug));
  let slug = slugify(d.title), n = 2;
  while (taken.has(slug)) slug = `${slugify(d.title)}-${n++}`;
  const id = `c-${slug}`;
  const course = write(ctx, id, d, { id, slug, pillarId, published: false, enrolled: 0 } as Course);
  appendAudit(ctx.user, 'Created course', course.title, pillarId);
  return toAuthoring(course);
});

export const updateCourse = defineEndpoint<AuthoringCourse, { params: { id: string }; body: CourseDraftInput }>({
  id: 'authoring.courses.update', service: 'core', method: 'PUT', path: '/authoring/courses/:id',
  roles: ['pillar_rep', 'executive_admin'], summary: 'Save the course outline, lessons and quizzes (replaces the whole draft)',
  srs: ['FR-A2.14'], request: 'CourseDraftInput', response: 'AuthoringCourse', emits: ['course.updated'], offline: true,
  notes: 'Same validation as create. When the course is already published, the publish checks also apply and a failing save returns 422 not_publishable, so a live course never becomes incomplete. Lesson ids that disappear remove the lesson; learner progress on removed lessons is kept for audit.',
}, ctx => {
  const base = loadOwned(ctx, ctx.args.params.id);
  validateDraft(ctx, ctx.args.body, base.pillarId);
  if (base.published && publishProblems(ctx.args.body).length) ctx.fail(422, 'not_publishable', 'A published course must stay complete. Fix the highlighted items or unpublish first.');
  const course = write(ctx, base.id, ctx.args.body, base);
  appendAudit(ctx.user, 'Edited course', course.title, course.pillarId);
  return toAuthoring(course);
});

export const publishCourse = defineEndpoint<AuthoringCourse, { params: { id: string } }>({
  id: 'authoring.courses.publish', service: 'core', method: 'POST', path: '/authoring/courses/:id/publish',
  roles: ['pillar_rep', 'executive_admin'], summary: 'Publish a course so learners can find and enrol in it',
  srs: ['FR-A2.14', 'FR-B1.3'], response: 'AuthoringCourse', emits: ['course.published'],
  notes: '422 not_publishable with details.problems (title, summary, languages, outcomes, lessons, lesson_titles, quiz_questions) when incomplete. 409 already_published. On success the course appears in GET /catalog/courses and recommendations.',
}, ctx => {
  const base = loadOwned(ctx, ctx.args.params.id);
  if (base.published) ctx.fail(409, 'already_published', 'This course is already published');
  const problems = publishProblems(toAuthoring(base));
  if (problems.length) ctx.fail(422, 'not_publishable', `This course is not ready: ${problems.join(', ')}`);
  const now = nowIso();
  db.courses.update(list => { const c = list.find(x => x.id === base.id); if (c) c.published = true; });
  consoleDb.courseMeta.update(m => { m[base.id] = { updatedAt: now, publishedAt: now }; });
  appendAudit(ctx.user, 'Published course', base.title, base.pillarId);
  return toAuthoring({ ...base, published: true });
});

export const unpublishCourse = defineEndpoint<AuthoringCourse, { params: { id: string } }>({
  id: 'authoring.courses.unpublish', service: 'core', method: 'POST', path: '/authoring/courses/:id/unpublish',
  roles: ['pillar_rep', 'executive_admin'], summary: 'Hide a course from learners; enrolled learners keep their progress',
  srs: ['FR-A2.14'], response: 'AuthoringCourse', emits: ['course.unpublished'],
  notes: '409 not_published when already a draft. Existing enrolments stay readable for those learners.',
}, ctx => {
  const base = loadOwned(ctx, ctx.args.params.id);
  if (!base.published) ctx.fail(409, 'not_published', 'This course is already a draft');
  db.courses.update(list => { const c = list.find(x => x.id === base.id); if (c) c.published = false; });
  consoleDb.courseMeta.update(m => { m[base.id] = { ...m[base.id], updatedAt: nowIso() }; });
  appendAudit(ctx.user, 'Unpublished course', base.title, base.pillarId);
  return toAuthoring({ ...base, published: false });
});

/* ---------- writing assistant ---------- */

export type AssistTask = 'outline' | 'reading' | 'quiz';

export interface AssistRequest {
  task: AssistTask;
  course: { title: string; summary?: string; outcomes?: string[]; level?: Course['level']; languages?: CourseLanguage[]; program?: string };
  /** reading and quiz: the lesson being written */
  lesson?: { title: string; minutes?: number };
  /** quiz: how many questions, 1 to 10 (default 5) */
  count?: number;
  /** what the course already has, so suggestions do not repeat it */
  existing?: { moduleTitles?: string[]; questionPrompts?: string[] };
}

export interface DraftLesson { title: string; type: LessonType; minutes: number }
export interface DraftModule { title: string; lessons: DraftLesson[] }

export type AssistResult =
  | { task: 'outline'; modules: DraftModule[] }
  | { task: 'reading'; content: ReadingContent }
  | { task: 'quiz'; questions: AuthoringQuizQuestion[] };

const ASSIST_HOURLY_LIMIT = 40;

export const assist = defineEndpoint<AssistResult, { body: AssistRequest; query?: { pillar?: PillarId } }>({
  id: 'authoring.assist', service: 'core', method: 'POST', path: '/authoring/assist',
  roles: ['pillar_rep', 'executive_admin'], summary: 'Writing assistant: an AI draft of a course outline, a reading lesson or quiz questions. Nothing is saved.',
  srs: ['FR-A2.14'], request: 'AssistRequest', response: 'AssistResult', query: ['pillar?: PillarId (executive_admin only)'],
  notes: 'Runs without a database transaction (it waits for Claude, effort medium). Written in the course\'s first language. outline: 3 to 6 modules, each ending with a quiz lesson, minutes 1 to 240. reading: { intro, sections[{ heading, body?, list? }] }. quiz: count questions with server-generated ids, answers within the options, true_false options ["True", "False"], short questions with guidance. 400 invalid_task, title_required, lesson_title_required, invalid_count. 429 ai_rate_limited after AI_AUTHORING_HOURLY_LIMIT drafts per person per hour (default 40). 422 ai_declined when the model declines. 503 ai_unavailable "The writing assistant is not available right now" when AI is off or failing. Only usage is logged; the course is not read or written.',
}, async ({ args, user, fail }) => {
  const b = args.body ?? ({} as AssistRequest);
  if (!['outline', 'reading', 'quiz'].includes(b.task)) fail(400, 'invalid_task', 'Choose what to draft: an outline, reading text or quiz questions');
  const title = b.course?.title?.trim() ?? '';
  if (title.length < 5) fail(400, 'title_required', 'Give the course a title of at least 5 characters');
  const lessonTitle = b.lesson?.title?.trim() ?? '';
  if (b.task !== 'outline' && !lessonTitle) fail(400, 'lesson_title_required', 'Give the lesson a title first');
  const count = b.count ?? 5;
  if (b.task === 'quiz' && !(Number.isInteger(count) && count >= 1 && count <= 10)) fail(400, 'invalid_count', 'Ask for 1 to 10 questions');

  const key = user?.id ?? 'anonymous';
  const hourAgo = Date.now() - 3_600_000;
  const recent = (aiLearningDb.assistUse.get()[key] ?? []).filter(at => Date.parse(at) > hourAgo);
  if (recent.length >= ASSIST_HOURLY_LIMIT) fail(429, 'ai_rate_limited', 'You have used the writing assistant a lot in the last hour. Try again later.');
  aiLearningDb.assistUse.update(u => { u[key] = [...recent, nowIso()]; });
  await new Promise(r => setTimeout(r, 900));

  const lang = courseLang(b.course.languages);
  if (b.task === 'outline') return { task: 'outline', modules: fakeOutline(b.course.outcomes ?? [], lang) };
  if (b.task === 'reading') return { task: 'reading', content: fakeReading(lessonTitle, lang) };
  return { task: 'quiz', questions: fakeQuestions(lessonTitle, lang, count) };
});
