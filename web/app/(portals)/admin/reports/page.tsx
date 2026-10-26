'use client';

// Quarterly M&E reports (FR-B3.4, FR-B3.7): pick a quarter, review the compiled report, approve and
// publish it to the Board, export CSV or print to PDF, and export the 2031 and 2036 evaluation packs.

import { useEffect, useState } from 'react';
import { CheckCircle2, Download, FileDown, Printer, RefreshCw, Send } from 'lucide-react';
import { Async, PageHead, Panel, Skeleton, SkeletonPanel, StatusPill } from '@/components/dash';
import { Button } from '@/components/ui';
import { Tabs, useToast } from '@/components/ui/client';
import { ReportView, reportRows } from '@/components/internal/ReportView';
import { ConfirmDialog, downloadCsv, quarterLabel } from '@/components/admin/kit';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { reporting } from '@/lib/api/services';
import type { EvaluationExport } from '@/lib/api/services/ai/reporting';
import { useT } from '@/lib/i18n';
import { date } from '@/lib/format';

export default function AdminReports() {
  const t = useT();
  const list = useApi(() => reporting.listReports(), []);
  const [sel, setSel] = useState<string | null>(null);
  const report = useApi(() => reporting.getReport({ params: { quarter: sel! } }), [sel], { enabled: !!sel });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast, toastNode } = useToast();

  useEffect(() => {
    if (!sel && list.data?.length) setSel((list.data.find(r => r.status === 'in_review') ?? list.data[0]).quarter);
  }, [list.data, sel]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast(ok);
      list.reload();
      report.reload();
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const exportEvaluation = async (year: 2031 | 2036) => {
    setBusy(`eval-${year}`);
    try {
      const pack: EvaluationExport = await reporting.exportEvaluation({ params: { year } });
      if (pack.downloadUrl) window.location.assign(pack.downloadUrl);
      else downloadCsv(`spa-${pack.kind.replace('_', '-')}-evaluation-${year}.csv`, [
        [t('admin.report.csv.section'), t('admin.report.csv.pillar'), t('admin.report.csv.item'), t('admin.report.csv.target'), t('admin.report.csv.actual'), t('admin.report.csv.progress')],
        ...pack.rows.map(r => [r.section, r.pillar === 'all' ? t('admin.common.allPillars') : r.pillar ? t(`pillar.${r.pillar}`) : '', r.item, r.target, r.actual, r.progress]),
      ]);
      toast(t('admin.reports.evalDownloaded'));
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const r = report.data;
  const q = sel ? quarterLabel(sel) : '';

  return (
    <div className="space-y-6">
      <PageHead title={t('nav.reports')} />

      <div className="space-y-4 print:hidden">
        {list.data ? (
          <Tabs value={sel ?? ''} onChange={setSel} tabs={list.data.map(x => ({ id: x.quarter, label: quarterLabel(x.quarter) }))} />
        ) : <Skeleton className="h-11 w-80 rounded-full" />}

        <Panel>
          {!r || report.loading ? <Skeleton className="h-12 w-full" /> : (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold">{t('admin.reports.reportFor', { quarter: q })}</h2>
                  <StatusPill status={r.status} />
                </div>
                <div className="text-sm text-muted">
                  {r.status === 'published' && r.publishedAt ? t('admin.reports.publishedOn', { date: date(r.publishedAt) })
                    : r.status === 'draft' ? t('admin.reports.draftNote') : t('admin.reports.reviewNote')}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => { downloadCsv(`spa-me-report-${r.quarter}.csv`, reportRows(r, t)); toast(t('admin.reports.csvDone')); }}><Download size={15} /> {t('ui.exportCsv')}</Button>
                <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer size={15} /> {t('admin.reports.pdf')}</Button>
                {r.status !== 'published' && (
                  <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => run('compile', () => reporting.compileReport({ params: { quarter: r.quarter } }), t('admin.reports.compiled', { quarter: q }))}>
                    <RefreshCw size={15} className={busy === 'compile' ? 'animate-spin' : ''} /> {t('admin.reports.compile')}
                  </Button>
                )}
                {r.status === 'in_review' && <Button size="sm" disabled={!!busy} onClick={() => setConfirm(true)}><Send size={15} /> {t('admin.reports.publish')}</Button>}
                {r.status === 'published' && <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok"><CheckCircle2 size={16} aria-hidden /> {t('admin.reports.visible')}</span>}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {sel ? <Async state={report} skeleton={<SkeletonPanel rows={6} />}>{data => <ReportView report={data} />}</Async> : <SkeletonPanel rows={6} />}

      <Panel title={t('admin.reports.evaluations')} className="print:hidden">
        <div className="grid gap-3 sm:grid-cols-2">
          {([[2031, 'admin.reports.midTerm', 'admin.reports.midTermSub'], [2036, 'admin.reports.final', 'admin.reports.finalSub']] as const).map(([year, label, sub]) => (
            <div key={year} className="flex items-center gap-4 rounded-2xl border border-line p-4">
              <FileDown size={22} className="shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1"><div className="font-semibold">{t(label)} ({year})</div><div className="text-sm text-muted">{t(sub)}</div></div>
              <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => exportEvaluation(year)}>{t('ui.export')}<span className="sr-only"> {t(label)}</span></Button>
            </div>
          ))}
        </div>
      </Panel>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} busy={busy === 'publish'} title={t('admin.reports.confirmTitle')} confirmLabel={t('admin.reports.publish')}
        onConfirm={async () => { await run('publish', () => reporting.publishReport({ params: { quarter: sel! } }), t('admin.reports.publishedToast', { quarter: q })); setConfirm(false); }}>
        {t('admin.reports.confirmBody', { quarter: q })}
      </ConfirmDialog>
      {toastNode}
    </div>
  );
}
