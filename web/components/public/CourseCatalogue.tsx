'use client';

// Public course catalogue and course detail, both read from the catalog service.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronDown, Clock, FileText, HelpCircle, Languages, PlayCircle, Search, Users } from 'lucide-react';
import { Badge, Button, Input, Select } from '@/components/ui';
import { Async, CourseCover, ErrorState, PillarTag, Skeleton } from '@/components/dash';
import { ApiError } from '@/lib/api/http';
import { useApi } from '@/lib/api/hooks';
import { catalog } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { num } from '@/lib/format';
import type { Course, LessonType, PillarId } from '@/lib/types';
import { EnrolButton } from './EnrolButton';
import { PillarIcon } from './pillar-icon';

const PILLARS: PillarId[] = ['technology', 'education', 'leadership', 'young_startups', 'agriculture'];
const LEVELS: Course['level'][] = ['Beginner', 'Intermediate', 'Advanced'];
const LANGUAGES: Course['language'][number][] = ['English', 'French', 'Kinyarwanda'];
const PAGE = 12;

export function CourseCard({ course }: { course: Course }) {
  const t = useT();
  const lessons = course.modules.reduce((n, m) => n + m.lessons.length, 0);
  return (
    <Link href={`/courses/${course.slug}`}
      className="group flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-bg p-2 transition duration-300 hover:-translate-y-0.5 hover:border-brand/35">
      <CourseCover pillarId={course.pillarId} program={course.program} level={t(`public.courses.level.${course.level}`)} />
      <div className="flex flex-1 flex-col px-3 pb-3 pt-4">
        <PillarTag id={course.pillarId} label={t(`pillar.${course.pillarId}`)} className="text-xs" />
        <h3 className="mt-1 text-lg font-bold leading-snug group-hover:text-brand">{course.title}</h3>
        <p className="mt-2 line-clamp-3 flex-1 text-[15px] text-muted">{course.summary}</p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><Clock size={15} aria-hidden="true" />{t('public.courses.hours', { n: course.hours })}</span>
          <span className="inline-flex items-center gap-1.5"><BookOpen size={15} aria-hidden="true" />{t('public.courses.lessons', { n: lessons })}</span>
          <span className="inline-flex items-center gap-1.5"><Users size={15} aria-hidden="true" />{num(course.enrolled)}</span>
        </div>
      </div>
    </Link>
  );
}

export function CourseCatalogue() {
  const t = useT();
  const [q, setQ] = useState('');
  const [pillar, setPillar] = useState<PillarId | ''>('');
  const [level, setLevel] = useState<Course['level'] | ''>('');
  const [lang, setLang] = useState<Course['language'][number] | ''>('');
  const [pages, setPages] = useState(1);
  const list = useApi(
    () => catalog.listCourses({ query: { q: q || undefined, pillar: pillar || undefined, level: level || undefined, language: lang || undefined, pageSize: PAGE * pages } }),
    [q, pillar, level, lang, pages],
  );

  const reset = () => { setQ(''); setPillar(''); setLevel(''); setLang(''); setPages(1); };
  const filtered = !!(q || pillar || level || lang);
  const chip = (active: boolean) => `inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${active ? 'bg-ink text-bg' : 'border border-line text-muted hover:text-ink'}`;

  return (
    <>
      <div className="mb-10 max-w-2xl">
        <h1 className="text-[clamp(36px,5vw,56px)] font-bold leading-[1.05]">{t('public.courses.title')}</h1>
        <p className="mt-3 text-lg text-muted">{t('public.courses.intro')}</p>
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t('public.courses.filterPillar')}>
        <button type="button" onClick={() => { setPillar(''); setPages(1); }} aria-pressed={!pillar} className={chip(!pillar)}>{t('public.courses.allPillars')}</button>
        {PILLARS.map(p => (
          <button key={p} type="button" onClick={() => { setPillar(p); setPages(1); }} aria-pressed={pillar === p} className={chip(pillar === p)}>
            <PillarIcon id={p} size={15} />{t(`pillar.${p}`)}
          </button>
        ))}
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <label htmlFor="course-search" className="sr-only">{t('public.courses.search')}</label>
          <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" />
          <Input id="course-search" type="search" placeholder={t('public.courses.search')} value={q} onChange={e => { setQ(e.target.value); setPages(1); }} className="pl-11" />
        </div>
        <div>
          <label htmlFor="course-level" className="sr-only">{t('public.courses.levelLabel')}</label>
          <Select id="course-level" value={level} onChange={e => { setLevel(e.target.value as Course['level'] | ''); setPages(1); }} className="sm:w-44">
            <option value="">{t('public.courses.anyLevel')}</option>
            {LEVELS.map(l => <option key={l} value={l}>{t(`public.courses.level.${l}`)}</option>)}
          </Select>
        </div>
        <div>
          <label htmlFor="course-lang" className="sr-only">{t('public.courses.languageLabel')}</label>
          <Select id="course-lang" value={lang} onChange={e => { setLang(e.target.value as Course['language'][number] | ''); setPages(1); }} className="sm:w-44">
            <option value="">{t('public.courses.anyLanguage')}</option>
            {LANGUAGES.map(l => <option key={l} value={l}>{t(`public.courses.lang.${l}`)}</option>)}
          </Select>
        </div>
      </div>

      <Async state={list}
        skeleton={<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-96 rounded-[var(--radius-card)]" />)}</div>}>
        {page => (
          <>
            <p className="mb-5 text-sm text-muted" aria-live="polite">
              {t('public.courses.count', { n: page.total })}
              {filtered && <> · <button type="button" onClick={reset} className="font-semibold text-brand hover:underline">{t('ui.clearFilters')}</button></>}
            </p>
            {page.total ? (
              <>
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{page.items.map(c => <CourseCard key={c.id} course={c} />)}</div>
                {page.items.length < page.total && (
                  <div className="mt-8 flex justify-center"><Button variant="ghost" onClick={() => setPages(n => n + 1)} disabled={list.loading}>{t('public.courses.loadMore')}</Button></div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line px-6 py-14 text-center">
                <Search size={24} className="text-subtle" />
                <p className="mt-3 font-semibold">{t('public.courses.noMatch')}</p>
                <Button className="mt-4" variant="ghost" onClick={reset}>{t('ui.clearFilters')}</Button>
              </div>
            )}
          </>
        )}
      </Async>
    </>
  );
}

const lessonIcon: Record<LessonType, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  video: PlayCircle, reading: BookOpen, pdf: FileText, quiz: HelpCircle,
};

export function CourseDetail({ slug }: { slug: string }) {
  const t = useT();
  const course = useApi(() => catalog.getCourse({ params: { slug } }), [slug]);
  useEffect(() => { if (course.data) document.title = `${course.data.title} | SHAPE Potential Africa`; }, [course.data]);

  const back = (
    <Link href="/courses" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
      <ArrowLeft size={16} aria-hidden="true" /> {t('public.courses.all')}
    </Link>
  );

  if (course.error) {
    const missing = course.error instanceof ApiError && course.error.status === 404;
    return (
      <>
        {back}
        {missing ? (
          <div className="rounded-[var(--radius-card)] border border-line p-8 text-center">
            <h1 className="text-2xl font-bold">{t('public.courses.notFound')}</h1>
            <Button className="mt-5" href="/courses">{t('public.courses.all')}</Button>
          </div>
        ) : <ErrorState error={course.error} onRetry={course.reload} />}
      </>
    );
  }
  if (!course.data) {
    return (
      <div aria-busy="true">
        {back}
        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4"><Skeleton className="h-6 w-40" /><Skeleton className="h-14 w-4/5" /><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>
          <Skeleton className="h-80 rounded-[var(--radius-card)]" />
        </div>
      </div>
    );
  }

  const c = course.data;
  const lessons = c.modules.reduce((n, m) => n + m.lessons.length, 0);
  const facts = [
    { icon: <Clock size={18} />, label: t('public.courses.length'), value: t('public.courses.hours', { n: c.hours }) },
    { icon: <BookOpen size={18} />, label: t('public.courses.lessonsLabel'), value: t('public.courses.lessonsIn', { n: lessons, m: c.modules.length }) },
    { icon: <Languages size={18} />, label: t('public.courses.languageLabel'), value: c.language.map(l => t(`public.courses.lang.${l}`)).join(', ') },
    { icon: <Users size={18} />, label: t('public.courses.learnersLabel'), value: t('public.courses.enrolled', { n: num(c.enrolled) }) },
  ];

  return (
    <>
      {back}
      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <PillarTag id={c.pillarId} label={t(`pillar.${c.pillarId}`)} />
            <Badge>{t(`public.courses.level.${c.level}`)}</Badge>
          </div>
          <h1 className="text-[clamp(32px,4.5vw,52px)] font-bold leading-[1.08]">{c.title}</h1>
          <p className="mt-2 text-muted">{c.program}</p>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed">{c.summary}</p>

          <section className="mt-12" aria-labelledby="outcomes">
            <h2 id="outcomes" className="mb-5 text-2xl font-bold">{t('public.courses.outcomes')}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {c.outcomes.map(o => (
                <li key={o} className="flex gap-3 rounded-2xl bg-surface p-4">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand text-white"><Check size={14} aria-hidden="true" /></span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12" aria-labelledby="curriculum">
            <h2 id="curriculum" className="mb-5 text-2xl font-bold">{t('public.courses.curriculum')}</h2>
            <div className="flex flex-col gap-3">
              {c.modules.map((m, i) => {
                const mins = m.lessons.reduce((n, l) => n + l.minutes, 0);
                return (
                  <details key={m.id} open={i === 0} className="group rounded-[var(--radius-card)] border border-line bg-bg">
                    <summary className="flex cursor-pointer list-none items-center gap-4 p-5 [&::-webkit-details-marker]:hidden">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface font-display font-bold">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{m.title}</span>
                        <span className="block text-sm text-muted">{t('public.courses.lessons', { n: m.lessons.length })} · {mins} min</span>
                      </span>
                      <ChevronDown size={20} aria-hidden="true" className="shrink-0 text-muted transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="border-t border-line px-5 py-2">
                      {m.lessons.map(l => {
                        const Icon = lessonIcon[l.type];
                        return (
                          <li key={l.id} className="flex items-center gap-3 py-3 text-[15px]">
                            <span className="text-brand" title={t(`learner.lessonType.${l.type}`)}><Icon size={18} aria-hidden /></span>
                            <span className="sr-only">{t(`learner.lessonType.${l.type}`)}:</span>
                            <span className="min-w-0 flex-1">{l.title}</span>
                            <span className="shrink-0 text-sm text-muted">{l.minutes} min</span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-bg">
            <CourseCover pillarId={c.pillarId} program={c.program} level={t(`public.courses.level.${c.level}`)} className="rounded-none!" />
            <div className="p-6">
              <dl className="flex flex-col gap-4">
                {facts.map(f => (
                  <div key={f.label} className="flex items-start gap-3">
                    <span className="mt-0.5 text-brand" aria-hidden="true">{f.icon}</span>
                    <div>
                      <dt className="text-sm text-muted">{f.label}</dt>
                      <dd className="font-semibold">{f.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              <EnrolButton courseId={c.id} slug={c.slug} className="mt-6 w-full" />
              <p className="mt-3 text-center text-sm text-muted">{t('public.courses.certNote')}</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
