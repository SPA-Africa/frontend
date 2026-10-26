'use client';

// Printable invoice (FR-C4.3). "Download PDF" asks core-svc for a pre-signed MinIO link.

import { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';
import { Download, Info, Printer } from 'lucide-react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { Async, PageHead, SkeletonPanel, StatusPill } from '@/components/dash';
import { PrintStyles } from '@/components/org/bits';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { capacity } from '@/lib/api/services';
import type { InvoiceDetail } from '@/lib/api/services/core/capacity';
import { useT } from '@/lib/i18n';
import { date, rwf } from '@/lib/format';

export default function InvoicePage() {
  return <Suspense fallback={<SkeletonPanel rows={8} className="mx-auto max-w-3xl" />}><InvoiceView /></Suspense>;
}

function InvoiceView() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const inv = useApi(() => capacity.getInvoice({ params: { id } }), [id]);
  const { toast, toastNode } = useToast();
  const [busy, setBusy] = useState(false);
  const printed = useRef(false);

  useEffect(() => {
    if (inv.data && search.get('print') === '1' && !printed.current) {
      printed.current = true;
      setTimeout(() => window.print(), 300);
    }
  }, [inv.data, search]);

  const download = async () => {
    setBusy(true);
    try {
      const { url } = await capacity.getInvoicePdf({ params: { id } });
      if (url.startsWith('/')) window.print();
      else window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PrintStyles />
      <div className="no-print">
        <PageHead title={inv.data?.invoice.number ?? t('org.inv.invoice')}
          crumbs={[{ href: '/org/invoices', label: t('nav.invoices') }, { label: inv.data?.invoice.number ?? t('org.inv.invoice') }]}
          actions={inv.data && (
            <>
              <Button variant="ghost" onClick={() => window.print()}><Printer size={17} aria-hidden="true" /> {t('ui.print')}</Button>
              <Button onClick={download} disabled={busy}><Download size={17} aria-hidden="true" /> {t('org.inv.pdf')}</Button>
            </>
          )} />
      </div>
      <Async state={inv} skeleton={<SkeletonPanel rows={8} className="mx-auto max-w-3xl" />}>
        {d => <Document d={d} />}
      </Async>
      {toastNode}
    </>
  );
}

function Document({ d }: { d: InvoiceDetail }) {
  const t = useT();
  const { invoice: inv, billedTo: p, booking } = d;
  const x = inv.totals;

  return (
    <article className="print-sheet mx-auto max-w-3xl rounded-[var(--radius-card)] border border-line bg-bg p-5 sm:p-10" aria-label={t('org.inv.ariaDoc', { n: inv.number })}>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Image src="/logo.png" alt="SHAPE Potential Africa" width={3722} height={1364} className="h-11 w-auto" />
          <p className="mt-3 text-sm text-muted">SHAPE Potential Africa CBC</p>
        </div>
        <div className="sm:text-right">
          <h2 className="font-display text-3xl font-bold">{t('org.inv.invoice')}</h2>
          <p className="mt-1 font-mono text-sm font-semibold">{inv.number}</p>
          <div className="mt-2"><StatusPill status={inv.status} /></div>
        </div>
      </header>

      <div className="mt-8 grid gap-6 border-y border-line py-6 sm:grid-cols-3">
        <div className="min-w-0">
          <div className="text-sm text-muted">{t('org.inv.billedTo')}</div>
          <div className="mt-1 font-bold">{p.name}</div>
          <div className="text-sm text-muted">{p.address}</div>
          {p.tin && <div className="text-sm text-muted">{t('org.inv.tin', { tin: p.tin })}</div>}
          <div className="break-all text-sm text-muted">{p.billingEmail}</div>
        </div>
        <div>
          <div className="text-sm text-muted">{t('org.inv.issued')}</div>
          <div className="mt-1 font-semibold">{date(inv.issuedAt)}</div>
          <div className="mt-3 text-sm text-muted">{t('org.inv.due')}</div>
          <div className="mt-1 font-semibold">{date(inv.dueAt)}</div>
        </div>
        <div>
          <div className="text-sm text-muted">{t('org.bk.reference')}</div>
          <div className="mt-1 font-semibold">{inv.bookingId.toUpperCase()}</div>
          {booking && <div className="text-sm text-muted">{booking.packageName}<br />{booking.window}</div>}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[460px] text-left text-[15px]">
          <thead className="text-sm text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-3 pr-4 font-semibold">{t('org.inv.description')}</th>
              <th scope="col" className="py-3 pr-4 text-right font-semibold">{t('org.inv.qty')}</th>
              <th scope="col" className="py-3 pr-4 text-right font-semibold">{t('org.inv.unit')}</th>
              <th scope="col" className="py-3 text-right font-semibold">{t('org.inv.amount')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {inv.lines.map(l => (
              <tr key={l.description}>
                <td className="py-4 pr-4">{l.description}</td>
                <td className="whitespace-nowrap py-4 pr-4 text-right tabular-nums">{l.qty}</td>
                <td className="whitespace-nowrap py-4 pr-4 text-right tabular-nums">{rwf(l.unitPrice)}</td>
                <td className="whitespace-nowrap py-4 text-right font-semibold tabular-nums">{rwf(l.qty * l.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-xs space-y-2 text-[15px]">
          <div className="flex justify-between"><dt className="text-muted">{t('org.inv.subtotal')}</dt><dd className="tabular-nums">{rwf(x.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">{t('org.inv.vat', { pct: Math.round(inv.taxRate * 100) })}</dt><dd className="tabular-nums">{rwf(x.tax)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 font-bold"><dt>{t('org.inv.total')}</dt><dd className="tabular-nums">{rwf(x.total)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">{t('org.home.paid')}</dt><dd className="tabular-nums">{rwf(x.paid)}</dd></div>
          <div className="flex items-baseline justify-between rounded-xl bg-surface px-3 py-2.5">
            <dt className="font-bold">{t('org.inv.balanceDue')}</dt>
            <dd className="font-display text-xl font-bold tabular-nums text-brand">{rwf(x.balance)}</dd>
          </div>
        </dl>
      </div>

      <footer className="mt-10 border-t border-line pt-6 text-sm text-muted">
        <p className="flex items-start gap-2"><Info size={16} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
          {x.balance > 0 ? t('org.inv.payInstructions') : t('org.inv.paidInFull')}
        </p>
        <p className="mt-3">{t('org.inv.currency')}</p>
      </footer>
    </article>
  );
}
