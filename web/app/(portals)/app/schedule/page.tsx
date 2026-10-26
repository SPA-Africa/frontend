'use client';

// Schedule: live sessions, deadlines and events. List grouped by week, or a month calendar.

import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, Flag, Radio, Video } from 'lucide-react';
import { Button } from '@/components/ui';
import { Tabs, useToast } from '@/components/ui/client';
import { Async, DateBadge, PageHead, Panel, Skeleton } from '@/components/dash';
import { timeOf } from '@/components/learner/bits';
import { JOIN_EARLY_MS, downloadIcs, endOf, groupByWeek, monthGrid, sameDay, weekStart } from '@/components/learner/schedule';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { lms, schedule } from '@/lib/api/services';
import type { ScheduleItem } from '@/lib/api/services/core/schedule';
import { useI18n } from '@/lib/i18n';
import { cx, dateLocale, fmtDate } from '@/lib/format';

type View = 'list' | 'month';

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

const kindIcon = { live: Radio, deadline: Flag, event: Video } as const;

export default function SchedulePage() {
  const { t, locale } = useI18n();
  const loc = locale === 'fr' ? 'fr-FR' : dateLocale();
  const now = useNow();
  const [view, setView] = useState<View>('list');
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState<Date | null>(null);
  const from = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString(); }, []);
  const items = useApi(() => schedule.listUpcoming({ query: { from } }), [from]);
  const courses = useApi(() => lms.listMyCourses(), []);
  const { toast, toastNode } = useToast();

  const courseTitle = (id: string | null) => courses.data?.find(c => c.course.id === id)?.course.title;

  const join = async (s: ScheduleItem) => {
    try {
      const { joinUrl } = await schedule.join({ params: { id: s.id } });
      window.open(joinUrl, '_blank', 'noopener');
    } catch (e) { toast(errorMessage(e)); }
  };
  const addToCalendar = (s: ScheduleItem) => {
    downloadIcs(s, { description: courseTitle(s.courseId), url: `${window.location.origin}/app/schedule` });
    toast(t('learner.schedule.icsSaved'));
  };

  const weekLabel = (week: Date) => {
    const thisWeek = weekStart(new Date(now)).getTime();
    if (week.getTime() === thisWeek) return t('learner.schedule.thisWeek');
    if (week.getTime() === thisWeek + 7 * 864e5) return t('learner.schedule.nextWeek');
    return t('learner.schedule.weekOf', { date: fmtDate(week, { day: 'numeric', month: 'long' }) });
  };

  const row = (s: ScheduleItem, highlight = false, compact = false) => {
    const Icon = kindIcon[s.kind];
    const start = new Date(s.startsAt).getTime();
    const open = s.kind === 'live' && now >= start - JOIN_EARLY_MS && now <= endOf(s);
    const live = s.kind === 'live' && now >= start && now <= endOf(s);
    const course = courseTitle(s.courseId);
    return (
      <li key={s.id} className={cx('flex flex-col gap-3 py-3.5', !compact && 'sm:flex-row sm:items-center')}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <DateBadge iso={s.startsAt} tone={highlight ? 'brand' : 'neutral'} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{s.title}</span>
              {live && <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white"><Radio size={11} /> {t('learner.schedule.liveNow')}</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1"><Icon size={13} className={s.kind === 'live' ? 'text-brand' : undefined} /> {t(`learner.schedule.kind.${s.kind}`)}</span>
              <span aria-hidden>·</span>
              <span>{fmtDate(new Date(s.startsAt), { weekday: 'short' })} {timeOf(s.startsAt)}</span>
              {s.minutes > 0 && <><span aria-hidden>·</span><span className="inline-flex items-center gap-1"><Clock size={13} /> {s.minutes} min</span></>}
              {course && <><span aria-hidden>·</span><span className="truncate">{course}</span></>}
            </div>
          </div>
        </div>
        <div className={cx('flex shrink-0 flex-wrap items-center gap-2 pl-[60px]', !compact && 'sm:pl-0')}>
          <Button size="sm" variant="ghost" onClick={() => addToCalendar(s)} aria-label={t('learner.schedule.addAria', { title: s.title })}>
            <CalendarPlus size={15} /> {t('learner.schedule.add')}
          </Button>
          {s.kind === 'live' && (
            <Button size="sm" onClick={() => join(s)} disabled={!open} aria-describedby={!open ? `opens-${s.id}` : undefined}>
              <Video size={15} /> {t('learner.schedule.join')}
            </Button>
          )}
          {s.kind === 'live' && !open && now < start && (
            <span id={`opens-${s.id}`} className={cx('w-full text-xs text-subtle', !compact && 'sm:w-auto')}>{t('learner.schedule.opensAt', { time: timeOf(new Date(start - JOIN_EARLY_MS).toISOString()) })}</span>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <PageHead title={t('nav.schedule')}
        actions={<Tabs<View> value={view} onChange={setView} tabs={[{ id: 'list', label: t('learner.schedule.list') }, { id: 'month', label: t('learner.schedule.month') }]} />} />

      <Async state={items}
        skeleton={<Panel><div className="space-y-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div></Panel>}>
        {all => {
          if (view === 'list') {
            const upcoming = all.filter(s => endOf(s) >= now);
            if (!upcoming.length) return <Panel><p className="py-6 text-center text-muted">{t('learner.home.nothingScheduled')}</p></Panel>;
            const firstId = upcoming[0].id;
            return (
              <div className="space-y-5">
                {groupByWeek(upcoming).map(g => (
                  <Panel key={g.week.getTime()} title={weekLabel(g.week)}>
                    <ul className="-my-1 divide-y divide-line">{g.items.map(s => row(s, s.id === firstId))}</ul>
                  </Panel>
                ))}
              </div>
            );
          }

          const days = monthGrid(month);
          const inMonth = all.filter(s => { const d = new Date(s.startsAt); return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear(); });
          const shown = selected ? inMonth.filter(s => sameDay(new Date(s.startsAt), selected)) : inMonth;
          const weekdays = days.slice(0, 7).map(d => fmtDate(d, { weekday: 'short' }));
          return (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <Panel title={fmtDate(month, { month: 'long', year: 'numeric' })}
                action={
                  <div className="flex gap-1">
                    <button type="button" onClick={() => { setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); setSelected(null); }} aria-label={t('learner.schedule.prevMonth')}
                      className="grid size-9 place-items-center rounded-full border border-line hover:bg-surface"><ChevronLeft size={16} /></button>
                    <button type="button" onClick={() => { setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); setSelected(null); }} aria-label={t('learner.schedule.nextMonth')}
                      className="grid size-9 place-items-center rounded-full border border-line hover:bg-surface"><ChevronRight size={16} /></button>
                  </div>
                }>
                <div role="grid" aria-label={fmtDate(month, { month: 'long', year: 'numeric' })}>
                  <div role="row" className="grid grid-cols-7 pb-2 text-center text-xs font-semibold text-muted">
                    {weekdays.map(w => <div role="columnheader" key={w}>{w}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {days.map(d => {
                      const dayItems = all.filter(s => sameDay(new Date(s.startsAt), d));
                      const other = d.getMonth() !== month.getMonth();
                      const today = sameDay(d, new Date(now));
                      const isSel = !!selected && sameDay(d, selected);
                      return (
                        <button key={d.toISOString()} type="button" role="gridcell" aria-selected={isSel}
                          aria-label={`${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${dayItems.length ? `, ${t('learner.schedule.items', { n: dayItems.length })}` : ''}`}
                          onClick={() => setSelected(isSel ? null : d)}
                          className={cx('flex min-h-14 flex-col items-stretch rounded-xl border p-1 text-left transition sm:min-h-24 sm:p-1.5',
                            isSel ? 'border-brand bg-brand-light/40 dark:bg-brand/10' : 'border-transparent hover:bg-surface', other && 'opacity-40')}>
                          <span className={cx('grid size-6 place-items-center self-center rounded-full text-xs font-semibold tabular-nums sm:self-start',
                            today && 'bg-brand text-white')}>{d.getDate()}</span>
                          <span className="mt-1 hidden flex-col gap-0.5 sm:flex">
                            {dayItems.slice(0, 2).map(s => (
                              <span key={s.id} className={cx('truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                                s.kind === 'live' ? 'bg-brand-light text-brand-dark dark:bg-brand/20 dark:text-brand-light' : s.kind === 'deadline' ? 'bg-gold-light text-[#8a5a0c] dark:bg-gold/20 dark:text-gold' : 'bg-info-light text-info dark:bg-info/25')}>
                                {s.title}
                              </span>
                            ))}
                            {dayItems.length > 2 && <span className="px-1.5 text-[11px] text-muted">+{dayItems.length - 2}</span>}
                          </span>
                          {dayItems.length > 0 && (
                            <span className="mt-1 flex justify-center gap-0.5 sm:hidden" aria-hidden>
                              {dayItems.slice(0, 3).map(s => <span key={s.id} className={cx('size-1.5 rounded-full', s.kind === 'live' ? 'bg-brand' : s.kind === 'deadline' ? 'bg-gold' : 'bg-info')} />)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
                  {(['live', 'deadline', 'event'] as const).map(k => (
                    <span key={k} className="inline-flex items-center gap-1.5">
                      <span className={cx('size-2 rounded-full', k === 'live' ? 'bg-brand' : k === 'deadline' ? 'bg-gold' : 'bg-info')} /> {t(`learner.schedule.kind.${k}`)}
                    </span>
                  ))}
                </div>
              </Panel>
              <Panel title={selected ? fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' }) : t('learner.schedule.thisMonth')}
                action={selected && <Button variant="link" size="sm" onClick={() => setSelected(null)}>{t('learner.schedule.wholeMonth')}</Button>}>
                {shown.length
                  ? <ul className="-my-1 divide-y divide-line">{shown.map(s => row(s, false, true))}</ul>
                  : <p className="py-4 text-sm text-muted">{t('learner.home.nothingScheduled')}</p>}
              </Panel>
            </div>
          );
        }}
      </Async>
      {toastNode}
    </>
  );
}
