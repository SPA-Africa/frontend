'use client';

// My courses: in progress, completed, and the catalogue to enrol from.

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Award, BookOpen, Check, Clock, Globe, Search } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { Modal, Tabs, useToast } from '@/components/ui/client';
import { Async, CourseCover, Meter, PageHead, Panel, PillarTag, Skeleton } from '@/components/dash';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { catalog, certificates, lms } from '@/lib/api/services';
import type { MyCourse } from '@/lib/api/services/core/lms';
import { useT } from '@/lib/i18n';
import type { Course, PillarId } from '@/lib/types';
import { cx, date, num, pct } from '@/lib/format';

type Tab = 'progress' | 'completed' | 'browse';
const TABS: Tab[] = ['progress', 'completed', 'browse'];
const PILLARS: PillarId[] = ['technology', 'education', 'leadership', 'young_startups', 'agriculture'];
const LEVELS: Course['level'][] = ['Beginner', 'Intermediate', 'Advanced'];
const PAGE = 12;

export default function CoursesPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><Courses /></Suspense>;
}

function CardGridSkeleton() {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-72 rounded-[var(--radius-card)]" />)}</div>;
}

function Courses() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get('tab') as Tab | null;
  const [tab, setTabState] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'progress');
  const setTab = (next: Tab) => { setTabState(next); router.replace(`${pathname}?tab=${next}`, { scroll: false }); };

  const mine = useApi(() => lms.listMyCourses(), []);
  const certs = useApi(() => certificates.listMine(), []);
  const { toast, toastNode } = useToast();

  const inProgress = mine.data?.filter(c => c.status !== 'completed') ?? [];
  const completed = mine.data?.filter(c => c.status === 'completed') ?? [];
  const enrolledIds = new Set(mine.data?.map(c => c.course.id));

  const [enrolling, setEnrolling] = useState<string | null>(null);
  const enrol = async (c: Course) => {
    setEnrolling(c.id);
    try {
      const mc = await lms.enrol({ body: { courseId: c.id } });
      mine.setData(list => [mc, ...(list ?? []).filter(x => x.course.id !== c.id)]);
      toast(t('learner.courses.enrolled', { title: c.title }));
      return true;
    } catch (e) {
      toast(errorMessage(e));
      return false;
    } finally {
      setEnrolling(null);
    }
  };

  return (
    <>
      <PageHead title={t('learner.courses.title')} actions={tab !== 'browse' && <Button variant="ghost" onClick={() => setTab('browse')}><Search size={16} /> {t('learner.courses.findCourse')}</Button>} />
      <Tabs<Tab> value={tab} onChange={setTab} className="mb-6" tabs={[
        { id: 'progress', label: t('learner.courses.tabProgress'), count: mine.data ? inProgress.length : undefined },
        { id: 'completed', label: t('learner.courses.tabCompleted'), count: mine.data ? completed.length : undefined },
        { id: 'browse', label: t('learner.courses.tabBrowse') },
      ]} />

      {tab === 'progress' && (
        <Async state={mine} skeleton={<CardGridSkeleton />} empty={() => inProgress.length === 0}
          emptyView={<EmptyPanel icon={<BookOpen size={22} />} title={t('learner.courses.noneInProgress')} action={<Button onClick={() => setTab('browse')}>{t('learner.home.browse')}</Button>} />}>
          {() => (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {inProgress.map(c => <ProgressCard key={c.course.id} c={c} />)}
            </div>
          )}
        </Async>
      )}

      {tab === 'completed' && (
        <Async state={mine} skeleton={<CardGridSkeleton />} empty={() => completed.length === 0}
          emptyView={<EmptyPanel icon={<Award size={22} />} title={t('learner.courses.noneCompleted')} />}>
          {() => (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {completed.map(c => {
                const cert = certs.data?.find(x => x.courseTitle === c.course.title);
                return (
                  <article key={c.course.id} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-bg p-2">
                    <CourseCover pillarId={c.course.pillarId} program={c.course.program} level={t(`learner.level.${c.course.level}`)} />
                    <div className="flex flex-1 flex-col px-3 pb-3 pt-3">
                      <PillarTag id={c.course.pillarId} label={t(`pillar.${c.course.pillarId}`)} className="text-xs" />
                      <h2 className="mt-1 font-bold leading-snug">{c.course.title}</h2>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted"><Check size={15} className="text-ok" /> {t('learner.courses.completedOn', { date: date(c.lastActive.slice(0, 10)) })}</p>
                      <div className="mt-auto flex flex-wrap gap-2 pt-4">
                        <Button size="sm" href={cert ? `/app/certificates/${cert.code}` : '/app/certificates'}><Award size={15} /> {t('learner.courses.viewCertificate')}</Button>
                        <Button size="sm" variant="ghost" href={`/app/learn/${c.course.slug}`}>{t('learner.courses.review')}</Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Async>
      )}

      {tab === 'browse' && <Browse enrolledIds={enrolledIds} enrol={enrol} enrolling={enrolling} />}
      {toastNode}
    </>
  );
}

function EmptyPanel({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <Panel>
      <div className="flex flex-col items-center py-8 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-surface text-brand">{icon}</span>
        <p className="mt-3 font-semibold">{title}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </Panel>
  );
}

function ProgressCard({ c }: { c: MyCourse }) {
  const t = useT();
  return (
    <Link href={`/app/learn/${c.course.slug}`} className="group flex flex-col rounded-[var(--radius-card)] border border-line bg-bg p-2 transition hover:border-brand/30">
      <CourseCover pillarId={c.course.pillarId} program={c.course.program} level={t(`learner.level.${c.course.level}`)} />
      <div className="flex flex-1 flex-col px-3 pb-3 pt-3">
        <PillarTag id={c.course.pillarId} label={t(`pillar.${c.course.pillarId}`)} className="text-xs" />
        <h2 className="mt-1 line-clamp-2 font-bold leading-snug group-hover:text-brand">{c.course.title}</h2>
        <div className="mt-3 flex items-center gap-3">
          <Meter value={c.progress} label={c.course.title} />
          <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{pct(c.progress)}</span>
        </div>
        <div className="mt-1.5 text-sm text-muted">{t('learner.home.lessonsOf', { done: c.lessonsDone, total: c.lessonsTotal })}</div>
        {c.nextLesson && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate"><span className="text-muted">{t('learner.home.nextUp')}</span> <span className="font-semibold">{c.nextLesson.title}</span></span>
            <span className="inline-flex shrink-0 items-center gap-1 text-muted"><Clock size={13} /> {c.nextLesson.minutes} min</span>
          </div>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-brand">
          {c.progress > 0 ? t('learner.courses.resume') : t('learner.courses.start')} <ArrowRight size={16} />
        </span>
      </div>
    </Link>
  );
}

function Browse({ enrolledIds, enrol, enrolling }: { enrolledIds: Set<string>; enrol: (c: Course) => Promise<boolean>; enrolling: string | null }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [pillar, setPillar] = useState<PillarId | ''>('');
  const [level, setLevel] = useState<Course['level'] | ''>('');
  const [pages, setPages] = useState(1);
  const [preview, setPreview] = useState<Course | null>(null);
  const list = useApi(
    () => catalog.listCourses({ query: { q: q || undefined, pillar: pillar || undefined, level: level || undefined, pageSize: PAGE * pages } }),
    [q, pillar, level, pages],
  );
  const resetPages = () => setPages(1);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1 sm:max-w-md">
            <span className="sr-only">{t('learner.courses.search')}</span>
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" />
            <Input type="search" placeholder={t('learner.courses.search')} value={q} onChange={e => { setQ(e.target.value); resetPages(); }} className="pl-11" />
          </label>
          <label className="sm:w-48">
            <span className="sr-only">{t('learner.courses.level')}</span>
            <Select value={level} onChange={e => { setLevel(e.target.value as Course['level'] | ''); resetPages(); }}>
              <option value="">{t('learner.courses.anyLevel')}</option>
              {LEVELS.map(l => <option key={l} value={l}>{t(`learner.level.${l}`)}</option>)}
            </Select>
          </label>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t('learner.courses.filterPillar')}>
          {(['', ...PILLARS] as const).map(p => (
            <button key={p || 'all'} type="button" onClick={() => { setPillar(p); resetPages(); }} aria-pressed={pillar === p}
              className={cx('h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition',
                pillar === p ? 'border-brand bg-brand text-white' : 'border-line bg-bg text-muted hover:text-ink')}>
              {p ? t(`pillar.${p}`) : t('learner.courses.allPillars')}
            </button>
          ))}
        </div>
      </div>

      <Async state={list} skeleton={<CardGridSkeleton />} empty={d => d.total === 0}
        emptyView={<EmptyPanel icon={<Search size={22} />} title={t('learner.courses.noMatch')} />}>
        {page => (
          <>
            <p className="mb-4 text-sm text-muted" aria-live="polite">{t('learner.courses.count', { n: page.total })}</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {page.items.map(c => {
                const enrolled = enrolledIds.has(c.id);
                return (
                  <article key={c.id} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-bg p-2">
                    <CourseCover pillarId={c.pillarId} program={c.program} level={t(`learner.level.${c.level}`)} />
                    <div className="flex flex-1 flex-col px-3 pb-3 pt-3">
                      <PillarTag id={c.pillarId} label={t(`pillar.${c.pillarId}`)} className="text-xs" />
                      <h2 className="mt-1 font-bold leading-snug">{c.title}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{c.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-subtle">
                        <span>{t('learner.courses.hours', { n: c.hours })}</span>
                        <span>{t('learner.courses.learners', { n: num(c.enrolled) })}</span>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2 pt-4">
                        {enrolled
                          ? <Button size="sm" variant="ghost" href={`/app/learn/${c.slug}`}><Check size={15} /> {t('learner.courses.open')}</Button>
                          : <Button size="sm" onClick={() => enrol(c)} disabled={enrolling === c.id}>{enrolling === c.id ? t('learner.courses.enrolling') : t('learner.courses.enrol')}</Button>}
                        <Button size="sm" variant="subtle" onClick={() => setPreview(c)}>{t('learner.courses.details')}</Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {page.items.length < page.total && (
              <div className="mt-6 flex justify-center">
                <Button variant="ghost" onClick={() => setPages(n => n + 1)} disabled={list.loading}>{t('learner.courses.loadMore')}</Button>
              </div>
            )}
          </>
        )}
      </Async>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ''}
        footer={preview && (enrolledIds.has(preview.id)
          ? <Button href={`/app/learn/${preview.slug}`}>{t('learner.courses.open')}</Button>
          : <>
            <Button variant="ghost" onClick={() => setPreview(null)}>{t('ui.cancel')}</Button>
            <Button disabled={enrolling === preview.id} onClick={async () => { if (await enrol(preview)) setPreview(null); }}>{t('learner.courses.enrolFree')}</Button>
          </>)}>
        {preview && (
          <div className="space-y-5">
            <PillarTag id={preview.pillarId} label={t(`pillar.${preview.pillarId}`)} />
            <p className="text-muted">{preview.summary}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5"><Clock size={16} className="text-brand" /> {t('learner.courses.hours', { n: preview.hours })}</span>
              <span className="inline-flex items-center gap-1.5"><Globe size={16} className="text-brand" /> {preview.language.join(', ')}</span>
              <span className="inline-flex items-center gap-1.5"><BookOpen size={16} className="text-brand" /> {t('learner.courses.modules', { n: preview.modules.length })}</span>
            </div>
            <div>
              <h3 className="mb-2 font-bold">{t('learner.courses.outcomes')}</h3>
              <ul className="space-y-2">
                {preview.outcomes.map(o => <li key={o} className="flex gap-2 text-[15px]"><Check size={18} className="mt-0.5 shrink-0 text-ok" />{o}</li>)}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
