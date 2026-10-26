'use client';

// Compiled quarterly M&E report: headline numbers, KPIs and milestones per pillar. Shared by the
// Executive Office review screen and the Board's read-only report view. Data comes from
// reporting.getReport (ai-svc).

import { Flag } from 'lucide-react';
import { Meter, Panel, PillarTag, StatusPill } from '@/components/dash';
import { quarterLabel } from '@/components/admin/kit';
import type { CompiledReport } from '@/lib/api/services/ai/reporting';
import { useT } from '@/lib/i18n';
import { num, pct } from '@/lib/format';
import type { PillarId } from '@/lib/types';

const PILLARS: PillarId[] = ['technology', 'education', 'leadership', 'young_startups', 'agriculture'];

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Rows for the CSV export of one report. */
export function reportRows(r: CompiledReport, t: T) {
  const pillar = (id: PillarId | 'all') => (id === 'all' ? t('admin.common.allPillars') : t(`pillar.${id}`));
  const rows: (string | number)[][] = [[
    t('admin.report.csv.section'), t('admin.report.csv.pillar'), t('admin.report.csv.item'), t('admin.report.csv.target'), t('admin.report.csv.actual'),
    t('admin.report.csv.progress'), t('admin.report.csv.status'), t('admin.report.csv.women'), t('admin.report.csv.youth'), t('admin.report.csv.quarter'), t('admin.report.csv.phase'),
  ]];
  [...r.overall, ...r.kpis].forEach(k => rows.push(['KPI', pillar(k.pillarId), k.label, k.target, k.actual, pct(k.progress), k.status, pct(k.womenShare), pct(k.youthShare), r.quarter, '']));
  r.milestones.forEach(m => rows.push(['Milestone', pillar(m.pillarId), m.title, '', '', '', '', '', '', m.quarter, m.phase]));
  return rows;
}

export function ReportView({ report }: { report: CompiledReport }) {
  const t = useT();
  const q = quarterLabel(report.quarter);

  return (
    <div className="space-y-6">
      <Panel title={t('admin.report.summary', { quarter: q })}>
        <p className="text-muted">{report.summary}</p>
        {report.overall.map(k => (
          <div key={k.id} className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{k.label}</span>
              <span className="text-sm text-muted">
                <span className="font-display text-lg font-bold text-ink tabular-nums">{num(k.actual)}</span> / {num(k.target)} · {pct(k.progress)}
              </span>
            </div>
            <Meter className="mt-2" value={k.progress} expected={k.expected / k.target} tone={k.status === 'behind' ? 'brand' : 'ok'} label={k.label} />
            <div className="mt-2 text-sm text-muted">{t('admin.report.inclusionLine', { women: pct(k.womenShare), youth: pct(k.youthShare) })}</div>
          </div>
        ))}
      </Panel>

      {PILLARS.map(pid => {
        const pk = report.kpis.filter(k => k.pillarId === pid);
        const pm = report.milestones.filter(m => m.pillarId === pid && m.quarter === report.quarter);
        return (
          <Panel key={pid} title={<PillarTag id={pid} label={t(`pillar.${pid}`)} className="text-base" />}>
            {pk.length === 0 ? <p className="text-sm text-muted">{t('admin.report.noKpis')}</p> : (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-sm">
                  <caption className="sr-only">{t('admin.report.kpiCaption', { pillar: t(`pillar.${pid}`), quarter: q })}</caption>
                  <thead className="text-[13px] text-muted">
                    <tr className="border-b border-line">
                      <th scope="col" className="px-5 py-2 font-semibold">{t('admin.report.kpi')}</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">{t('admin.report.target')}</th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">{t('admin.report.actual')}</th>
                      <th scope="col" className="w-40 px-3 py-2 font-semibold">{t('admin.report.progress')}</th>
                      <th scope="col" className="px-5 py-2 font-semibold">{t('ui.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {pk.map(k => (
                      <tr key={k.id}>
                        <td className="px-5 py-3">{k.label}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{num(k.target)}{k.unit ? ` ${k.unit}` : ''}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{num(k.actual)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Meter value={k.progress} expected={k.expected / k.target} tone={k.status === 'behind' ? 'brand' : 'ok'} label={k.label} />
                            <span className="w-9 shrink-0 text-right tabular-nums">{pct(k.progress)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3"><StatusPill status={k.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 border-t border-line pt-4">
              <h3 className="mb-2 text-sm font-semibold">{t('admin.report.milestones')}</h3>
              {pm.length === 0 ? <p className="text-sm text-subtle">{t('admin.report.noMilestones')}</p> : (
                <ul className="space-y-2">
                  {pm.map(m => (
                    <li key={m.id} className="flex items-start gap-2 text-sm">
                      <Flag size={15} className="mt-0.5 shrink-0 text-gold" aria-hidden />
                      <span><span className="font-semibold">{m.title}</span> <span className="text-muted">{t('admin.report.phaseN', { n: m.phase })}. {m.note}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
