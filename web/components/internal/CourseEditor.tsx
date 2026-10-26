'use client';

// Course authoring: details, outcomes, modules and lessons, and a quiz builder for quiz lessons.
// Reads and writes only through the authoring service. Saving keeps a draft; publishing makes the
// course visible to learners (course.published) through the shared courses table.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronUp, EyeOff, FileQuestion, Plus, Send, Trash2 } from 'lucide-react';
import { Button, Checkbox, Field, Input, Select, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { ErrorState, PageHead, Panel, Skeleton, SkeletonPanel, StatusPill } from '@/components/dash';
import { ConfirmDialog, FormError, PillarScope } from '@/components/console/ConsoleKit';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { authoring } from '@/lib/api/services';
import type { AuthoringContext, AuthoringCourse, AuthoringLesson, AuthoringModule, CourseDraftInput, CourseLanguage, QuizDefinition } from '@/lib/api/services/core/authoring';
import { useT } from '@/lib/i18n';
import type { Course, LessonType, QuizQuestion } from '@/lib/types';
import { cx, date, num } from '@/lib/format';

const LESSON_TYPES: LessonType[] = ['video', 'reading', 'pdf', 'quiz'];
const Q_TYPES: QuizQuestion['type'][] = ['single', 'multiple', 'true_false', 'short'];
const LEVELS: Course['level'][] = ['Beginner', 'Intermediate', 'Advanced'];

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${++seq}`;

const blankQuestion = (): QuizQuestion => ({ id: uid('q'), type: 'single', prompt: '', options: ['', ''], answer: [0] });
const newQuiz = (ctx: AuthoringContext): QuizDefinition => ({ ...ctx.quizDefaults, questions: [blankQuestion()] });

const blankDraft = (ctx: AuthoringContext): CourseDraftInput => ({
  title: '', program: ctx.programmes[0], level: 'Beginner', hours: 6, languages: ['English'], summary: '', outcomes: [''],
  modules: [{ id: uid('m'), title: '', lessons: [{ id: uid('l'), title: '', type: 'video', minutes: 5 }] }],
});

const toDraft = (c: AuthoringCourse): CourseDraftInput => ({
  title: c.title, program: c.program, level: c.level, hours: c.hours, languages: c.languages, summary: c.summary,
  outcomes: c.outcomes.length ? c.outcomes : [''], modules: c.modules,
});

function move<T>(arr: T[], i: number, d: -1 | 1) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function IconBtn({ label, onClick, disabled, children, danger }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={cx('grid size-9 shrink-0 place-items-center rounded-full border border-line transition hover:bg-surface disabled:pointer-events-none disabled:opacity-40', danger && 'text-brand')}>
      {children}
    </button>
  );
}

const smallField = 'h-10 rounded-xl border border-line bg-bg px-3 text-[15px] text-ink placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10';

/** Page body for /console/courses/new (no courseId) and /console/courses/[id]. */
export function CourseEditor({ courseId }: { courseId?: string }) {
  const t = useT();
  const router = useRouter();
  const context = useApi(() => authoring.getContext(), []);
  const loaded = useApi(() => authoring.getCourse({ params: { id: courseId! } }), [courseId], { enabled: !!courseId });

  const [course, setCourse] = useState<AuthoringCourse | null>(null);
  const [d, setD] = useState<CourseDraftInput | null>(null);
  const [saved, setSaved] = useState('');
  const [openQuiz, setOpenQuiz] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'publish' | 'unpublish'>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();

  useEffect(() => {
    if (courseId && loaded.data) {
      setCourse(loaded.data);
      const draft = toDraft(loaded.data);
      setD(draft);
      setSaved(JSON.stringify(draft));
    } else if (!courseId && context.data && !d) {
      setD(blankDraft(context.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, loaded.data, context.data]);

  const dirty = useMemo(() => !!d && JSON.stringify(d) !== saved, [d, saved]);
  const lessonCount = d?.modules.reduce((s, m) => s + m.lessons.length, 0) ?? 0;
  const quizCount = d?.modules.reduce((s, m) => s + m.lessons.filter(l => l.type === 'quiz').length, 0) ?? 0;
  const minutes = d?.modules.reduce((s, m) => s + m.lessons.reduce((x, l) => x + (Number(l.minutes) || 0), 0), 0) ?? 0;

  const err = context.error ?? loaded.error;
  if (err) return <ErrorState error={err} onRetry={() => { context.reload(); loaded.reload(); }} />;
  if (!d || !context.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"><SkeletonPanel rows={6} /><SkeletonPanel rows={3} /></div>
      </div>
    );
  }
  const ctx = context.data;
  const published = course?.published ?? false;

  const set = <K extends keyof CourseDraftInput>(k: K, v: CourseDraftInput[K]) => setD(prev => prev && ({ ...prev, [k]: v }));
  const setModules = (fn: (m: AuthoringModule[]) => AuthoringModule[]) => setD(prev => prev && ({ ...prev, modules: fn(prev.modules) }));
  const setModule = (mi: number, fn: (m: AuthoringModule) => AuthoringModule) => setModules(ms => ms.map((m, i) => (i === mi ? fn(m) : m)));
  const setLesson = (mi: number, li: number, fn: (l: AuthoringLesson) => AuthoringLesson) =>
    setModule(mi, m => ({ ...m, lessons: m.lessons.map((l, i) => (i === li ? fn(l) : l)) }));

  const save = async (): Promise<AuthoringCourse | null> => {
    setError(null);
    if (published) {
      const p = authoring.publishProblems(d);
      setProblems(p);
      if (p.length) return null;
    }
    setBusy(true);
    try {
      const out = course ? await authoring.updateCourse({ params: { id: course.id }, body: d }) : await authoring.createCourse({ body: d });
      setCourse(out);
      setSaved(JSON.stringify(d));
      toast(out.published ? t('console.editor.savedLive') : t('console.editor.savedDraft'));
      if (!course) router.replace(`/console/courses/${out.id}`);
      return out;
    } catch (e) {
      setError(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const askPublish = () => {
    const p = authoring.publishProblems(d);
    setProblems(p);
    if (!p.length) setConfirm('publish');
  };

  const publish = async () => {
    const current = dirty || !course ? await save() : course;
    if (!current) { setConfirm(null); return; }
    setBusy(true);
    try {
      const out = await authoring.publishCourse({ params: { id: current.id } });
      setCourse(out);
      toast(t('console.editor.publishedToast'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const unpublish = async () => {
    if (!course) return;
    setBusy(true);
    try {
      setCourse(await authoring.unpublishCourse({ params: { id: course.id } }));
      toast(t('console.editor.unpublishedToast'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <>
      <PageHead
        title={course ? course.title : t('console.courses.new')}
        crumbs={[{ href: '/console/courses', label: t('nav.courses') }, { label: course ? t('ui.edit') : t('console.courses.new') }]}
        meta={<><StatusPill status={published ? 'published' : 'draft'} /><PillarScope pillarId={ctx.pillarId} /></>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title={t('console.editor.details')}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label={t('console.editor.title')} htmlFor="c-title">
                  <Input id="c-title" value={d.title} maxLength={120} onChange={e => set('title', e.target.value)} placeholder={t('console.editor.titlePlaceholder')} />
                </Field>
              </div>
              <Field label={t('console.courses.programme')} htmlFor="c-program">
                <Select id="c-program" value={d.program} onChange={e => set('program', e.target.value)}>
                  {ctx.programmes.map(p => <option key={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label={t('console.courses.level')} htmlFor="c-level">
                <Select id="c-level" value={d.level} onChange={e => set('level', e.target.value as Course['level'])}>
                  {LEVELS.map(l => <option key={l} value={l}>{t(`console.level.${l}`)}</option>)}
                </Select>
              </Field>
              <Field label={t('console.editor.hours')} htmlFor="c-hours">
                <Input id="c-hours" type="number" min={1} max={200} value={d.hours} onChange={e => set('hours', Number(e.target.value))} />
              </Field>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">{t('console.editor.languages')}</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {ctx.languages.map(l => (
                    <Checkbox key={l} label={t(`console.lang.${l}`)} checked={d.languages.includes(l)}
                      onChange={e => set('languages', e.target.checked ? [...d.languages, l] : d.languages.filter((x: CourseLanguage) => x !== l))} />
                  ))}
                </div>
              </fieldset>
              <div className="sm:col-span-2">
                <Field label={t('console.editor.summary')} htmlFor="c-summary">
                  <Textarea id="c-summary" value={d.summary} onChange={e => set('summary', e.target.value)} className="min-h-24" />
                </Field>
              </div>
            </div>
          </Panel>

          <Panel title={t('console.editor.outcomes')}>
            <ol className="flex flex-col gap-3">
              {d.outcomes.map((o, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-right font-display font-bold text-subtle">{i + 1}</span>
                  <label className="sr-only" htmlFor={`o-${i}`}>{t('console.editor.outcomeN', { n: i + 1 })}</label>
                  <input id={`o-${i}`} className={cx(smallField, 'min-w-0 flex-1')} value={o}
                    onChange={e => set('outcomes', d.outcomes.map((x, j) => (j === i ? e.target.value : x)))} />
                  <IconBtn label={t('console.editor.removeOutcome', { n: i + 1 })} danger disabled={d.outcomes.length === 1}
                    onClick={() => set('outcomes', d.outcomes.filter((_, j) => j !== i))}><Trash2 size={15} /></IconBtn>
                </li>
              ))}
            </ol>
            <Button variant="subtle" size="sm" className="mt-4" onClick={() => set('outcomes', [...d.outcomes, ''])}><Plus size={15} /> {t('console.editor.addOutcome')}</Button>
          </Panel>

          <Panel title={t('console.editor.modules')}
            action={<span className="text-sm text-muted tabular-nums">{t('console.editor.structure', { modules: d.modules.length, lessons: lessonCount, minutes })}</span>}>
            <ol className="flex flex-col gap-5">
              {d.modules.map((m, mi) => (
                <li key={m.id} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold text-muted">{t('console.editor.moduleN', { n: mi + 1 })}</span>
                    <label className="sr-only" htmlFor={`m-${m.id}`}>{t('console.editor.moduleTitle', { n: mi + 1 })}</label>
                    <input id={`m-${m.id}`} className={cx(smallField, 'min-w-0 flex-1 basis-48 font-semibold')} value={m.title}
                      placeholder={t('console.editor.moduleTitle', { n: mi + 1 })}
                      onChange={e => setModule(mi, x => ({ ...x, title: e.target.value }))} />
                    <div className="flex gap-1">
                      <IconBtn label={t('console.editor.moveUp')} disabled={mi === 0} onClick={() => setModules(ms => move(ms, mi, -1))}><ArrowUp size={15} /></IconBtn>
                      <IconBtn label={t('console.editor.moveDown')} disabled={mi === d.modules.length - 1} onClick={() => setModules(ms => move(ms, mi, 1))}><ArrowDown size={15} /></IconBtn>
                      <IconBtn label={t('console.editor.removeModule', { n: mi + 1 })} danger disabled={d.modules.length === 1} onClick={() => setModules(ms => ms.filter((_, i) => i !== mi))}><Trash2 size={15} /></IconBtn>
                    </div>
                  </div>

                  <ol className="mt-4 flex flex-col gap-2">
                    {m.lessons.map((l, li) => (
                      <li key={l.id} className="rounded-xl border border-line bg-bg p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="sr-only" htmlFor={`l-${l.id}`}>{t('console.editor.lessonTitle', { n: li + 1 })}</label>
                          <input id={`l-${l.id}`} className={cx(smallField, 'min-w-0 flex-1 basis-52')} value={l.title} placeholder={t('console.editor.lessonPlaceholder')}
                            onChange={e => setLesson(mi, li, x => ({ ...x, title: e.target.value }))} />
                          <label className="sr-only" htmlFor={`lt-${l.id}`}>{t('console.editor.lessonType', { n: li + 1 })}</label>
                          <select id={`lt-${l.id}`} className={cx(smallField, 'w-28')} value={l.type}
                            onChange={e => {
                              const type = e.target.value as LessonType;
                              setLesson(mi, li, x => ({ ...x, type, quiz: type === 'quiz' ? x.quiz ?? newQuiz(ctx) : undefined }));
                              if (type === 'quiz') setOpenQuiz(l.id);
                            }}>
                            {LESSON_TYPES.map(lt => <option key={lt} value={lt}>{t(`console.lessonType.${lt}`)}</option>)}
                          </select>
                          <label className="flex items-center gap-1.5 text-sm text-muted">
                            <input className={cx(smallField, 'w-20')} type="number" min={1} max={240} value={l.minutes}
                              onChange={e => setLesson(mi, li, x => ({ ...x, minutes: Number(e.target.value) }))} aria-label={t('console.editor.lessonMinutes', { n: li + 1 })} />
                            {t('console.editor.min')}
                          </label>
                          <div className="flex gap-1">
                            <IconBtn label={t('console.editor.moveUp')} disabled={li === 0} onClick={() => setModule(mi, x => ({ ...x, lessons: move(x.lessons, li, -1) }))}><ArrowUp size={15} /></IconBtn>
                            <IconBtn label={t('console.editor.moveDown')} disabled={li === m.lessons.length - 1} onClick={() => setModule(mi, x => ({ ...x, lessons: move(x.lessons, li, 1) }))}><ArrowDown size={15} /></IconBtn>
                            <IconBtn label={t('console.editor.removeLesson', { n: li + 1 })} danger onClick={() => setModule(mi, x => ({ ...x, lessons: x.lessons.filter((_, i) => i !== li) }))}><Trash2 size={15} /></IconBtn>
                          </div>
                        </div>
                        {l.type === 'quiz' && l.quiz && (
                          <div className="mt-3">
                            <button type="button" onClick={() => setOpenQuiz(openQuiz === l.id ? null : l.id)} aria-expanded={openQuiz === l.id}
                              className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark">
                              <FileQuestion size={16} aria-hidden />
                              {t('console.quiz.summary', { n: l.quiz.questions.length, pass: l.quiz.passMark })}
                              {openQuiz === l.id ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
                            </button>
                            {openQuiz === l.id && <QuizBuilder quiz={l.quiz} onChange={quiz => setLesson(mi, li, x => ({ ...x, quiz }))} />}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                  <Button variant="ghost" size="sm" className="mt-3 bg-bg"
                    onClick={() => setModule(mi, x => ({ ...x, lessons: [...x.lessons, { id: uid('l'), title: '', type: 'video', minutes: 10 }] }))}>
                    <Plus size={15} /> {t('console.editor.addLesson')}
                  </Button>
                </li>
              ))}
            </ol>
            <Button variant="subtle" className="mt-5" onClick={() => setModules(ms => [...ms, { id: uid('m'), title: '', lessons: [] }])}>
              <Plus size={16} /> {t('console.editor.addModule')}
            </Button>
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Panel title={t('console.editor.publishing')} action={<StatusPill status={published ? 'published' : 'draft'} />}>
            <p className="text-sm text-muted">{published ? t('console.editor.liveNote') : t('console.editor.draftNote')}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {[[t('console.editor.modulesShort'), d.modules.length], [t('console.courses.lessons'), lessonCount], [t('console.courses.quizzes'), quizCount], [t('console.editor.minutes'), minutes]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface px-3 py-2"><dt className="text-muted">{k}</dt><dd className="font-display text-lg font-bold tabular-nums">{num(Number(v))}</dd></div>
              ))}
            </dl>
            {course?.updatedAt && <p className="mt-3 text-xs text-muted">{t('console.editor.lastSaved', { date: date(course.updatedAt.slice(0, 10)) })}</p>}

            {problems.length > 0 && (
              <div role="alert" className="mt-4 rounded-xl bg-brand-light p-3 text-sm text-brand-dark dark:bg-brand/20 dark:text-[#ffb59a]">
                <div className="font-semibold">{t('console.editor.notReady')}</div>
                <ul className="mt-1 list-disc pl-5">{problems.map(p => <li key={p}>{t(`console.editor.problem.${p}`)}</li>)}</ul>
              </div>
            )}
            <div className="mt-4"><FormError message={error} /></div>

            <div className="mt-4 flex flex-col gap-2">
              <Button variant={published ? 'primary' : 'ghost'} onClick={save} disabled={busy || (!dirty && !!course)}>
                {published ? t('ui.saveChanges') : t('console.editor.saveDraft')}
              </Button>
              {published
                ? <Button variant="danger" onClick={() => setConfirm('unpublish')} disabled={busy}><EyeOff size={16} /> {t('console.editor.unpublish')}</Button>
                : <Button onClick={askPublish} disabled={busy}><Send size={16} /> {t('console.editor.publish')}</Button>}
              <p className="text-center text-xs text-muted" aria-live="polite">{dirty ? t('console.editor.unsaved') : course ? t('console.editor.allSaved') : ''}</p>
            </div>
          </Panel>
        </aside>
      </div>

      <ConfirmDialog open={confirm === 'publish'} onClose={() => setConfirm(null)} busy={busy} title={t('console.editor.publishTitle')} confirmLabel={t('console.editor.publish')} onConfirm={publish}>
        {t('console.editor.publishBody', { title: d.title || t('console.courses.new') })}
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'unpublish'} onClose={() => setConfirm(null)} busy={busy} danger title={t('console.editor.unpublishTitle')} confirmLabel={t('console.editor.unpublish')} onConfirm={unpublish}>
        {t('console.editor.unpublishBody', { n: num(course?.enrolled ?? 0) })}
      </ConfirmDialog>
      {toastNode}
    </>
  );
}

function QuizBuilder({ quiz, onChange }: { quiz: QuizDefinition; onChange: (q: QuizDefinition) => void }) {
  const t = useT();
  const setQ = (i: number, fn: (q: QuizQuestion) => QuizQuestion) => onChange({ ...quiz, questions: quiz.questions.map((q, j) => (j === i ? fn(q) : q)) });

  const changeType = (q: QuizQuestion, type: QuizQuestion['type']): QuizQuestion => {
    if (type === 'true_false') return { ...q, type, options: ['True', 'False'], answer: [0] };
    if (type === 'short') return { ...q, type, options: undefined, answer: undefined };
    const options = q.type === 'true_false' || !q.options ? ['', ''] : q.options;
    return { ...q, type, options, answer: type === 'single' ? [q.answer?.[0] ?? 0] : q.answer ?? [] };
  };

  const ids = useMemo(() => `qz-${Math.random().toString(36).slice(2, 7)}`, []);

  return (
    <div className="mt-3 rounded-xl border border-line bg-surface p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('console.quiz.passMark')} htmlFor={`${ids}-pass`}>
          <Input id={`${ids}-pass`} type="number" min={1} max={100} value={quiz.passMark} onChange={e => onChange({ ...quiz, passMark: Number(e.target.value) })} />
        </Field>
        <Field label={t('console.quiz.retakes')} htmlFor={`${ids}-retakes`}>
          <Input id={`${ids}-retakes`} type="number" min={0} max={10} value={quiz.maxRetakes} onChange={e => onChange({ ...quiz, maxRetakes: Number(e.target.value) })} />
        </Field>
      </div>

      <ol className="mt-5 flex flex-col gap-4">
        {quiz.questions.map((q, i) => (
          <li key={q.id} className="rounded-xl border border-line bg-bg p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-display font-bold">{t('console.quiz.questionN', { n: i + 1 })}</span>
              <label className="sr-only" htmlFor={`qt-${q.id}`}>{t('console.quiz.type')}</label>
              <select id={`qt-${q.id}`} className={cx(smallField, 'ml-auto')} value={q.type} onChange={e => setQ(i, x => changeType(x, e.target.value as QuizQuestion['type']))}>
                {Q_TYPES.map(qt => <option key={qt} value={qt}>{t(`console.qtype.${qt}`)}</option>)}
              </select>
              <IconBtn label={t('console.quiz.removeQuestion', { n: i + 1 })} danger disabled={quiz.questions.length === 1}
                onClick={() => onChange({ ...quiz, questions: quiz.questions.filter((_, j) => j !== i) })}><Trash2 size={15} /></IconBtn>
            </div>
            <label className="sr-only" htmlFor={`qp-${q.id}`}>{t('console.quiz.prompt')}</label>
            <textarea id={`qp-${q.id}`} rows={2} value={q.prompt} placeholder={t('console.quiz.prompt')}
              onChange={e => setQ(i, x => ({ ...x, prompt: e.target.value }))}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-[15px] text-ink placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />

            {q.type === 'short' ? (
              <p className="mt-3 text-sm text-muted">{t('console.quiz.shortNote')}</p>
            ) : (
              <fieldset className="mt-3">
                <legend className="mb-2 text-sm font-semibold text-muted">{q.type === 'multiple' ? t('console.quiz.markAll') : t('console.quiz.markOne')}</legend>
                <ul className="flex flex-col gap-2">
                  {(q.options ?? []).map((o, oi) => {
                    const correct = q.answer?.includes(oi) ?? false;
                    return (
                      <li key={oi} className="flex items-center gap-2">
                        <input type={q.type === 'multiple' ? 'checkbox' : 'radio'} name={`ans-${q.id}`} checked={correct} className="size-5 shrink-0 accent-ok"
                          aria-label={t('console.quiz.markCorrect', { n: oi + 1 })}
                          onChange={e => setQ(i, x => ({
                            ...x,
                            answer: x.type === 'multiple' ? (e.target.checked ? [...(x.answer ?? []), oi].sort() : (x.answer ?? []).filter(a => a !== oi)) : [oi],
                          }))} />
                        {q.type === 'true_false' ? <span className="text-[15px]">{oi === 0 ? t('console.quiz.true') : t('console.quiz.false')}</span> : (
                          <input className={cx(smallField, 'min-w-0 flex-1')} value={o} placeholder={t('console.quiz.optionN', { n: oi + 1 })} aria-label={t('console.quiz.optionN', { n: oi + 1 })}
                            onChange={e => setQ(i, x => ({ ...x, options: x.options?.map((y, k) => (k === oi ? e.target.value : y)) }))} />
                        )}
                        {correct && <CheckCircle2 size={17} className="shrink-0 text-ok" aria-label={t('console.quiz.correct')} />}
                        {q.type !== 'true_false' && (
                          <IconBtn label={t('console.quiz.removeOption', { n: oi + 1 })} danger disabled={(q.options?.length ?? 0) <= 2}
                            onClick={() => setQ(i, x => ({ ...x, options: x.options?.filter((_, k) => k !== oi), answer: (x.answer ?? []).filter(a => a !== oi).map(a => (a > oi ? a - 1 : a)) }))}>
                            <Trash2 size={14} />
                          </IconBtn>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {q.type !== 'true_false' && (
                  <Button variant="link" size="sm" className="mt-2" onClick={() => setQ(i, x => ({ ...x, options: [...(x.options ?? []), ''] }))}><Plus size={14} /> {t('console.quiz.addOption')}</Button>
                )}
              </fieldset>
            )}
          </li>
        ))}
      </ol>
      <Button variant="ghost" size="sm" className="mt-4 bg-bg" onClick={() => onChange({ ...quiz, questions: [...quiz.questions, blankQuestion()] })}>
        <Plus size={15} /> {t('console.quiz.addQuestion')}
      </Button>
    </div>
  );
}
