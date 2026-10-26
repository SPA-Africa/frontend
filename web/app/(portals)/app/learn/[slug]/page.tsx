'use client';

// Course player: outline with progress, lesson body, quiz engine and the certificate moment.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Award, BookOpen, Check, ChevronDown, Clock, ListTree, Lock } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { ErrorState, PageHead, Panel, PillarTag, Skeleton } from '@/components/dash';
import { ProgressRing, lessonIcon } from '@/components/learner/bits';
import { LessonBody } from '@/components/learner/LessonViews';
import { QuizEngine } from '@/components/learner/QuizEngine';
import { ApiError } from '@/lib/api/http';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { lms, profile } from '@/lib/api/services';
import type { CoursePlayer, ProgressUpdate, QuizResult } from '@/lib/api/services/core/lms';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import type { Certificate } from '@/lib/types';
import { cx } from '@/lib/format';

export default function CoursePlayerPage() {
  const t = useT();
  const { slug } = useParams<{ slug: string }>();
  const player = useApi(() => lms.getPlayer({ params: { slug } }), [slug]);
  const { toast, toastNode } = useToast();

  if (player.error) {
    const missing = player.error instanceof ApiError && player.error.status === 404;
    return (
      <>
        <PageHead title={missing ? t('learner.player.notFound') : t('learner.courses.title')} crumbs={[{ href: '/app/courses', label: t('learner.courses.title') }]} />
        {missing
          ? <Panel><div className="py-8 text-center"><p className="text-muted">{t('learner.player.notFoundText')}</p><Button className="mt-4" href="/app/courses">{t('learner.player.backToCourses')}</Button></div></Panel>
          : <ErrorState error={player.error} onRetry={player.reload} />}
      </>
    );
  }
  if (!player.data) {
    return (
      <div aria-busy="true">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="mb-8 h-9 w-2/3" />
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]"><Skeleton className="h-96 rounded-[var(--radius-card)]" /><Skeleton className="aspect-video rounded-[var(--radius-card)]" /></div>
      </div>
    );
  }
  if (!player.data.enrollment) return <><NotEnrolled data={player.data} onEnrolled={player.reload} toast={toast} />{toastNode}</>;
  return <><Player data={player.data} setData={player.setData} toast={toast} />{toastNode}</>;
}

function NotEnrolled({ data, onEnrolled, toast }: { data: CoursePlayer; onEnrolled: () => void; toast: (m: string) => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const c = data.course;
  const enrol = async () => {
    setBusy(true);
    try { await lms.enrol({ body: { courseId: c.id } }); toast(t('learner.courses.enrolled', { title: c.title })); onEnrolled(); }
    catch (e) { toast(errorMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <>
      <PageHead title={c.title} crumbs={[{ href: '/app/courses?tab=browse', label: t('learner.courses.title') }, { label: c.title }]}
        meta={<PillarTag id={c.pillarId} label={t(`pillar.${c.pillarId}`)} />} />
      <Panel className="max-w-xl">
        <p className="text-muted">{c.summary}</p>
        <p className="mt-3 text-sm text-muted">{t('learner.courses.hours', { n: c.hours })} · {t('learner.courses.modules', { n: c.modules.length })} · {t(`learner.level.${c.level}`)}</p>
        <Button className="mt-5" onClick={enrol} disabled={busy}>{busy ? t('learner.courses.enrolling') : t('learner.courses.enrolFree')}</Button>
      </Panel>
    </>
  );
}

function Player({ data, setData, toast }: { data: CoursePlayer; setData: React.Dispatch<React.SetStateAction<CoursePlayer | undefined>>; toast: (m: string) => void }) {
  const t = useT();
  const { user } = useSession();
  const me = useApi(() => profile.get(), []);
  const { course } = data;
  const lessons = useMemo(() => course.modules.flatMap(m => m.lessons), [course]);
  const done = new Set(data.completedLessonIds);
  const [currentId, setCurrentId] = useState<string>(() =>
    lessons.find(l => l.id === data.enrollment?.lastLessonId && !done.has(l.id))?.id ?? lessons.find(l => !done.has(l.id))?.id ?? lessons[0]?.id);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [newCert, setNewCert] = useState<Certificate | null>(null);
  const [busy, setBusy] = useState(false);

  const idx = Math.max(0, lessons.findIndex(l => l.id === currentId));
  const lesson = lessons[idx];
  const mod = course.modules.find(m => m.lessons.some(l => l.id === lesson.id))!;
  const prev = lessons[idx - 1];
  const next = lessons[idx + 1];
  const Icon = lessonIcon[lesson.type];
  const isDone = done.has(lesson.id);
  const progress = lessons.length ? done.size / lessons.length : 0;
  const certCode = newCert?.code ?? data.certificateCode;

  useEffect(() => {
    lms.setResumePoint({ params: { courseId: course.id }, body: { lastLessonId: currentId } }).catch(() => {});
  }, [course.id, currentId]);

  const go = (id: string) => { setCurrentId(id); setOutlineOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const applyProgress = (p: Pick<ProgressUpdate, 'completedLessonIds' | 'certificate'>) => {
    setData(d => d && { ...d, completedLessonIds: p.completedLessonIds, certificateCode: p.certificate?.code ?? d.certificateCode });
    if (p.certificate) setNewCert(p.certificate);
  };

  const markComplete = async () => {
    setBusy(true);
    try {
      const p = await lms.completeLesson({ params: { courseId: course.id, lessonId: lesson.id } });
      applyProgress(p);
      if (p.certificate) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      toast(t('learner.player.marked'));
      if (next) go(next.id);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onQuizResult = (r: QuizResult) => {
    setData(d => d && {
      ...d,
      quizzes: { ...d.quizzes, [lesson.id]: { attemptsUsed: r.attemptsUsed, attemptsLeft: r.attemptsLeft, best: r.best, passed: r.passed } },
      completedLessonIds: r.passed && !d.completedLessonIds.includes(lesson.id) ? [...d.completedLessonIds, lesson.id] : d.completedLessonIds,
      certificateCode: r.certificate?.code ?? d.certificateCode,
    });
    if (r.certificate) setNewCert(r.certificate);
    else if (r.passed) toast(t('learner.quiz.wellDone'));
  };

  const outline = (
    <nav aria-label={t('learner.player.outline')} className="space-y-5">
      {course.modules.map((m, mi) => {
        const mDone = m.lessons.filter(l => done.has(l.id)).length;
        return (
          <div key={m.id}>
            <div className="mb-2 flex items-baseline justify-between gap-2 px-2">
              <h3 className="text-sm font-bold">{mi + 1}. {m.title}</h3>
              <span className="shrink-0 text-xs tabular-nums text-subtle">{mDone}/{m.lessons.length}</span>
            </div>
            <ul className="space-y-0.5">
              {m.lessons.map(l => {
                const LIcon = lessonIcon[l.type];
                const active = l.id === lesson.id;
                const ld = done.has(l.id);
                return (
                  <li key={l.id}>
                    <button type="button" onClick={() => go(l.id)} aria-current={active ? 'step' : undefined}
                      className={cx('flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition',
                        active ? 'bg-brand-light font-semibold text-brand-dark dark:bg-brand/15 dark:text-brand-light' : 'hover:bg-surface')}>
                      <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border transition', ld ? 'border-ok bg-ok text-white' : 'border-line text-subtle')} aria-hidden>
                        {ld ? <Check size={14} strokeWidth={3} /> : <LIcon size={13} />}
                      </span>
                      <span className="min-w-0 flex-1 leading-snug">{l.title}</span>
                      <span className="shrink-0 text-xs text-subtle">{l.minutes}m</span>
                      <span className="sr-only">{ld ? t('status.completed') : t('learner.player.notDone')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      <PageHead title={course.title} crumbs={[{ href: '/app/courses', label: t('learner.courses.title') }, { label: course.title }]}
        meta={<><PillarTag id={course.pillarId} label={t(`pillar.${course.pillarId}`)} /><span>{course.program}</span></>} />

      {certCode && (
        <section className="fade-in mb-6 flex flex-col items-start gap-5 rounded-[var(--radius-card)] border border-gold/50 bg-bg p-5 sm:flex-row sm:items-center md:p-6">
          <ProgressRing value={1} size={64} stroke={6} label={<Award size={24} className="text-ok" />} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{t('learner.player.certReady')}</h2>
            <p className="mt-1 text-muted">{newCert ? t('learner.player.certJustIssued', { name: user?.name.split(' ')[0] ?? '' }) : t('learner.player.certEarned')}</p>
          </div>
          <Button href={`/app/certificates/${certCode}`}><Award size={18} /> {t('learner.courses.viewCertificate')}</Button>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
          <div className="rounded-[var(--radius-card)] border border-line bg-bg p-4">
            <div className="flex items-center gap-4">
              <ProgressRing value={progress} size={56} />
              <div className="min-w-0 flex-1">
                <div className="font-bold">{t('learner.player.progress')}</div>
                <div className="text-sm text-muted">{t('learner.home.lessonsOf', { done: done.size, total: lessons.length })}</div>
              </div>
              <button type="button" className="grid size-10 place-items-center rounded-full border border-line lg:hidden"
                aria-expanded={outlineOpen} aria-controls="outline" aria-label={t('learner.player.showOutline')} onClick={() => setOutlineOpen(o => !o)}>
                {outlineOpen ? <ChevronDown size={18} className="rotate-180" /> : <ListTree size={18} />}
              </button>
            </div>
            <div id="outline" className={cx('mt-5 border-t border-line pt-4 lg:block', outlineOpen ? 'block' : 'hidden')}>{outline}</div>
          </div>
        </aside>

        <section aria-labelledby="lesson-title" className="min-w-0 rounded-[var(--radius-card)] border border-line bg-bg p-5 md:p-7">
          <div className="mb-5">
            <div className="text-sm text-muted">{t('learner.player.module', { n: course.modules.indexOf(mod) + 1, title: mod.title })}</div>
            <h2 id="lesson-title" className="mt-1 text-2xl font-bold leading-snug">{lesson.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge><Icon size={13} /> {t(`learner.lessonType.${lesson.type}`)}</Badge>
              <Badge><Clock size={13} /> {lesson.minutes} min</Badge>
              {isDone && <Badge tone="ok"><Check size={13} /> {t('status.completed')}</Badge>}
            </div>
          </div>

          <div key={lesson.id} className="fade-in">
            {lesson.type === 'quiz'
              ? <QuizEngine courseId={course.id} lessonId={lesson.id} onResult={onQuizResult} onToast={toast} />
              : <LessonBody courseId={course.id} lessonId={lesson.id} dataSaver={!!me.data?.dataSaver} resumeAt={data.videoPositions[lesson.id]} onToast={toast} />}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" disabled={!prev} onClick={() => prev && go(prev.id)}><ArrowLeft size={18} /> {t('ui.previous')}</Button>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              {lesson.type !== 'quiz' && (isDone
                ? <Button variant="subtle" disabled><Check size={18} /> {t('status.completed')}</Button>
                : <Button onClick={markComplete} disabled={busy}><Check size={18} /> {t('learner.player.markComplete')}</Button>)}
              {lesson.type === 'quiz' && !data.quizzes[lesson.id]?.passed && (
                <span className="inline-flex items-center gap-2 text-sm text-muted"><Lock size={15} /> {t('learner.player.passToComplete')}</span>
              )}
              <Button variant="ghost" disabled={!next} onClick={() => next && go(next.id)}>{t('ui.next')} <ArrowRight size={18} /></Button>
            </div>
          </div>
          {!next && !certCode && (
            <p className="mt-4 flex items-start gap-2 text-sm text-muted">
              <BookOpen size={16} className="mt-0.5 shrink-0" />
              <span>{t('learner.player.lastLesson')} <Link href="/app/certificates" className="font-semibold text-brand hover:underline">{t('nav.certificates')}</Link></span>
            </p>
          )}
        </section>
      </div>
    </>
  );
}
