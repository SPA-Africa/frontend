// Mock tables and fake AI for the learning AI features (SRS FR-A2.6, FR-A2.14): reading text written in
// the course editor, short quiz answers with AI feedback and Pillar Representative reviews, and the
// writing assistant's drafts. Mirrors the backend's AI_PROVIDER=fake so mock and live demos agree:
// lms.short_answer_reviews, course_lessons.content and AuthoringAssistService.

import { mockId, mockTable } from '../mock-db';
import { courses } from '../../mock/data';
import type { LessonType, PillarId, QuizQuestion } from '../../types';

export type Lang = 'en' | 'fr' | 'rw';
export type Verdict = 'meets' | 'partly' | 'not_yet';
export type AiStatus = 'pending' | 'done' | 'failed' | 'off';
export interface ReadingContent { intro: string; sections: { heading: string; body?: string; list?: string[] }[] }

export interface StoredReview {
  id: string;
  /** groups the short answers of one attempt */
  attemptId: string;
  /** answers of the signed-in demo learner, shown back in their quiz */
  mine: boolean;
  learnerName: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  pillarId: PillarId;
  lessonId: string;
  lessonTitle: string;
  questionId: string;
  prompt: string;
  guidance: string | null;
  answer: string;
  /** language the learner reads feedback in */
  lang: Lang;
  /** the fake AI "answers" once this time has passed */
  aiReadyAt: string | null;
  ai: { status: AiStatus; verdict: Verdict | null; feedback: string | null };
  final: { verdict: Verdict; feedback: string; reviewerName: string; reviewedAt: string } | null;
  submittedAt: string;
}

/** Locale the UI runs in: the mock's stand-in for Accept-Language */
export const mockLocale = (): Lang => {
  const l = typeof document !== 'undefined' ? document.documentElement.lang : 'en';
  return l === 'fr' || l === 'rw' ? l : 'en';
};

/* ---------- fake short-answer feedback (same rules as the backend's fake provider) ---------- */

const FEEDBACK: Record<Lang, Record<Verdict, string>> = {
  en: {
    meets: 'Clear answer that covers the main point of the question. To make it even stronger, add one example from your own work or community.',
    partly: 'You are on the right track. Explain your idea in a little more detail and say how you would put it into practice.',
    not_yet: 'Thank you for answering. Read the question again and focus on what it asks, then add one concrete example.',
  },
  fr: {
    meets: 'Réponse claire qui couvre l’essentiel de la question. Pour la renforcer, ajoutez un exemple tiré de votre travail ou de votre communauté.',
    partly: 'Vous êtes sur la bonne voie. Développez un peu votre idée et dites comment vous la mettriez en pratique.',
    not_yet: 'Merci pour votre réponse. Relisez la question, concentrez-vous sur ce qu’elle demande, puis ajoutez un exemple concret.',
  },
  rw: {
    meets: 'Igisubizo gisobanutse kandi gisubiza ikibazo neza. Kugira ngo kirusheho kuba cyiza, ongeraho urugero rwo mu kazi kawe cyangwa mu muryango wawe.',
    partly: 'Uri mu nzira nziza. Sobanura igitekerezo cyawe birushijeho kandi uvuge uko wagishyira mu bikorwa.',
    not_yet: 'Urakoze gusubiza. Ongera usome ikibazo, wibande ku cyo kibaza, hanyuma wongereho urugero rufatika.',
  },
};

/** Overlap with the marking guidance, else answer length */
export function fakeFeedback(answer: string, guidance: string | null, lang: Lang): { verdict: Verdict; feedback: string } {
  const words = (s: string) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(w => w.length >= 4));
  const given = words(answer);
  const key = guidance ? [...words(guidance)] : [];
  let verdict: Verdict;
  if (key.length) {
    const share = key.filter(w => given.has(w)).length / key.length;
    verdict = share >= 0.5 ? 'meets' : share >= 0.2 ? 'partly' : 'not_yet';
  } else {
    verdict = answer.trim().length >= 120 ? 'meets' : answer.trim().length >= 40 ? 'partly' : 'not_yet';
  }
  return { verdict, feedback: FEEDBACK[lang][verdict] };
}

/** Pending AI feedback is ready after a few seconds, like the real call */
export function settle(r: StoredReview): StoredReview {
  if (r.ai.status !== 'pending' || !r.aiReadyAt || Date.parse(r.aiReadyAt) > Date.now()) return r;
  const out = fakeFeedback(r.answer, r.guidance, r.lang);
  return { ...r, ai: { status: 'done', verdict: out.verdict, feedback: out.feedback } };
}

/* ---------- seed: answers from the pillar directory learners ---------- */

const PROMPT = 'In one or two sentences, describe a task in your work you could automate.';
const daysAgo = (d: number, h = 9) => new Date(Date.UTC(2026, 9, 27 - d, h)).toISOString();

function seedReviews(): StoredReview[] {
  const rows: [string, string, number, string, AiStatus, StoredReview['final']][] = [
    ['Nadia Mukeshimana', 'c-ai-foundations', 0, 'Every Friday I copy attendance numbers from paper into a report for my manager. A simple form on the phone could fill the spreadsheet for me, and I would check the totals before sending.', 'done', null],
    ['Fatou Diallo', 'c-ai-foundations', 1, 'Emails.', 'done', null],
    ['Kevin Ndayishimiye', 'c-ai-foundations', 0, 'Sorting customer messages by topic so the urgent ones get answered first.', 'done',
      { verdict: 'partly', feedback: 'Good choice of task. Say which tool you would use and how you would check that urgent messages are not missed.', reviewerName: 'Grace Ineza', reviewedAt: daysAgo(1, 15) }],
    ['Amina Said', 'c-digital-marketing', 0, 'Posting the same product photo on three social media pages every morning. A scheduling tool could post it for me at the best time.', 'failed', null],
    ['Josiane Mutoni', 'c-teaching-digital', 0, 'Marking the weekly spelling test. Learners could answer on a shared phone form that marks itself, and I would look at the common mistakes.', 'done', null],
    ['Brian Otieno', 'c-emerging-leaders', 0, 'Reminding my team about meetings.', 'done', null],
  ];
  return rows.map(([learnerName, courseId, quizIndex, answer, status, final], i) => {
    const c = courses.find(x => x.id === courseId)!;
    const quiz = c.modules.flatMap(m => m.lessons).filter(l => l.type === 'quiz')[quizIndex] ?? c.modules[0].lessons[0];
    const ai = status === 'done' ? { status, ...fakeFeedback(answer, null, 'en') } : { status, verdict: null, feedback: null };
    return {
      id: `sar-${i + 1}`, attemptId: `att-seed-${i + 1}`, mine: false, learnerName,
      courseId, courseTitle: c.title, courseSlug: c.slug, pillarId: c.pillarId, lessonId: quiz.id, lessonTitle: quiz.title,
      questionId: 'q4', prompt: PROMPT, guidance: null, answer, lang: 'en', aiReadyAt: null,
      ai: { status: ai.status, verdict: ai.verdict, feedback: ai.feedback }, final, submittedAt: daysAgo(i % 4, 8 + i),
    };
  });
}

export const aiLearningDb = {
  /** reading text keyed `${courseId}:${lessonId}` */
  readings: mockTable('ai.readings', () => ({}) as Record<string, ReadingContent>),
  reviews: mockTable('ai.reviews', seedReviews),
  /** writing assistant use per user, for the hourly limit */
  assistUse: mockTable('ai.assistUse', () => ({}) as Record<string, string[]>),
};

export const newReviewId = () => mockId('sar');
export const newAttemptId = () => mockId('att');

/* ---------- fake writing assistant (same drafts as the backend's fake provider) ---------- */

const WORDS: Record<Lang, {
  module: (n: number) => string; quiz: string; intro: (t: string) => string; ideas: string; checklist: string;
  readingIntro: (t: string) => string; why: string; whyBody: (t: string) => string; tips: string; tipsList: string[]; tryIt: string; tryBody: string;
  single: (t: string) => string; tf: (t: string) => string; multi: (t: string) => string; short: (t: string) => string;
  options: string[]; multiOptions: string[]; guidance: string; generic: string[];
}> = {
  en: {
    module: n => `Module ${n}`, quiz: 'Module quiz', intro: t => `Introduction: ${t}`, ideas: 'Key ideas', checklist: 'Checklist',
    readingIntro: t => `This reading introduces ${t}. Read it in small steps and try the activity at the end.`,
    why: 'Why it matters', whyBody: t => `${t} helps you make better decisions in your daily work. People who practise it regularly save time and avoid common mistakes. Start with one small change and build from there.`,
    tips: 'Three things to remember', tipsList: ['Start small and test your idea with real people.', 'Write down what you learn as you go.', 'Ask for feedback early and use it.'],
    tryIt: 'Try it this week', tryBody: 'Pick one idea from this lesson and apply it to something you are working on. Note what happened in two or three sentences.',
    single: t => `Which of these is the best first step when working on ${t}?`, tf: t => `${t} only matters for large organisations.`,
    multi: t => `Which of these help when you practise ${t}? Select all that apply.`, short: t => `In two or three sentences, explain how you would use ${t} in your own work.`,
    options: ['Start with a small test', 'Wait until everything is perfect', 'Copy what others do without checking', 'Skip planning'],
    multiOptions: ['Asking for feedback', 'Keeping simple notes', 'Ignoring results', 'Testing with real people'],
    guidance: 'A good answer names a concrete task, explains the first step and says how the learner will know it worked.',
    generic: ['Getting started', 'Core ideas', 'Tools and methods', 'Putting it into practice'],
  },
  fr: {
    module: n => `Module ${n}`, quiz: 'Quiz du module', intro: t => `Introduction : ${t}`, ideas: 'Idées clés', checklist: 'Liste de contrôle',
    readingIntro: t => `Cette lecture présente ${t}. Lisez-la par petites étapes et faites l’activité à la fin.`,
    why: 'Pourquoi c’est important', whyBody: t => `${t} vous aide à prendre de meilleures décisions au quotidien. Les personnes qui le pratiquent régulièrement gagnent du temps et évitent les erreurs courantes. Commencez par un petit changement.`,
    tips: 'Trois points à retenir', tipsList: ['Commencez petit et testez votre idée avec de vraies personnes.', 'Notez ce que vous apprenez au fur et à mesure.', 'Demandez des retours tôt et utilisez-les.'],
    tryIt: 'Essayez cette semaine', tryBody: 'Choisissez une idée de cette leçon et appliquez-la à un travail en cours. Notez ce qui s’est passé en deux ou trois phrases.',
    single: t => `Quelle est la meilleure première étape pour travailler sur ${t} ?`, tf: t => `${t} ne concerne que les grandes organisations.`,
    multi: t => `Qu’est-ce qui aide quand vous pratiquez ${t} ? Cochez toutes les bonnes réponses.`, short: t => `En deux ou trois phrases, expliquez comment vous utiliseriez ${t} dans votre travail.`,
    options: ['Commencer par un petit test', 'Attendre que tout soit parfait', 'Copier les autres sans vérifier', 'Sauter la planification'],
    multiOptions: ['Demander des retours', 'Prendre des notes simples', 'Ignorer les résultats', 'Tester avec de vraies personnes'],
    guidance: 'Une bonne réponse cite une tâche concrète, explique la première étape et dit comment savoir si cela a marché.',
    generic: ['Pour commencer', 'Idées essentielles', 'Outils et méthodes', 'Mettre en pratique'],
  },
  rw: {
    module: n => `Igice cya ${n}`, quiz: "Isuzumabumenyi ry'igice", intro: t => `Intangiriro: ${t}`, ideas: "Ibitekerezo by'ingenzi", checklist: 'Urutonde rwo kugenzura',
    readingIntro: t => `Iri somo rigusobanurira ${t}. Risome buhoro buhoro kandi ukore igikorwa kiri ku musozo.`,
    why: 'Impamvu ari ingenzi', whyBody: t => `${t} igufasha gufata ibyemezo byiza mu kazi ka buri munsi. Abantu babikora kenshi bazigama igihe kandi birinda amakosa asanzwe. Tangira n'impinduka nto.`,
    tips: 'Ibintu bitatu byo kwibuka', tipsList: ["Tangira buhoro kandi ugerageze igitekerezo cyawe n'abantu nyabo.", 'Andika ibyo wiga uko ugenda.', 'Saba ibitekerezo hakiri kare kandi ubikoreshe.'],
    tryIt: 'Bigerageze iki cyumweru', tryBody: 'Hitamo igitekerezo kimwe muri iri somo ugishyire mu kazi urimo. Andika uko byagenze mu nteruro ebyiri cyangwa eshatu.',
    single: t => `Ni iyihe ntambwe ya mbere nziza mu gukora kuri ${t}?`, tf: t => `${t} ireba ibigo binini gusa.`,
    multi: t => `Ni ibihe bigufasha mu gukora ${t}? Hitamo ibisubizo byose bikwiye.`, short: t => `Mu nteruro ebyiri cyangwa eshatu, sobanura uko wakoresha ${t} mu kazi kawe.`,
    options: ['Gutangira n’igerageza rito', 'Gutegereza ko byose biba byiza', 'Kwigana abandi utagenzuye', 'Kwirengagiza igenamigambi'],
    multiOptions: ['Gusaba ibitekerezo', 'Kwandika inyandiko zoroshye', 'Kwirengagiza ibyavuye mu bikorwa', "Kugerageza n'abantu nyabo"],
    guidance: 'Igisubizo cyiza kivuga umurimo ufatika, kigasobanura intambwe ya mbere kandi kikavuga uko azamenya ko byagenze neza.',
    generic: ['Gutangira', "Ibitekerezo by'ingenzi", 'Ibikoresho n’uburyo', 'Bishyire mu bikorwa'],
  },
};

const LANGUAGE_CODE: Record<string, Lang> = { English: 'en', French: 'fr', Kinyarwanda: 'rw' };
export const courseLang = (languages?: string[]): Lang => LANGUAGE_CODE[languages?.[0] ?? 'English'] ?? 'en';
const hex = () => Math.random().toString(16).slice(2, 10).padEnd(8, '0');

export function fakeOutline(outcomes: string[], lang: Lang): { title: string; lessons: { title: string; type: LessonType; minutes: number }[] }[] {
  const w = WORDS[lang];
  const own = outcomes.map(o => o.trim()).filter(Boolean).slice(0, 6);
  const topics = [...own, ...w.generic.slice(0, Math.max(0, 3 - own.length))];
  return topics.map((topic, i) => ({
    title: topic.length > 60 ? `${topic.slice(0, 57).trim()}...` : topic,
    lessons: [
      { title: w.intro(topic.toLowerCase()).slice(0, 80), type: 'video' as const, minutes: 8 },
      { title: w.ideas, type: 'reading' as const, minutes: 12 },
      ...(i === 1 ? [{ title: w.checklist, type: 'pdf' as const, minutes: 6 }] : []),
      { title: w.quiz, type: 'quiz' as const, minutes: 10 },
    ],
  }));
}

export function fakeReading(lessonTitle: string, lang: Lang): ReadingContent {
  const w = WORDS[lang];
  return {
    intro: w.readingIntro(lessonTitle),
    sections: [
      { heading: w.why, body: w.whyBody(lessonTitle) },
      { heading: w.tips, list: w.tipsList },
      { heading: w.tryIt, body: w.tryBody },
    ],
  };
}

export function fakeQuestions(lessonTitle: string, lang: Lang, count: number): (QuizQuestion & { guidance?: string })[] {
  const w = WORDS[lang];
  const topic = lessonTitle.toLowerCase();
  const kinds = ['single', 'true_false', 'multiple', 'short'] as const;
  return Array.from({ length: count }, (_, i) => {
    const type = kinds[i % kinds.length];
    const round = i >= kinds.length ? ` (${Math.floor(i / kinds.length) + 1})` : '';
    const id = `q-${hex()}`;
    switch (type) {
      case 'single': return { id, type, prompt: `${w.single(topic)}${round}`, options: [...w.options], answer: [0] };
      case 'true_false': return { id, type, prompt: `${w.tf(lessonTitle)}${round}`, options: ['True', 'False'], answer: [1] };
      case 'multiple': return { id, type, prompt: `${w.multi(topic)}${round}`, options: [...w.multiOptions], answer: [0, 1, 3] };
      default: return { id, type, prompt: `${w.short(topic)}${round}`, guidance: w.guidance };
    }
  });
}
