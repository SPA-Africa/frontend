// ai-svc / reporting: dashboard summaries, quarterly reports, mid-term and final exports (SRS FR-B3.4, FR-B3.7)
//
// board_auditor holds a SELECT-only database role. Every endpoint it may call is marked in `notes`;
// it must never be granted compile, publish or any other write.

import { defineEndpoint } from '../../define';
import { db } from '../../mock/tables';
import { phases as planPhases, pillars } from '../../../mock/data';
import { TODAY, kpiStatus, monthlyEnrolments, phaseOutputs, pillarReach, type ReportStatus } from '../../../mock/internal';
import type { Kpi, Milestone, PillarId } from '../../../types';

export type { ReportStatus };

/* ---------- organisation summary ---------- */

export interface PillarReach {
  pillarId: PillarId;
  learners: number;
  /** 0..1 */
  women: number;
  /** 0..1, ages 15 to 35 */
  youth: number;
  /** New enrolments per month, last 6 months */
  monthly: { month: string; value: number }[];
}

export interface PhaseProgress {
  n: number;
  name: string;
  years: string;
  status: 'done' | 'current' | 'upcoming';
  /** Year the expected outputs are due */
  by: string;
  outputs: string[];
  /** Milestones logged by Pillar Representatives against this phase */
  evidence: Milestone[];
}

export interface OrgSummary {
  asOf: string;
  reach: PillarReach[];
  totals: { learners: number; women: number; youth: number };
  /** All pillars, new enrolments per month */
  monthly: { month: string; value: number }[];
  /** Inclusion minimum for women and youth, per pillar (0.5) */
  inclusionTarget: number;
  currentPhase: number;
  phases: PhaseProgress[];
}

export const getSummary = defineEndpoint<OrgSummary>({
  id: 'reporting.summary.get', service: 'ai', method: 'GET', path: '/reporting/summary',
  roles: ['executive_admin', 'board_auditor'], summary: 'Organisation-wide reach by pillar, inclusion shares and plan phase progress',
  srs: ['FR-B3.1', 'FR-B3.4', 'FR-B3.5', 'FR-B3.9', 'FR-B1.8'], response: 'OrgSummary',
  notes: 'Read from the nightly me_pillar_metrics snapshot. board_auditor: SELECT-only, aggregates only (no learner rows). Executive reads are audit-logged.',
}, () => {
  const reach: PillarReach[] = pillars.map(p => ({ pillarId: p.id, ...pillarReach[p.id], monthly: monthlyEnrolments[p.id] }));
  const learners = reach.reduce((s, r) => s + r.learners, 0);
  const share = (k: 'women' | 'youth') => reach.reduce((s, r) => s + r.learners * r[k], 0) / (learners || 1);
  const months = reach[0].monthly.map(m => m.month);
  const ms = db.milestones.get();
  const current = planPhases.find(p => p.status === 'current')?.n ?? 1;
  return {
    asOf: TODAY,
    reach,
    totals: { learners, women: share('women'), youth: share('youth') },
    monthly: months.map((month, i) => ({ month, value: reach.reduce((s, r) => s + r.monthly[i].value, 0) })),
    inclusionTarget: 0.5,
    currentPhase: current,
    phases: planPhases.map(p => ({
      n: p.n, name: p.name, years: p.years, status: p.n < current ? 'done' : p.n === current ? 'current' : 'upcoming',
      by: phaseOutputs[p.n].by, outputs: phaseOutputs[p.n].outputs,
      evidence: ms.filter(m => m.phase === p.n).sort((a, b) => a.quarter.localeCompare(b.quarter)),
    })),
  };
});

/* ---------- quarterly reports ---------- */

export interface QuarterReportSummary {
  quarter: string; // e.g. 2026-Q3
  status: ReportStatus;
  publishedAt?: string;
  summary: string;
}

export interface ReportKpi extends Kpi {
  progress: number;
  /** pro-rated target at the end of the quarter */
  expected: number;
  status: 'on_track' | 'behind';
}

export interface CompiledReport extends QuarterReportSummary {
  /** Organisation-wide KPIs (pillarId "all") */
  overall: ReportKpi[];
  kpis: ReportKpi[];
  /** Milestones logged up to and including this quarter */
  milestones: Milestone[];
  compiledAt: string;
}

const quarterEnd = (q: string) => {
  const [y, n] = q.split('-Q');
  return new Date(Date.UTC(Number(y), Number(n) * 3, 0)).toISOString().slice(0, 10);
};

function compile(quarter: string): CompiledReport | null {
  const r = db.reports.get().find(x => x.quarter === quarter);
  if (!r) return null;
  const on = quarterEnd(quarter) < TODAY ? quarterEnd(quarter) : TODAY;
  const kpis: ReportKpi[] = db.kpis.get().map(k => {
    const actual = Math.round(k.actual * r.scale);
    const s = kpiStatus(k, actual, on);
    return { ...k, actual, progress: s.progress, expected: s.expected, status: s.behind ? 'behind' : 'on_track' };
  });
  return {
    quarter: r.quarter, status: r.status, publishedAt: r.publishedAt, summary: r.summary,
    overall: kpis.filter(k => k.pillarId === 'all'), kpis: kpis.filter(k => k.pillarId !== 'all'),
    milestones: db.milestones.get().filter(m => m.quarter <= quarter), compiledAt: on,
  };
}

const strip = ({ quarter, status, publishedAt, summary }: QuarterReportSummary): QuarterReportSummary => ({ quarter, status, publishedAt, summary });

export const listReports = defineEndpoint<QuarterReportSummary[]>({
  id: 'reporting.reports.list', service: 'ai', method: 'GET', path: '/reporting/reports',
  roles: ['executive_admin', 'board_auditor'], summary: 'Quarterly M&E reports, newest first', srs: ['FR-B3.4', 'FR-B1.8'],
  response: 'QuarterReportSummary[]',
  notes: 'board_auditor: SELECT-only and receives status "published" rows only (RLS policy on me_reports).',
}, ({ user }) => db.reports.get()
  .filter(r => user?.role !== 'board_auditor' || r.status === 'published')
  .sort((a, b) => b.quarter.localeCompare(a.quarter))
  .map(strip));

export const getReport = defineEndpoint<CompiledReport, { params: { quarter: string } }>({
  id: 'reporting.reports.get', service: 'ai', method: 'GET', path: '/reporting/reports/:quarter',
  roles: ['executive_admin', 'board_auditor'], summary: 'A compiled quarterly report: KPIs per pillar and milestones', srs: ['FR-B3.4', 'FR-B1.8'],
  response: 'CompiledReport',
  notes: 'quarter is YYYY-Qn. board_auditor: SELECT-only; unpublished reports return 404 (not 403) so their existence is not revealed.',
}, ({ args, user, fail }) => {
  const r = compile(args.params.quarter);
  if (!r || (user?.role === 'board_auditor' && r.status !== 'published')) return fail(404, 'not_found', 'Report not found');
  return r;
});

export const compileReport = defineEndpoint<CompiledReport, { params: { quarter: string } }>({
  id: 'reporting.reports.compile', service: 'ai', method: 'POST', path: '/reporting/reports/:quarter/compile',
  roles: ['executive_admin'], summary: 'Recompile a draft report from the latest KPI actuals and milestone logs and send it for review',
  srs: ['FR-B3.4'], response: 'CompiledReport', emits: ['report.compiled'],
  notes: 'Allowed from draft or in_review (moves to in_review). 409 if already published, since published reports are frozen.',
}, ({ args, user, fail }) => {
  const r = db.reports.get().find(x => x.quarter === args.params.quarter);
  if (!r) return fail(404, 'not_found', 'Report not found');
  if (r.status === 'published') return fail(409, 'already_published', 'Published reports cannot be recompiled');
  db.reports.update(rows => { rows.find(x => x.quarter === r.quarter)!.status = 'in_review'; });
  db.audit.update(rows => { rows.unshift({ id: `ae-${Date.now()}`, at: new Date().toISOString(), actor: user?.name ?? 'system', role: user?.role ?? 'system', action: 'Compiled quarterly report', target: r.quarter }); });
  return compile(r.quarter)!;
});

export const publishReport = defineEndpoint<CompiledReport, { params: { quarter: string } }>({
  id: 'reporting.reports.publish', service: 'ai', method: 'POST', path: '/reporting/reports/:quarter/publish',
  roles: ['executive_admin'], summary: 'Approve a report in review and publish it to the Board of Trustees',
  srs: ['FR-B3.4', 'FR-B3.7'], response: 'CompiledReport', emits: ['report.published'],
  notes: 'Only from in_review (409 otherwise). Freezes the snapshot, sets publishedAt, notifies trustees and Pillar Representatives. Audit-logged.',
}, ({ args, user, fail }) => {
  const r = db.reports.get().find(x => x.quarter === args.params.quarter);
  if (!r) return fail(404, 'not_found', 'Report not found');
  if (r.status !== 'in_review') return fail(409, 'invalid_state', r.status === 'published' ? 'Already published' : 'Compile the report before publishing');
  db.reports.update(rows => {
    const x = rows.find(y => y.quarter === r.quarter)!;
    x.status = 'published';
    x.publishedAt = TODAY;
  });
  db.audit.update(rows => { rows.unshift({ id: `ae-${Date.now()}`, at: new Date().toISOString(), actor: user?.name ?? 'system', role: user?.role ?? 'system', action: 'Published quarterly report', target: r.quarter }); });
  return compile(r.quarter)!;
});

/* ---------- plan evaluations (2031 mid-term, 2036 final) ---------- */

export interface EvaluationRow {
  section: 'KPI' | 'Milestone' | 'Phase';
  pillar: PillarId | 'all' | '';
  item: string;
  target: number | string;
  actual: number | string;
  progress: number | string;
}

export interface EvaluationExport {
  year: 2031 | 2036;
  kind: 'mid_term' | 'final';
  generatedAt: string;
  /** Live mode: pre-signed MinIO URL to the CSV/XLSX pack, valid 15 minutes */
  downloadUrl?: string;
  /** Mock mode (and for previews): the rows of the pack */
  rows: EvaluationRow[];
}

export const exportEvaluation = defineEndpoint<EvaluationExport, { params: { year: 2031 | 2036 } }>({
  id: 'reporting.evaluations.export', service: 'ai', method: 'POST', path: '/reporting/evaluations/:year/export',
  roles: ['executive_admin'], summary: 'Generate the mid-term (2031) or final (2036) evaluation pack with every KPI, milestone and phase',
  srs: ['FR-B3.7'], response: 'EvaluationExport', emits: ['evaluation.exported'],
  notes: 'year must be 2031 or 2036 (400 otherwise). Before the evaluation year it exports progress to date. Live mode returns downloadUrl (pre-signed, 15 min); rows may be omitted. Audit-logged.',
}, ({ args, fail }) => {
  const year = Number(args.params.year) as 2031 | 2036;
  if (year !== 2031 && year !== 2036) return fail(400, 'invalid_year', 'Evaluations are in 2031 and 2036');
  const rows: EvaluationRow[] = [
    ...db.kpis.get().map(k => ({ section: 'KPI' as const, pillar: k.pillarId, item: k.label, target: k.target, actual: k.actual, progress: Math.round((k.actual / k.target) * 100) / 100 })),
    ...db.milestones.get().map(m => ({ section: 'Milestone' as const, pillar: m.pillarId, item: m.title, target: '', actual: `Phase ${m.phase}`, progress: m.quarter })),
    ...planPhases.map(p => ({ section: 'Phase' as const, pillar: '' as const, item: `Phase ${p.n}: ${p.name}`, target: p.years, actual: p.status, progress: '' })),
  ];
  return { year, kind: year === 2031 ? 'mid_term' : 'final', generatedAt: new Date().toISOString(), rows };
});
