// ai-svc / metrics: KPI computation for M&E (SRS 2.2.4 "Metric computation", FR-B3.1, FR-B3.5, FR-B3.6, FR-B3.9)
// The analytics service computes these nightly into me_pillar_metrics snapshots; the frontend only reads.

import { defineEndpoint } from '../../define';
import { db } from '../../mock/tables';
import { kpiStatus, kpiTrend, monthlyEnrolments, pillarReach } from '../../../mock/internal';
import type { Kpi, PillarId } from '../../../types';

export interface KpiWithStatus extends Kpi {
  /** actual / target */
  progress: number;
  /** time-prorated target for today */
  expected: number;
  /** actual / expected; behind when < 0.7 (FR-B3.6) */
  ratio: number;
  status: 'on_track' | 'behind';
  /** cumulative actual and expected at the end of each of the last 5 quarters */
  trend: { quarter: string; actual: number; expected: number }[];
}

const enrich = (k: Kpi): KpiWithStatus => {
  const s = kpiStatus(k);
  return {
    ...k,
    progress: s.progress,
    expected: s.expected,
    ratio: s.ratio,
    status: s.behind ? 'behind' : 'on_track',
    trend: kpiTrend(k),
  };
};

export const listKpis = defineEndpoint<KpiWithStatus[], { query?: { pillar?: PillarId | 'all' } }>({
  id: 'metrics.kpis.list', service: 'ai', method: 'GET', path: '/metrics/kpis',
  roles: ['pillar_rep', 'executive_admin', 'board_auditor'],
  summary: 'KPIs with target, actual, time-prorated expectation, status and quarterly trend',
  srs: ['FR-B3.1', 'FR-B3.5', 'FR-B3.6', 'FR-B3.8', 'FR-B3.9'], response: 'KpiWithStatus[]', query: ['pillar?: PillarId | "all"'],
  notes: 'Pillar Representatives only ever receive their own pillar (RLS). Board receives published snapshots only.',
}, ({ args, user }) => {
  const pillar = user?.role === 'pillar_rep' ? user.pillarId : args.query?.pillar;
  return db.kpis.get().filter(k => !pillar || pillar === 'all' || k.pillarId === pillar).map(enrich);
});

/* ---------- pillar overview (Pillar Representative console) ---------- */

export interface MetricSeries {
  value: number;
  /** previous period value, for the delta */
  previous: number;
  /** last 6 months, oldest first */
  spark: number[];
}

export interface PillarOverview {
  pillarId: PillarId;
  /** distinct learners ever enrolled in the pillar */
  learners: MetricSeries;
  /** new enrolments in the current month */
  enrolments: MetricSeries;
  /** share of learners who are women, 0..1 */
  womenShare: MetricSeries;
  /** share of learners aged 15 to 35, 0..1 */
  youthShare: MetricSeries;
  /** plan minimum for women and youth shares */
  inclusionMinimum: number;
  asOf: string;
}

export interface MonthlyPoint { month: string; value: number }

const pillarFor = (user: { role: string; pillarId?: PillarId } | null, requested: PillarId | undefined, fail: (s: number, c: string, m: string) => never): PillarId => {
  if (user?.role === 'pillar_rep') {
    if (requested && requested !== user.pillarId) fail(403, 'other_pillar', 'You can only see your own pillar');
    return user.pillarId ?? fail(403, 'no_pillar', 'Your account is not linked to a pillar');
  }
  return requested ?? fail(400, 'pillar_required', 'Choose a pillar');
};

const shareSpark = (end: number, drift: number[]) => drift.map(d => Math.max(0, Math.min(1, end + d)));

export const getPillarOverview = defineEndpoint<PillarOverview, { params: { pillarId: PillarId } }>({
  id: 'metrics.pillars.overview', service: 'ai', method: 'GET', path: '/metrics/pillars/:pillarId/overview',
  roles: ['pillar_rep', 'executive_admin', 'board_auditor'], summary: 'Headline pillar figures with six-month series: learners reached, new enrolments, women and youth shares',
  srs: ['FR-B3.1', 'FR-B3.5', 'FR-B3.9'], response: 'PillarOverview',
  notes: 'Read from the nightly me_pillar_metrics snapshot. pillar_rep may only request their own pillar (403 other_pillar). Youth = aged 15 to 35 at enrolment.',
}, ({ args, user, fail }) => {
  const pillarId = pillarFor(user, args.params.pillarId, fail);
  const reach = pillarReach[pillarId];
  const months = monthlyEnrolments[pillarId].map(m => m.value);
  const cumulative = months.map((_, i) => reach.learners - months.slice(i + 1).reduce((a, b) => a + b, 0));
  const n = months.length;
  const women = shareSpark(reach.women, [-0.04, -0.03, -0.035, -0.02, -0.01, 0]);
  const youth = shareSpark(reach.youth, [0.02, 0.015, 0.01, 0.012, 0.004, 0]);
  return {
    pillarId,
    learners: { value: reach.learners, previous: cumulative[n - 2], spark: cumulative },
    enrolments: { value: months[n - 1], previous: months[n - 2], spark: months },
    womenShare: { value: reach.women, previous: women[n - 2], spark: women },
    youthShare: { value: reach.youth, previous: youth[n - 2], spark: youth },
    inclusionMinimum: 0.5,
    asOf: '2026-10-24',
  };
});

export const getEnrolmentTrend = defineEndpoint<MonthlyPoint[], { query?: { pillar?: PillarId; months?: number } }>({
  id: 'metrics.enrolments.monthly', service: 'ai', method: 'GET', path: '/metrics/enrolments/monthly',
  roles: ['pillar_rep', 'executive_admin', 'board_auditor'], summary: 'New enrolments per calendar month for a pillar, oldest first',
  srs: ['FR-B3.1', 'FR-B3.5'], response: 'MonthlyPoint[]', query: ['pillar?: PillarId (forced to own pillar for pillar_rep)', 'months?: number (default 6, max 24)'],
  notes: 'month is a short English month label for the chart axis; the backend may return YYYY-MM and let the client format it.',
}, ({ args, user, fail }) => {
  const pillarId = pillarFor(user, args.query?.pillar, fail);
  const months = Math.min(24, Number(args.query?.months ?? 6));
  return monthlyEnrolments[pillarId].slice(-months);
});
