// core-svc / lms: enrolment, lessons, progress, quizzes (SRS FR-A2.1 to FR-A2.10)

import { defineEndpoint } from '../../define';
import { nowIso } from '../../mock-db';
import { db } from '../../mock/tables';
import { learnerDb } from '../../mock/learner-tables';
import type { Certificate, Course, Lesson, PillarId, QuizQuestion, User } from '../../../types';

export interface MyCourse {
  course: Course;
  status: 'enrolled' | 'in_progress' | 'completed';
  /** 0..1 share of lessons completed */
  progress: number;
  lessonsDone: number;
  lessonsTotal: number;
  nextLesson: Lesson | null;
  lastActive: string;
}

const lessonsOf = (c: Course) => c.modules.flatMap(m => m.lessons);

export function toMyCourse(courseId: string): MyCourse | null {
  const course = db.courses.get().find(c => c.id === courseId);
  const learning = db.learning.get();
  const e = learning.enrollments.find(x => x.courseId === courseId);
  if (!course || !e) return null;
  const all = lessonsOf(course);
  const done = learning.completed[courseId] ?? [];
  return {
    course,
    status: e.status,
    progress: all.length ? done.length / all.length : 0,
    lessonsDone: done.length,
    lessonsTotal: all.length,
    nextLesson: all.find(l => !done.includes(l.id)) ?? null,
    lastActive: e.lastActive,
  };
}

export const listMyCourses = defineEndpoint<MyCourse[]>({
  id: 'lms.enrollments.mine', service: 'core', method: 'GET', path: '/lms/enrollments/me',
  roles: ['beneficiary'], summary: 'Courses the learner is enrolled in, with progress and the next lesson, most recent first',
  srs: ['FR-A2.3', 'FR-A2.4'], response: 'MyCourse[]',
}, () => db.learning.get().enrollments
  .map(e => toMyCourse(e.courseId))
  .filter((x): x is MyCourse => !!x)
  .sort((a, b) => b.lastActive.localeCompare(a.lastActive)));

/* ---------- settings ---------- */

export interface LearnerSettings {
  /** 0..1, default 0.7 */
  quizPassMark: number;
  /** default 3 */
  maxQuizAttempts: number;
}

export const getSettings = defineEndpoint<LearnerSettings>({
  id: 'lms.settings.get', service: 'core', method: 'GET', path: '/lms/settings',
  roles: ['authenticated'], summary: 'Quiz rules set by the Executive Office (pass mark, attempts)', srs: ['FR-A2.7', 'FR-A2.8'],
  response: 'LearnerSettings',
}, () => {
  const s = db.settings.get();
  return { quizPassMark: s.quizPassMark, maxQuizAttempts: s.maxQuizAttempts };
});

/* ---------- enrolment ---------- */

export const enrol = defineEndpoint<MyCourse, { body: { courseId: string } }>({
  id: 'lms.enrollments.create', service: 'core', method: 'POST', path: '/lms/enrollments',
  roles: ['beneficiary'], summary: 'Enrol the learner in a published course', srs: ['FR-A2.3'],
  request: '{ courseId: string }', response: 'MyCourse', offline: true, emits: ['enrollment.created'],
  notes: 'Idempotent: enrolling twice returns the existing enrolment. 404 "course_not_found" for unpublished courses.',
}, ({ args, fail }) => {
  const course = db.courses.get().find(c => c.id === args.body.courseId && c.published);
  if (!course) fail(404, 'course_not_found', 'This course is not available');
  const learning = db.learning.get();
  if (!learning.enrollments.some(e => e.courseId === course!.id)) {
    db.learning.update(d => {
      d.enrollments.unshift({ courseId: course!.id, status: 'enrolled', lastLessonId: lessonsOf(course!)[0]?.id ?? '', lastActive: nowIso() });
      d.completed[course!.id] = [];
    });
    db.courses.update(cs => { const c = cs.find(x => x.id === course!.id); if (c) c.enrolled += 1; });
  }
  return toMyCourse(course!.id)!;
});

/* ---------- player ---------- */

export interface QuizState {
  attemptsUsed: number;
  attemptsLeft: number;
  /** best score 0..1 */
  best: number;
  passed: boolean;
}

export interface CoursePlayer {
  course: Course;
  enrollment: { status: MyCourse['status']; lastLessonId: string | null; lastActive: string } | null;
  completedLessonIds: string[];
  /** keyed by quiz lesson id */
  quizzes: Record<string, QuizState>;
  /** saved video positions in seconds, keyed by lesson id */
  videoPositions: Record<string, number>;
  /** set once the course is complete and the certificate issued */
  certificateCode: string | null;
}

const quizKey = (courseId: string, lessonId: string) => `${courseId}:${lessonId}`;

function quizState(courseId: string, lessonId: string): QuizState {
  const max = db.settings.get().maxQuizAttempts;
  const q = db.learning.get().quiz[quizKey(courseId, lessonId)];
  const used = q?.attempts ?? 0;
  return { attemptsUsed: used, attemptsLeft: Math.max(0, max - used), best: q?.best ?? 0, passed: !!q?.passed };
}

function certificateFor(course: Course, user: User | null) {
  return db.certificates.get().find(c => c.holder === user?.name && c.courseTitle === course.title) ?? null;
}

export const getPlayer = defineEndpoint<CoursePlayer, { params: { slug: string } }>({
  id: 'lms.player.get', service: 'core', method: 'GET', path: '/lms/player/:slug',
  roles: ['beneficiary'], summary: 'Everything the course player needs: outline, enrolment, completed lessons, quiz state, resume points',
  srs: ['FR-A2.4', 'FR-A2.5', 'FR-A2.6'], response: 'CoursePlayer',
  notes: '404 "course_not_found" for unknown slugs. Unpublished courses stay readable for learners already enrolled.',
}, ({ args, user, fail }) => {
  const learning = db.learning.get();
  const course = db.courses.get().find(c => c.slug === args.params.slug);
  const e = course && learning.enrollments.find(x => x.courseId === course.id);
  if (!course || (!course.published && !e)) return fail(404, 'course_not_found', 'We could not find this course');
  const positions = learnerDb.videoPositions.get();
  const quizzes: Record<string, QuizState> = {};
  const videoPositions: Record<string, number> = {};
  for (const l of lessonsOf(course)) {
    if (l.type === 'quiz') quizzes[l.id] = quizState(course.id, l.id);
    const p = positions[quizKey(course.id, l.id)];
    if (l.type === 'video' && p) videoPositions[l.id] = p;
  }
  return {
    course,
    enrollment: e ? { status: e.status, lastLessonId: e.lastLessonId || null, lastActive: e.lastActive } : null,
    completedLessonIds: learning.completed[course.id] ?? [],
    quizzes,
    videoPositions,
    certificateCode: certificateFor(course, user)?.code ?? null,
  };
});

export const setResumePoint = defineEndpoint<void, { params: { courseId: string }; body: { lastLessonId: string } }>({
  id: 'lms.enrollments.resume', service: 'core', method: 'PATCH', path: '/lms/enrollments/:courseId',
  roles: ['beneficiary'], summary: 'Remember the lesson the learner opened last', srs: ['FR-A2.5'],
  request: '{ lastLessonId: string }', response: 'void', offline: true,
}, ({ args, fail }) => {
  const learning = db.learning.get();
  if (!learning.enrollments.some(e => e.courseId === args.params.courseId)) fail(404, 'not_enrolled', 'You are not enrolled in this course');
  db.learning.update(d => {
    const e = d.enrollments.find(x => x.courseId === args.params.courseId)!;
    e.lastLessonId = args.body.lastLessonId;
    e.lastActive = nowIso();
  });
});

/* ---------- lesson content ---------- */

export type LessonContent =
  | { type: 'video'; lessonId: string; durationSec: number; sources: { quality: '360p' | '480p' | '720p'; url: string; sizeMb: number }[] }
  | { type: 'reading'; lessonId: string; intro: string; sections: { heading: string; body?: string; list?: string[] }[] }
  | { type: 'pdf'; lessonId: string; fileName: string; sizeMb: number; pages: number; downloadUrl: string }
  | { type: 'quiz'; lessonId: string };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const getLessonContent = defineEndpoint<LessonContent, { params: { courseId: string; lessonId: string } }>({
  id: 'lms.lessons.get', service: 'core', method: 'GET', path: '/lms/courses/:courseId/lessons/:lessonId',
  roles: ['beneficiary'], summary: 'Content for one lesson: video sources, reading text or PDF link', srs: ['FR-A2.4', 'NFR-BW.3'],
  response: 'LessonContent',
  notes: 'Enrolled learners only (403 "not_enrolled"). Video and PDF URLs are short-lived signed /media links to MinIO. Offer 360p, 480p and 720p renditions.',
}, ({ args, fail }) => {
  const { courseId, lessonId } = args.params;
  const course = db.courses.get().find(c => c.id === courseId);
  const lesson = course && lessonsOf(course).find(l => l.id === lessonId);
  if (!course || !lesson) return fail(404, 'lesson_not_found', 'We could not find this lesson');
  if (!db.learning.get().enrollments.some(e => e.courseId === courseId)) return fail(403, 'not_enrolled', 'Enrol in this course to open its lessons');
  const media = `/media/courses/${course.slug}/${lesson.id}`;
  switch (lesson.type) {
    case 'video':
      return {
        type: 'video', lessonId, durationSec: lesson.minutes * 60,
        sources: (['360p', '480p', '720p'] as const).map((quality, i) => ({ quality, url: `${media}/${quality}.mp4`, sizeMb: Math.round(lesson.minutes * [2.2, 4.1, 7.8][i]) })),
      };
    case 'pdf':
      return { type: 'pdf', lessonId, fileName: `${slugify(lesson.title)}.pdf`, sizeMb: 0.8, pages: Math.max(2, Math.round(lesson.minutes / 2)), downloadUrl: `${media}/${slugify(lesson.title)}.pdf` };
    case 'quiz':
      return { type: 'quiz', lessonId };
    default:
      return {
        type: 'reading', lessonId,
        intro: `This reading is part of ${course.title}. Take your time, and come back to it whenever you like. Everything here works on a slow connection.`,
        sections: [
          { heading: 'Why this matters', body: `${lesson.title} is one of the building blocks of this course. People who practise it regularly make better decisions and save time in their daily work. The ideas below are short on purpose so that you can try them the same day.` },
          { heading: 'Three ideas to remember', list: ['Start small and test with real people before you invest a lot of time or money.', 'Write things down. A short note today is worth more than a perfect plan next month.', 'Ask for feedback early, and thank people who give it, even when it is hard to hear.'] },
          { heading: 'Try it now', body: 'Pick one idea from this page and apply it to something you are working on this week. Note what happened in two or three sentences. You will use this note in the next quiz.' },
        ],
      };
  }
});

/* ---------- progress ---------- */

export interface ProgressUpdate {
  courseId: string;
  status: MyCourse['status'];
  progress: number;
  completedLessonIds: string[];
  courseCompleted: boolean;
  /** issued by this call when the course has just been completed */
  certificate: Certificate | null;
}

const pillarCode: Record<PillarId, string> = { technology: 'TEC', education: 'EDU', leadership: 'LDR', young_startups: 'STR', agriculture: 'AGR' };

/** Marks a lesson done, updates the enrolment and issues a certificate when the course is finished. */
function recordLessonDone(course: Course, lessonId: string, user: User | null): ProgressUpdate {
  const all = lessonsOf(course);
  const learning = db.learning.update(d => {
    const done = new Set(d.completed[course.id] ?? []);
    done.add(lessonId);
    d.completed[course.id] = all.filter(l => done.has(l.id)).map(l => l.id);
    const finished = done.size >= all.length;
    const e = d.enrollments.find(x => x.courseId === course.id);
    if (e) { e.status = finished ? 'completed' : 'in_progress'; e.lastLessonId = lessonId; e.lastActive = nowIso(); }
  });
  const completedLessonIds = learning.completed[course.id] ?? [];
  const quizzesPassed = all.filter(l => l.type === 'quiz').every(l => learning.quiz[quizKey(course.id, l.id)]?.passed);
  const courseCompleted = completedLessonIds.length >= all.length && quizzesPassed;
  let certificate: Certificate | null = null;
  if (courseCompleted && user && !certificateFor(course, user)) {
    certificate = {
      code: `SPA-${pillarCode[course.pillarId]}-${new Date().getFullYear()}-${String(1000 + Math.floor(Math.random() * 8999))}`,
      holder: user.name, courseTitle: course.title, pillarId: course.pillarId, issuedAt: nowIso().slice(0, 10), status: 'valid',
    };
    db.certificates.update(cs => { cs.unshift(certificate!); });
  }
  const status = learning.enrollments.find(x => x.courseId === course.id)?.status ?? 'in_progress';
  return { courseId: course.id, status, progress: all.length ? completedLessonIds.length / all.length : 0, completedLessonIds, courseCompleted, certificate };
}

function enrolledLesson(courseId: string, lessonId: string, fail: (s: number, c: string, m: string) => never) {
  const course = db.courses.get().find(c => c.id === courseId);
  const lesson = course && lessonsOf(course).find(l => l.id === lessonId);
  if (!course || !lesson) return fail(404, 'lesson_not_found', 'We could not find this lesson');
  if (!db.learning.get().enrollments.some(e => e.courseId === courseId)) return fail(403, 'not_enrolled', 'Enrol in this course first');
  return { course, lesson };
}

export const completeLesson = defineEndpoint<ProgressUpdate, { params: { courseId: string; lessonId: string } }>({
  id: 'lms.lessons.complete', service: 'core', method: 'POST', path: '/lms/courses/:courseId/lessons/:lessonId/complete',
  roles: ['beneficiary'], summary: 'Mark a video, reading or PDF lesson as complete', srs: ['FR-A2.4', 'FR-A2.10'],
  response: 'ProgressUpdate', offline: true, emits: ['lesson.completed', 'course.completed', 'certificate.issued'],
  notes: 'Quiz lessons are completed only by passing the quiz (400 "quiz_requires_pass"). When every lesson is done and every quiz passed, issue the certificate in the same transaction.',
}, ({ args, user, fail }) => {
  const { course, lesson } = enrolledLesson(args.params.courseId, args.params.lessonId, fail);
  if (lesson.type === 'quiz') fail(400, 'quiz_requires_pass', 'Pass the quiz to complete this lesson');
  return recordLessonDone(course, lesson.id, user);
});

export const saveVideoPosition = defineEndpoint<void, { params: { courseId: string; lessonId: string }; body: { seconds: number } }>({
  id: 'lms.lessons.position', service: 'core', method: 'PUT', path: '/lms/courses/:courseId/lessons/:lessonId/position',
  roles: ['beneficiary'], summary: 'Save where the learner stopped a video so it can resume there', srs: ['FR-A2.5'],
  request: '{ seconds: number }', response: 'void', offline: true,
  notes: 'Called every 15 seconds while playing and on pause. Last write wins.',
}, ({ args, fail }) => {
  const { course, lesson } = enrolledLesson(args.params.courseId, args.params.lessonId, fail);
  learnerDb.videoPositions.update(d => { d[quizKey(course.id, lesson.id)] = Math.max(0, Math.round(args.body.seconds)); });
});

/* ---------- quizzes ---------- */

/** A question as the learner sees it. Answer keys never leave the server. */
export interface LearnerQuestion { id: string; type: QuizQuestion['type']; prompt: string; options?: string[] }

export interface Quiz extends QuizState {
  courseId: string;
  lessonId: string;
  title: string;
  questions: LearnerQuestion[];
  passMark: number;
  maxAttempts: number;
}

export interface QuizSubmission {
  /** option indexes for objective questions, text for short answers */
  answers: Record<string, number[] | string>;
  /** true when the attempt was taken offline and replayed */
  offline?: boolean;
  startedAt?: string;
}

export interface QuestionFeedback {
  questionId: string;
  result: 'correct' | 'incorrect' | 'review';
  /** only revealed once the quiz is passed or no attempts are left */
  correctOptions?: number[];
}

export interface QuizResult extends QuizState {
  /** objective questions only, 0..1 */
  score: number;
  passMark: number;
  feedback: QuestionFeedback[];
  courseCompleted: boolean;
  certificate: Certificate | null;
}

export interface OfflineQuizPackage extends Quiz {
  downloadedAt: string;
  /** replays after this time are rejected */
  expiresAt: string;
}

const questionsFor = (courseId: string, lessonId: string) => {
  const bank = learnerDb.quizBank.get();
  return bank[quizKey(courseId, lessonId)] ?? bank.default ?? [];
};
const strip = (q: QuizQuestion): LearnerQuestion => ({ id: q.id, type: q.type, prompt: q.prompt, options: q.options });

function quizFor(courseId: string, lessonId: string, fail: (s: number, c: string, m: string) => never): Quiz {
  const { course, lesson } = enrolledLesson(courseId, lessonId, fail);
  if (lesson.type !== 'quiz') fail(400, 'not_a_quiz', 'This lesson is not a quiz');
  const s = db.settings.get();
  return {
    courseId: course.id, lessonId: lesson.id, title: lesson.title,
    questions: questionsFor(course.id, lesson.id).map(strip),
    passMark: s.quizPassMark, maxAttempts: s.maxQuizAttempts,
    ...quizState(course.id, lesson.id),
  };
}

export const getQuiz = defineEndpoint<Quiz, { params: { courseId: string; lessonId: string } }>({
  id: 'lms.quizzes.get', service: 'core', method: 'GET', path: '/lms/courses/:courseId/quizzes/:lessonId',
  roles: ['beneficiary'], summary: 'Quiz questions (without answers) with the pass mark and attempts left', srs: ['FR-A2.6', 'FR-A2.8'],
  response: 'Quiz', notes: 'Never include answer keys. Pass mark and attempts come from platform settings.',
}, ({ args, fail }) => quizFor(args.params.courseId, args.params.lessonId, fail));

export const downloadQuiz = defineEndpoint<OfflineQuizPackage, { params: { courseId: string; lessonId: string } }>({
  id: 'lms.quizzes.offline', service: 'core', method: 'GET', path: '/lms/courses/:courseId/quizzes/:lessonId/offline',
  roles: ['beneficiary'], summary: 'Download a quiz to take offline; answers are graded when the attempt syncs', srs: ['FR-A2.9'],
  response: 'OfflineQuizPackage',
  notes: 'Valid for 7 days. Grading stays server-side: the package has no answer keys. The synced attempt is sent to POST .../attempts with offline=true.',
}, ({ args, fail }) => {
  const quiz = quizFor(args.params.courseId, args.params.lessonId, fail);
  return { ...quiz, downloadedAt: nowIso(), expiresAt: new Date(Date.now() + 7 * 864e5).toISOString() };
});

export const submitQuiz = defineEndpoint<QuizResult, { params: { courseId: string; lessonId: string }; body: QuizSubmission }>({
  id: 'lms.quizzes.submit', service: 'core', method: 'POST', path: '/lms/courses/:courseId/quizzes/:lessonId/attempts',
  roles: ['beneficiary'], summary: 'Submit a quiz attempt; objective questions are graded at once, short answers go to review',
  srs: ['FR-A2.6', 'FR-A2.7', 'FR-A2.8', 'FR-A2.9', 'FR-A2.10'], request: 'QuizSubmission', response: 'QuizResult', offline: true,
  emits: ['quiz.completed', 'course.completed', 'certificate.issued'],
  notes: '409 "attempts_exhausted" after the maximum attempts (default 3). 400 "incomplete" when a question is unanswered. Reveal correct options only when passed or no attempts are left. A pass completes the quiz lesson and may issue the certificate.',
}, ({ args, user, fail }) => {
  const { courseId, lessonId } = args.params;
  const quiz = quizFor(courseId, lessonId, fail);
  if (quiz.attemptsLeft <= 0) fail(409, 'attempts_exhausted', 'You have used all your attempts for this quiz');
  const answers = args.body.answers ?? {};
  const questions = questionsFor(courseId, lessonId);
  const missing = questions.some(q => {
    const a = answers[q.id];
    return q.type === 'short' ? typeof a !== 'string' || !a.trim() : !Array.isArray(a) || a.length === 0;
  });
  if (missing) fail(400, 'incomplete', 'Please answer every question');

  let correct = 0, objective = 0;
  const graded = questions.map(q => {
    if (q.type === 'short') return { questionId: q.id, result: 'review' as const, key: undefined };
    objective++;
    const given = [...(answers[q.id] as number[])].sort();
    const want = [...(q.answer ?? [])].sort();
    const ok = given.length === want.length && given.every((v, i) => v === want[i]);
    if (ok) correct++;
    return { questionId: q.id, result: ok ? 'correct' as const : 'incorrect' as const, key: q.answer };
  });
  const score = objective ? correct / objective : 1;
  const passed = score >= quiz.passMark;

  const key = quizKey(courseId, lessonId);
  db.learning.update(d => {
    const prev = d.quiz[key] ?? { attempts: 0, best: 0, passed: false };
    d.quiz[key] = { attempts: prev.attempts + 1, best: Math.max(prev.best, score), passed: prev.passed || passed };
  });
  learnerDb.quizAttempts.update(d => { (d[key] ??= []).push({ at: nowIso(), score, passed, offline: !!args.body.offline }); });

  const state = quizState(courseId, lessonId);
  const reveal = passed || state.attemptsLeft === 0;
  const progress = passed ? recordLessonDone(db.courses.get().find(c => c.id === courseId)!, lessonId, user) : null;
  return {
    ...state, score, passMark: quiz.passMark,
    feedback: graded.map(g => ({ questionId: g.questionId, result: g.result, ...(reveal && g.key ? { correctOptions: g.key } : {}) })),
    courseCompleted: !!progress?.courseCompleted,
    certificate: progress?.certificate ?? null,
  };
});
