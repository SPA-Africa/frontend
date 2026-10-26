'use client';

// Invoices (FR-C4.7): totals, balances and the full list. Online payment is out of scope.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';
import { Async, DataTable, KpiTile, PageHead, Skeleton, SkeletonPanel, StatusPill, type Column } from '@/components/dash';
import { useApi } from '@/lib/api/hooks';
import { capacity } from '@/lib/api/services';
import type { InvoiceRow } from '@/lib/api/services/core/capacity';
import type { InvoiceStatus } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { date, rwf } from '@/lib/format';

const STATUSES: InvoiceStatus[] = ['issued', 'partially_paid', 'paid', 'overdue', 'cancelled'];

export default function InvoicesPage() {
  const t = useT();
  const router = useRouter();
  const summary = useApi(() => capacity.getSummary(), []);
  const list = useApi(() => capacity.listInvoices({ query: { pageSize: 200 } }), []);
  const s = summary.data;
  const tile = (v?: string) => v ?? <Skeleton className="h-7 w-24" />;

  const columns: Column<InvoiceRow>[] = [
    {
      id: 'number', header: t('org.inv.number'), value: i => i.number,
      cell: i => <><Link href={`/org/invoices/${i.id}`} onClick={e => e.stopPropagation()} className="font-semibold text-brand hover:underline">{i.number}</Link><div className="text-sm text-muted">{t('org.inv.booking', { ref: i.bookingId.toUpperCase() })}</div></>,
    },
    { id: 'issued', header: t('org.inv.issued'), value: i => i.issuedAt, cell: i => <span className="whitespace-nowrap">{date(i.issuedAt)}</span>, hideOnMobile: true },
    { id: 'due', header: t('org.inv.due'), value: i => i.dueAt, cell: i => <span className="whitespace-nowrap">{date(i.dueAt)}</span> },
    { id: 'total', header: t('org.inv.total'), value: i => i.totals.total, cell: i => <span className="whitespace-nowrap">{rwf(i.totals.total)}</span>, align: 'right', hideOnMobile: true },
    { id: 'balance', header: t('org.inv.balance'), value: i => i.totals.balance, cell: i => <span className="whitespace-nowrap font-semibold">{rwf(i.totals.balance)}</span>, align: 'right' },
    { id: 'status', header: t('ui.status'), value: i => i.status, cell: i => <StatusPill status={i.status} /> },
  ];

  return (
    <>
      <PageHead title={t('nav.invoices')} />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile label={t('org.inv.billed')} value={tile(s && rwf(s.billed))} />
        <KpiTile label={t('org.home.paid')} tone={s ? 'ok' : undefined} value={tile(s && rwf(s.paid))} />
        <KpiTile label={t('org.home.outstanding')} tone={s && s.outstanding > 0 ? 'brand' : undefined} value={tile(s && rwf(s.outstanding))}
          hint={s && s.overdueCount > 0 ? t('org.home.overdue', { n: s.overdueCount }) : undefined} />
      </div>

      <p className="mb-6 flex items-start gap-2 text-sm text-muted">
        <Info size={16} className="mt-0.5 shrink-0 text-info" aria-hidden="true" /> {t('org.inv.paymentNote')}
      </p>

      <Async state={list} skeleton={<SkeletonPanel rows={4} />}>
        {d => (
          <DataTable rows={d.items} columns={columns} rowKey={i => i.id} onRowClick={i => router.push(`/org/invoices/${i.id}`)}
            search={i => `${i.number} ${i.bookingId} ${i.lines.map(l => l.description).join(' ')}`} searchPlaceholder={t('org.inv.search')}
            filters={[{ id: 'status', label: t('ui.status'), get: i => i.status, options: STATUSES.map(x => ({ value: x, label: t(`status.${x}`) })) }]}
            exportName="invoices" caption={t('nav.invoices')} empty={<p className="text-muted">{t('org.inv.none')}</p>} />
        )}
      </Async>
    </>
  );
}
