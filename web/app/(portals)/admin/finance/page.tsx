'use client';

// Package pricing, invoice settings and every invoice across organisations (FR-C4.6).
// Package changes write to the shared packages table, so organisations see new prices when booking.

import { useEffect, useState } from 'react';
import { Async, DataTable, PageHead, Panel, Skeleton, SkeletonPanel, StatusPill, type Column } from '@/components/dash';
import { Badge, Button, Checkbox, Field, Input, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { MiniStat } from '@/components/admin/kit';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { governance } from '@/lib/api/services';
import type { FinanceConfig, InvoiceRow } from '@/lib/api/services/core/governance';
import { useT } from '@/lib/i18n';
import { date, rwf } from '@/lib/format';
import type { ServicePackage } from '@/lib/types';

const INVOICE_STATUSES = ['issued', 'partially_paid', 'paid', 'overdue', 'cancelled', 'written_off'];

export default function Finance() {
  const t = useT();
  const pkgs = useApi(() => governance.listPackages(), []);
  const config = useApi(() => governance.getFinanceConfig(), []);
  const invoices = useApi(() => governance.listInvoices({ query: { pageSize: 200 } }), []);
  const { toast, toastNode } = useToast();

  const columns: Column<InvoiceRow>[] = [
    { id: 'number', header: t('admin.finance.invoice'), value: i => i.number, cell: i => <span className="whitespace-nowrap font-mono text-sm font-semibold">{i.number}</span> },
    { id: 'org', header: t('admin.finance.organisation'), value: i => i.organisation, cell: i => <span className="text-sm">{i.organisation}</span> },
    { id: 'issued', header: t('admin.finance.issued'), value: i => i.issuedAt, hideOnMobile: true, cell: i => <span className="whitespace-nowrap text-sm">{date(i.issuedAt)}</span> },
    { id: 'due', header: t('admin.finance.due'), value: i => i.dueAt, hideOnMobile: true, cell: i => <span className="whitespace-nowrap text-sm">{date(i.dueAt)}</span> },
    { id: 'total', header: t('admin.finance.total'), value: i => i.total, align: 'right', hideOnMobile: true, cell: i => <span className="whitespace-nowrap">{rwf(i.total)}</span> },
    { id: 'balance', header: t('admin.finance.balance'), value: i => i.balance, align: 'right', cell: i => <span className="whitespace-nowrap font-semibold">{rwf(i.balance)}</span> },
    { id: 'status', header: t('ui.status'), value: i => i.status, cell: i => <StatusPill status={i.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHead title={t('nav.finance')} />

      <section aria-labelledby="pkg-h">
        <h2 id="pkg-h" className="mb-3 text-lg font-bold">{t('admin.finance.packages')}</h2>
        <Async state={pkgs} skeleton={<div className="grid gap-6 lg:grid-cols-3">{[0, 1, 2].map(i => <SkeletonPanel key={i} rows={5} />)}</div>}>
          {data => (
            <div className="grid gap-6 lg:grid-cols-3">
              {data.map(p => <PackageEditor key={p.id} pkg={p} onSaved={next => { pkgs.setData(xs => xs?.map(x => (x.id === next.id ? next : x))); toast(t('admin.finance.pkgSaved', { name: next.name })); }} onError={e => toast(errorMessage(e))} />)}
            </div>
          )}
        </Async>
      </section>

      <Panel title={t('admin.finance.settings')}>
        {config.data ? <InvoiceSettings initial={config.data} onSaved={next => { config.setData(next); toast(t('admin.finance.settingsSaved')); }} onError={e => toast(errorMessage(e))} /> : <Skeleton className="h-28 w-full" />}
      </Panel>

      <section aria-labelledby="inv-h" className="space-y-3">
        <h2 id="inv-h" className="text-lg font-bold">{t('admin.finance.invoices')}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {invoices.data ? (
            <>
              <MiniStat label={t('admin.finance.billed')} value={rwf(invoices.data.totals.billed)} />
              <MiniStat label={t('admin.finance.received')} value={rwf(invoices.data.totals.received)} tone="ok" />
              <MiniStat label={t('admin.finance.outstanding')} value={rwf(invoices.data.totals.outstanding)} tone="brand" />
            </>
          ) : [0, 1, 2].map(i => <Skeleton key={i} className="h-[72px] rounded-2xl" />)}
        </div>
        <Async state={invoices} skeleton={<SkeletonPanel rows={5} />}>
          {d => (
            <DataTable rows={d.items} columns={columns} rowKey={i => i.id} exportName="spa-invoices" caption={t('admin.finance.invoices')}
              search={i => `${i.number} ${i.organisation}`} searchPlaceholder={t('admin.finance.search')}
              filters={[{ id: 'status', label: t('ui.status'), options: INVOICE_STATUSES.map(s => ({ value: s, label: t(`status.${s}`) })), get: i => i.status }]} />
          )}
        </Async>
      </section>
      {toastNode}
    </div>
  );
}

function PackageEditor({ pkg, onSaved, onError }: { pkg: ServicePackage; onSaved: (p: ServicePackage) => void; onError: (e: unknown) => void }) {
  const t = useT();
  const [p, setP] = useState(pkg);
  const [includes, setIncludes] = useState(pkg.includes.join('\n'));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify({ ...p, includes: includes.split('\n').map(s => s.trim()).filter(Boolean) }) !== JSON.stringify(pkg);
  const id = (k: string) => `${pkg.id}-${k}`;

  const save = async () => {
    setSaving(true);
    try {
      const { id: _id, name: _name, ...body } = p;
      onSaved(await governance.updatePackage({ params: { id: pkg.id }, body: { ...body, includes: includes.split('\n') } }));
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title={pkg.name} action={<Badge>{pkg.price === null ? t('admin.finance.quoted') : rwf(pkg.price)}</Badge>} bodyClassName="flex flex-col gap-4">
      <Checkbox label={t('admin.finance.quotedOnRequest')} checked={p.price === null} onChange={e => setP({ ...p, price: e.target.checked ? null : pkg.price ?? 2000000 })} />
      {p.price !== null && (
        <Field label={t('admin.finance.price')} htmlFor={id('price')}>
          <Input id={id('price')} type="number" min={0} step={50000} value={p.price} onChange={e => setP({ ...p, price: Number(e.target.value) })} />
        </Field>
      )}
      <Field label={t('admin.finance.participants')} htmlFor={id('part')}><Input id={id('part')} value={p.participants} onChange={e => setP({ ...p, participants: e.target.value })} /></Field>
      <Field label={t('admin.finance.duration')} htmlFor={id('dur')}><Input id={id('dur')} value={p.duration} onChange={e => setP({ ...p, duration: e.target.value })} /></Field>
      <Field label={t('admin.finance.supportHours')} htmlFor={id('hrs')}><Input id={id('hrs')} type="number" min={0} value={p.supportHours} onChange={e => setP({ ...p, supportHours: Number(e.target.value) })} /></Field>
      <Field label={t('admin.finance.includes')} htmlFor={id('inc')} hint={t('admin.finance.onePerLine')}>
        <Textarea id={id('inc')} value={includes} onChange={e => setIncludes(e.target.value)} />
      </Field>
      <Button variant={dirty ? 'primary' : 'ghost'} disabled={!dirty || saving} onClick={save}>{t('admin.finance.savePkg', { name: pkg.name })}</Button>
    </Panel>
  );
}

function InvoiceSettings({ initial, onSaved, onError }: { initial: FinanceConfig; onSaved: (c: FinanceConfig) => void; onError: (e: unknown) => void }) {
  const t = useT();
  const [vat, setVat] = useState(Math.round(initial.vatRate * 100));
  const [format, setFormat] = useState(initial.invoiceNumberFormat);
  const [seq, setSeq] = useState(initial.nextSequence);
  const [terms, setTerms] = useState(initial.paymentTermsDays);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setSeq(initial.nextSequence); }, [initial.nextSequence]);

  const formatOk = format.includes('{SEQ}');
  const seqOk = seq >= initial.nextSequence;
  const preview = format.replace('{YEAR}', initial.nextInvoiceNumber.match(/\d{4}/)?.[0] ?? '2026').replace('{SEQ}', String(seq).padStart(4, '0'));

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await governance.updateFinanceConfig({ body: { vatRate: vat / 100, invoiceNumberFormat: format, nextSequence: seq, paymentTermsDays: terms } }));
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={e => { e.preventDefault(); save(); }}>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('admin.finance.vat')} htmlFor="vat" hint={t('admin.finance.vatHint')}><Input id="vat" type="number" min={0} max={50} value={vat} onChange={e => setVat(Number(e.target.value))} /></Field>
        <Field label={t('admin.finance.format')} htmlFor="fmt" error={formatOk ? undefined : t('admin.finance.formatError')} hint={t('admin.finance.nextNumber', { n: preview })}>
          <Input id="fmt" value={format} onChange={e => setFormat(e.target.value)} className="font-mono text-sm" />
        </Field>
        <Field label={t('admin.finance.sequence')} htmlFor="seq" error={seqOk ? undefined : t('admin.finance.sequenceError', { n: initial.nextSequence })}>
          <Input id="seq" type="number" min={initial.nextSequence} value={seq} onChange={e => setSeq(Number(e.target.value))} />
        </Field>
        <Field label={t('admin.finance.terms')} htmlFor="terms"><Input id="terms" type="number" min={0} max={120} value={terms} onChange={e => setTerms(Number(e.target.value))} /></Field>
      </div>
      <p className="mt-3 text-sm text-muted">{t('admin.finance.formatHelp')}</p>
      <Button type="submit" className="mt-5" disabled={!formatOk || !seqOk || saving}>{t('ui.saveChanges')}</Button>
    </form>
  );
}
