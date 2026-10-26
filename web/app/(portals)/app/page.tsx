'use client';

// Learner home. Reference page for the dashboard style: banner with the one thing to do next,
// a compact stat row, course cards with covers, and an upcoming list. Data comes only from services.

import Link from 'next/link';
import { ArrowRight, Award, Clock, PlayCircle, Radio } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  Async, CourseCover, DateBadge, KpiTile, Meter, Panel, PanelLink, PillarTag, Row, Skeleton, SkeletonPanel, WelcomeBanner,
} from '@/components/dash';
import { useApi } from '@/lib/api/hooks';
import { certificates, lms, recommendations, schedule } from '@/lib/api/services';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { date, pct, dateLocale, fmtDate } from '@/lib/format';

const time = (iso: string) => fmtDate(new Date(iso), { hour: '2-digit', minute: '2-digit' });

export default function LearnerHome() {
  const t = useT();
  const { user } = useSession();
  const courses = useApi(() => lms.listMyCourses(), []);
  const upcoming = useApi(() => schedule.listUpcoming({ query: { limit: 4 } }), []);
  const certs = useApi(() => certificates.listMine(), []);
  const recs = useApi(() => recommendations.forMe({ query: { limit: 3 } }), []);

  const first = user?.name.split(' ')[0] ?? '';
  const active = courses.data?.find(c => c.status !== 'completed');
  const inProgress = courses.data?.filter(c => c.status !== 'completed').length ?? 0;
  const lessonsDone = courses.data?.reduce((s, c) => s + c.lessonsDone, 0) ?? 0;
  const hours = courses.data?.reduce((s, c) => s + c.course.hours * c.progress, 0) ?? 0;

  return (
    <div className="space-y-6">
      {courses.loading && !courses.data ? <Skeleton className="h-44 w-full rounded-[var(--radius-card)]" /> : (
        <WelcomeBanner
          title={t('learner.home.welcome', { name: first })}
          text={active ? <>{active.course.title} <span className="text-white/60">·</span> {t('learner.home.percentDone', { pct: pct(active.progress) })}</> : t('learner.home.noActive')}
          actions={active ? (
            <>
              <Link href={`/app/learn/${active.course.slug}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 font-semibold text-brand-dark transition hover:bg-white/90">
                <PlayCircle size={18} /> {t('learner.home.resume')}
              </Link>
              <Link href="/courses" className="inline-flex h-11 items-center rounded-full border border-white/40 px-5 font-semibold text-white transition hover:bg-white/10">{t('learner.home.browse')}</Link>
            </>
          ) : <Link href="/courses" className="inline-flex h-11 items-center rounded-full bg-white px-5 font-semibold text-brand-dark">{t('learner.home.browse')}</Link>}
          aside={active?.nextLesson && (
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm backdrop-blur-sm md:max-w-64">
              <div className="text-white/70">{t('learner.home.nextUp')}</div>
              <div className="font-semibold">{active.nextLesson.title}</div>
              <div className="mt-1 flex items-center gap-1 text-white/70"><Clock size={14} /> {active.nextLesson.minutes} min</div>
            </div>
          )}
        />
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label={t('learner.home.inProgress')} value={courses.data ? inProgress : <Skeleton className="h-7 w-10" />} />
        <KpiTile label={t('learner.home.lessonsDone')} value={courses.data ? lessonsDone : <Skeleton className="h-7 w-10" />} />
        <KpiTile label={t('learner.home.hours')} value={courses.data ? hours.toFixed(1) : <Skeleton className="h-7 w-10" />} />
        <KpiTile label={t('learner.home.certificates')} value={certs.data ? certs.data.length : <Skeleton className="h-7 w-10" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={t('learner.home.myCourses')} action={<PanelLink href="/app/courses">{t('ui.viewAll')}</PanelLink>}>
          <Async state={courses} skeleton={<div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>}
            empty={d => d.length === 0}
            emptyView={<div className="py-8 text-center text-muted">{t('learner.home.noCourses')} <Link href="/courses" className="font-semibold text-brand">{t('learner.home.browse')}</Link></div>}>
            {data => (
              <div className="grid gap-4 sm:grid-cols-2">
                {data.slice(0, 4).map(c => (
                  <Link key={c.course.id} href={`/app/learn/${c.course.slug}`} className="group rounded-2xl border border-line p-2 transition hover:border-brand/30 hover:shadow-[0_12px_32px_-20px_rgba(120,40,0,.45)]">
                    <CourseCover pillarId={c.course.pillarId} program={c.course.program} level={t(`learner.level.${c.course.level}`)} />
                    <div className="px-2 pb-2 pt-3">
                      <PillarTag id={c.course.pillarId} label={t(`pillar.${c.course.pillarId}`)} className="text-xs" />
                      <h3 className="mt-1 line-clamp-2 font-bold leading-snug group-hover:text-brand">{c.course.title}</h3>
                      <div className="mt-3 flex items-center gap-3">
                        <Meter value={c.progress} tone={c.status === 'completed' ? 'ok' : 'brand'} label={c.course.title} />
                        <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{pct(c.progress)}</span>
                      </div>
                      <div className="mt-1.5 text-sm text-muted">{t('learner.home.lessonsOf', { done: c.lessonsDone, total: c.lessonsTotal })}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Async>
        </Panel>

        <div className="space-y-6">
          <Panel title={t('learner.home.upcoming')} action={<PanelLink href="/app/schedule">{t('nav.schedule')}</PanelLink>}>
            <Async state={upcoming} skeleton={<div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>}
              empty={d => d.length === 0} emptyView={<p className="py-4 text-sm text-muted">{t('learner.home.nothingScheduled')}</p>}>
              {data => (
                <ul className="-mx-2">
                  {data.map((s, i) => (
                    <li key={s.id}>
                      <Row leading={<DateBadge iso={s.startsAt} tone={i === 0 ? 'brand' : 'neutral'} />}
                        title={s.title}
                        sub={<span className="inline-flex items-center gap-1.5">
                          {s.kind === 'live' && <Radio size={13} className="text-brand" />}
                          {s.kind === 'live' ? `${t('learner.home.live')} · ${time(s.startsAt)}` : s.kind === 'deadline' ? t('learner.home.deadline') : t('learner.home.event')}
                        </span>}
                        href="/app/schedule" />
                    </li>
                  ))}
                </ul>
              )}
            </Async>
          </Panel>

          <Panel title={t('learner.home.certificates')} action={<PanelLink href="/app/certificates">{t('ui.viewAll')}</PanelLink>}>
            <Async state={certs} skeleton={<Skeleton className="h-12" />} empty={d => d.length === 0}
              emptyView={<p className="py-2 text-sm text-muted">{t('learner.home.noCertificates')}</p>}>
              {data => (
                <ul className="-mx-2">
                  {data.slice(0, 3).map(c => (
                    <li key={c.code}>
                      <Row href={`/app/certificates/${c.code}`} leading={<span className="grid size-10 place-items-center rounded-xl bg-gold-light text-[#8a5a0c] dark:bg-gold/20 dark:text-gold"><Award size={18} /></span>}
                        title={c.courseTitle} sub={date(c.issuedAt)} />
                    </li>
                  ))}
                </ul>
              )}
            </Async>
          </Panel>
        </div>
      </div>

      <Panel title={t('learner.home.recommended')} action={<PanelLink href="/courses">{t('learner.home.browse')}</PanelLink>}>
        <Async state={recs} skeleton={<SkeletonPanel rows={2} />} empty={d => d.length === 0} emptyView={null}>
          {data => (
            <div className="grid gap-4 md:grid-cols-3">
              {data.map(({ course, reason }) => (
                <Link key={course.id} href={`/courses/${course.slug}`} className="group flex gap-3 rounded-2xl border border-line p-3 transition hover:border-brand/30">
                  <CourseCover pillarId={course.pillarId} program={course.program} size="sm" className="w-24 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-muted">{reason}</div>
                    <div className="line-clamp-2 font-bold leading-snug group-hover:text-brand">{course.title}</div>
                    <div className="mt-1 text-sm text-muted">{course.hours} h · {t(`learner.level.${course.level}`)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Async>
      </Panel>

      <div className="flex justify-end">
        <Button variant="link" href="/app/pitch">{t('learner.home.pitchCta')} <ArrowRight size={16} /></Button>
      </div>
    </div>
  );
}
