'use client';

// Bookings (FR-C4.5, FR-C4.6): table with search, status filter and CSV export; detail modal with
// cancel (pending only) and a request for new dates.

import { useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Plus, Receipt } from 'lucide-react';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { Modal, useToast } from '@/components/ui/client';
import { Async, DataTable, PageHead, SkeletonPanel, StatusPill, type Column } from '@/components/dash';
import { Detail, ORG_TODAY, useOrgLabels } from '@/components/org/bits';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { capacity } from '@/lib/api/services';
import type { BookingView } from '@/lib/api/services/core/capacity';
import type { BookingStatus } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { date } from '@/lib/format';

const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled'];

export default function BookingsPage() {
  const t = useT();
  const L = useOrgLabels();
  const list = useApi(() => capacity.listBookings(), []);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = list.data?.find(b => b.id === openId) ?? null;

  const replace = (b: BookingView) => list.setData(d => d?.map(x => (x.id === b.id ? b : x)));

  const columns: Column<BookingView>[] = [
    { id: 'ref', header: t('org.bk.reference'), value: b => b.id.toUpperCase(), cell: b => <span className="font-mono text-sm font-semibold">{b.id.toUpperCase()}</span> },
    {
      id: 'topics', header: t('org.book.sTopics'), value: b => b.topicTitles.join(', '),
      cell: b => <div className="min-w-48 max-w-xs"><div className="font-semibold">{b.topicTitles.join(', ')}</div><div className="text-sm text-muted">{L.mode(b.mode)}, {b.location}</div></div>,
    },
    { id: 'start', header: t('org.book.dates'), value: b => b.start, cell: b => <span className="whitespace-nowrap">{b.window}</span> },
    { id: 'pkg', header: t('org.book.sPackage'), value: b => b.packageName, cell: b => b.packageName, hideOnMobile: true },
    { id: 'people', header: t('org.book.participants'), value: b => b.participants, cell: b => b.participants, align: 'right', hideOnMobile: true },
    { id: 'status', header: t('ui.status'), value: b => b.status, cell: b => <StatusPill status={b.status} /> },
  ];

  return (
    <>
      <PageHead title={t('nav.bookings')} actions={<Button href="/org/book"><Plus size={18} aria-hidden="true" /> {t('org.bk.new')}</Button>} />

      <Async state={list} skeleton={<SkeletonPanel rows={5} />}>
        {rows => (
          <DataTable rows={rows} columns={columns} rowKey={b => b.id} onRowClick={b => setOpenId(b.id)}
            search={b => `${b.id} ${b.topicTitles.join(' ')} ${b.location} ${b.packageName}`} searchPlaceholder={t('org.bk.search')}
            filters={[{ id: 'status', label: t('ui.status'), get: b => b.status, options: STATUSES.map(s => ({ value: s, label: t(`status.${s}`) })) }]}
            exportName="bookings" caption={t('nav.bookings')}
            empty={<div className="flex flex-col items-center gap-3"><p className="text-muted">{t('org.bk.none')}</p><Button size="sm" href="/org/book">{t('org.home.book')}</Button></div>} />
        )}
      </Async>

      {open && <BookingModal b={open} onClose={() => setOpenId(null)} onChange={replace} />}
    </>
  );
}

function BookingModal({ b, onClose, onChange }: { b: BookingView; onClose: () => void; onChange: (b: BookingView) => void }) {
  const t = useT();
  const L = useOrgLabels();
  const { toast, toastNode } = useToast();
  const [mode, setMode] = useState<'view' | 'cancel' | 'move'>('view');
  const [busy, setBusy] = useState(false);
  const [mv, setMv] = useState({ start: '', end: '', reason: '' });
  const canMove = ['pending', 'confirmed', 'rescheduled'].includes(b.status) && !b.rescheduleRequest;

  const run = async (fn: () => Promise<BookingView>, ok: string) => {
    setBusy(true);
    try {
      onChange(await fn());
      setMode('view');
      toast(ok);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const moveError = !mv.start ? t('org.book.errStart') : mv.start < ORG_TODAY() ? t('org.book.errPast') : mv.end && mv.end < mv.start ? t('org.book.errEnd') : !mv.reason.trim() ? t('org.bk.errReason') : null;

  const footer = mode === 'cancel' ? (
    <>
      <Button variant="ghost" onClick={() => setMode('view')}>{t('org.bk.keep')}</Button>
      <Button disabled={busy} onClick={() => run(() => capacity.cancelBooking({ params: { id: b.id } }), t('org.bk.cancelled'))}>{t('org.bk.confirmCancel')}</Button>
    </>
  ) : mode === 'move' ? (
    <>
      <Button variant="ghost" onClick={() => setMode('view')}>{t('ui.cancel')}</Button>
      <Button disabled={busy || !!moveError}
        onClick={() => run(() => capacity.requestReschedule({ params: { id: b.id }, body: { start: mv.start, end: mv.end || undefined, reason: mv.reason } }), t('org.bk.moveSent'))}>
        {t('org.bk.sendRequest')}
      </Button>
    </>
  ) : (
    <>
      {b.status === 'pending' && <Button variant="danger" onClick={() => setMode('cancel')}>{t('org.bk.cancel')}</Button>}
      {canMove && <Button variant="ghost" onClick={() => setMode('move')}><CalendarClock size={16} aria-hidden="true" /> {t('org.bk.move')}</Button>}
      <Button variant="ghost" onClick={onClose}>{t('ui.close')}</Button>
    </>
  );

  return (
    <Modal open onClose={onClose} title={t('org.bk.title', { ref: b.id.toUpperCase() })} footer={footer} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2"><StatusPill status={b.status} /><span className="text-sm text-muted">{t('org.bk.requested', { date: date(b.createdAt) })}</span></div>

        {mode === 'cancel' && <p className="rounded-2xl bg-brand-light p-4 text-[15px] text-ink dark:bg-brand/15">{t('org.bk.cancelWarn')}</p>}

        {mode === 'move' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('org.book.start')} htmlFor="mv-start"><Input id="mv-start" type="date" min={ORG_TODAY()} value={mv.start} onChange={e => setMv(x => ({ ...x, start: e.target.value }))} /></Field>
            <Field label={t('org.book.end')} htmlFor="mv-end" optional><Input id="mv-end" type="date" min={mv.start || ORG_TODAY()} value={mv.end} onChange={e => setMv(x => ({ ...x, end: e.target.value }))} /></Field>
            <div className="sm:col-span-2">
              <Field label={t('org.bk.moveReason')} htmlFor="mv-reason"><Textarea id="mv-reason" value={mv.reason} onChange={e => setMv(x => ({ ...x, reason: e.target.value }))} /></Field>
            </div>
            {moveError && <p className="text-sm text-muted sm:col-span-2" aria-live="polite">{moveError}</p>}
          </div>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label={t('org.book.sTopics')} className="sm:col-span-2">{b.topicTitles.join(', ')}</Detail>
            <Detail label={t('org.book.dates')}>{b.window}</Detail>
            <Detail label={t('org.book.sPackage')}>{b.packageName}</Detail>
            <Detail label={t('org.book.participants')}>{b.participants}</Detail>
            <Detail label={t('org.book.mode')}>{L.mode(b.mode)}, {b.location}</Detail>
            {b.overrideReason && <Detail label={t('org.book.reasonShort')} className="sm:col-span-2"><span className="font-normal">{b.overrideReason}</span></Detail>}
            {b.notes && <Detail label={t('org.book.notes')} className="sm:col-span-2"><span className="font-normal">{b.notes}</span></Detail>}
            {b.rescheduleRequest && (
              <Detail label={t('org.bk.moveRequested')} className="sm:col-span-2">
                {date(b.rescheduleRequest.start)}{b.rescheduleRequest.end ? ` ${t('org.to')} ${date(b.rescheduleRequest.end)}` : ''}
                <span className="block text-sm font-normal text-muted">{b.rescheduleRequest.reason}</span>
              </Detail>
            )}
          </dl>
        )}

        {mode === 'view' && b.invoiceId && (
          <Link href={`/org/invoices/${b.invoiceId}`} className="flex items-center gap-3 rounded-2xl bg-surface p-4 transition hover:bg-surface-2">
            <Receipt size={18} className="text-brand" aria-hidden="true" />
            <span className="flex-1 font-semibold">{b.invoiceNumber}</span>
            {b.invoiceStatus && <StatusPill status={b.invoiceStatus} />}
          </Link>
        )}
      </div>
      {toastNode}
    </Modal>
  );
}
