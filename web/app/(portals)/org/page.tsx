'use client';

// Organisation home: next engagement, money owed, assessment score, recent invoices and bookings.

import Link from 'next/link';
import { ArrowRight, ClipboardCheck, GraduationCap, MapPin, Receipt, Users } from 'lucide-react';
import { Button } from '@/components/ui';
import { Async, DateBadge, KpiTile, Meter, Panel, PanelLink, Row, Skeleton, StatusPill, WelcomeBanner } from '@/components/dash';
import { useOrgLabels } from '@/components/org/bits';
import { useApi } from '@/lib/api/hooks';
import { assessment, capacity } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { date, rwf } from '@/lib/format';

export default function OrgOverview() {
  const t = useT();
  const L = useOrgLabels();
  const org = useApi(() => capacity.getOrganisation(), []);
  const summary = useApi(() => capacity.getSummary(), []);
  const latest = useApi(() => assessment.latest(), []);
  const invoices = useApi(() => capacity.listInvoices({ query: { pageSize: 4 } }), []);
  const bookings = useApi(() => capacity.listBookings(), []);

  const s = summary.data;
  const a = latest.data;
  const next = s?.nextEngagement;
  const tile = (v: React.ReactNode | undefined) => v ?? <Skeleton className="h-7 w-16" />;
  const delta = a && a.previousOverall !== null ? L.score(a.overall) - L.score(a.previousOverall) : null;

  return (
    <div className="space-y-6">
      {org.loading && !org.data ? <Skeleton className="h-40 w-full rounded-[var(--radius-card)]" /> : (
        <WelcomeBanner
          title={org.data?.name ?? t('org.home.title')}
          text={next ? t('org.home.nextOn', { title: next.topicTitles.join(', '), date: date(next.start) }) : t('org.home.noNext')}
          actions={
            <>
              <Link href="/org/book" className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 font-semibold text-brand-dark transition hover:bg-white/90">
                <GraduationCap size={18} aria-hidden="true" /> {t('org.home.book')}
              </Link>
              <Link href="/org/assessment" className="inline-flex h-11 items-center rounded-full border border-white/40 px-5 font-semibold text-white transition hover:bg-white/10">
                {a ? t('org.home.seeResults') : t('org.home.startAssessment')}
              </Link>
            </>
          }
        />
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label={t('org.home.outstanding')} tone={s && s.outstanding > 0 ? 'brand' : undefined} value={tile(s && rwf(s.outstanding))}
          hint={s && s.overdueCount > 0 ? t('org.home.overdue', { n: s.overdueCount }) : undefined} />
        <KpiTile label={t('org.home.paid')} value={tile(s && rwf(s.paid))} />
        <KpiTile label={t('org.home.upcoming')} value={tile(s?.upcomingBookings)} hint={s && s.pendingBookings > 0 ? t('org.home.pending', { n: s.pendingBookings }) : undefined} />
        <KpiTile label={t('org.home.score')} value={latest.loading && !latest.data ? <Skeleton className="h-7 w-12" /> : a ? L.score(a.overall) : t('org.home.notTaken')}
          delta={delta !== null && delta !== 0 ? { value: `${delta > 0 ? '+' : ''}${delta}`, good: delta > 0 } : undefined}
          hint={delta !== null ? t('org.home.sinceLast') : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Panel title={t('org.home.nextEngagement')} action={<PanelLink href="/org/bookings">{t('nav.bookings')}</PanelLink>}>
            <Async state={summary} skeleton={<Skeleton className="h-24" />}>
              {d => d.nextEngagement ? (
                <div className="flex gap-4">
                  <DateBadge iso={d.nextEngagement.start} tone="brand" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold leading-snug">{d.nextEngagement.topicTitles.join(', ')}</h3>
                      <StatusPill status={d.nextEngagement.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                      <span>{d.nextEngagement.window}</span>
                      <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" />{L.mode(d.nextEngagement.mode)}, {d.nextEngagement.location}</span>
                      <span className="inline-flex items-center gap-1.5"><Users size={14} aria-hidden="true" />{t('org.home.participants', { n: d.nextEngagement.participants })}</span>
                    </div>
                    <div className="mt-1 text-sm text-muted">{t('org.home.packageRef', { pkg: d.nextEngagement.packageName, ref: d.nextEngagement.id.toUpperCase() })}</div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted">{d.pendingBookings > 0 ? t('org.home.waitingConfirm', { n: d.pendingBookings }) : t('org.home.noNext')}</p>
                  <Button size="sm" href="/org/book">{t('org.home.book')}</Button>
                </div>
              )}
            </Async>
          </Panel>

          <Panel title={t('org.home.recentInvoices')} action={<PanelLink href="/org/invoices">{t('ui.viewAll')}</PanelLink>} flush>
            <Async state={invoices} skeleton={<div className="space-y-3 p-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10" />)}</div>}
              empty={d => d.items.length === 0} emptyView={<p className="px-5 pb-5 pt-2 text-sm text-muted">{t('org.inv.none')}</p>}>
              {d => (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[15px]">
                    <caption className="sr-only">{t('org.home.recentInvoices')}</caption>
                    <thead className="text-[13px] text-muted">
                      <tr className="border-b border-line">
                        <th scope="col" className="px-5 py-3 font-semibold">{t('org.inv.number')}</th>
                        <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">{t('org.inv.due')}</th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold">{t('org.inv.balance')}</th>
                        <th scope="col" className="px-5 py-3 font-semibold">{t('ui.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {d.items.map(inv => (
                        <tr key={inv.id} className="transition-colors hover:bg-surface">
                          <td className="px-5 py-3"><Link href={`/org/invoices/${inv.id}`} className="font-semibold text-brand hover:underline">{inv.number}</Link></td>
                          <td className="hidden whitespace-nowrap px-4 py-3 text-muted sm:table-cell">{date(inv.dueAt)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{rwf(inv.totals.balance)}</td>
                          <td className="px-5 py-3"><StatusPill status={inv.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Async>
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title={t('org.home.assessment')} action={a ? <PanelLink href="/org/assessment">{t('org.home.details')}</PanelLink> : undefined}>
            <Async state={latest} skeleton={<Skeleton className="h-28" />}>
              {r => r ? (
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-[32px] font-bold leading-none tabular-nums">{L.score(r.overall)}<span className="text-base font-semibold text-muted">/100</span></span>
                    <span className="text-sm font-semibold">{L.band(r.overall)}</span>
                  </div>
                  <Meter className="mt-3" value={r.overall} tone={r.overall >= 0.75 ? 'ok' : r.overall >= 0.5 ? 'gold' : 'brand'} label={t('org.home.score')} />
                  <div className="mt-4 text-sm text-muted">{t('org.home.focus')}</div>
                  <div className="font-semibold">{r.topics.map(x => x.title).join(', ')}</div>
                  <div className="mt-1 text-sm text-muted">{t('org.home.completed', { date: date(r.completedAt.slice(0, 10)) })}</div>
                  <Button size="sm" className="mt-4" href={`/org/book?topics=${r.topics.map(x => x.id).join(',')}&package=${r.packageId}`}>{t('org.assess.bookThese')}</Button>
                </div>
              ) : (
                <div>
                  <p className="text-muted">{t('org.home.assessmentPrompt')}</p>
                  <Button size="sm" className="mt-4" href="/org/assessment">{t('org.home.startAssessment')}</Button>
                </div>
              )}
            </Async>
          </Panel>

          <Panel title={t('nav.bookings')} action={<PanelLink href="/org/bookings">{t('ui.viewAll')}</PanelLink>}>
            <Async state={bookings} skeleton={<div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</div>}
              empty={d => d.length === 0} emptyView={<p className="py-2 text-sm text-muted">{t('org.bk.none')}</p>}>
              {d => (
                <ul className="-mx-2">
                  {d.slice(0, 4).map(b => (
                    <li key={b.id}>
                      <Row href="/org/bookings" leading={<DateBadge iso={b.start} />} title={b.topicTitles.join(', ')}
                        sub={`${b.packageName} · ${L.mode(b.mode)}`} trailing={<StatusPill status={b.status} className="hidden sm:inline-flex" />} />
                    </li>
                  ))}
                </ul>
              )}
            </Async>
          </Panel>

          <Panel title={t('org.home.quick')}>
            <ul className="-mx-2">
              {[
                { href: '/org/book', label: t('org.home.book'), icon: GraduationCap },
                { href: '/org/assessment', label: a ? t('org.home.retake') : t('org.home.startAssessment'), icon: ClipboardCheck },
                { href: '/org/invoices', label: t('org.home.downloadInvoice'), icon: Receipt },
                { href: '/org/profile', label: t('org.home.addColleague'), icon: Users },
              ].map(q => (
                <li key={q.href}>
                  <Row href={q.href} leading={<span className="grid size-10 place-items-center rounded-xl bg-surface text-brand"><q.icon size={18} aria-hidden="true" /></span>}
                    title={q.label} trailing={<ArrowRight size={16} className="text-subtle" aria-hidden="true" />} />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
