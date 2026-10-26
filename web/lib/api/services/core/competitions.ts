// core-svc / competitions: cycles, grading progress, results publication (SRS FR-A3.9, FR-B2.8, FR-B2.9)

import { defineEndpoint } from '../../define';
import { nowIso } from '../../mock-db';
import { db } from '../../mock/tables';
import { appendAudit, consoleDb } from '../../mock/console-tables';
import { recomputeAggregates } from '../ai/evaluation';
import type { CompetitionCycle, PillarId, PitchStatus } from '../../../types';

/** Pitch competitions are hosted by the Young Startups pillar. */
export const HOST_PILLAR: PillarId = 'young_startups';

export interface CycleSummary extends CompetitionCycle {
  hostPillarId: PillarId;
  publishedAt?: string;
}

export type EntryGradingState = 'not_started' | 'in_progress' | 'complete';

/** Counts only. Scores and rankings are never included before publication (FR-B2.8). */
export interface GradingProgress {
  cycleId: string;
  status: CompetitionCycle['status'];
  entries: number;
  fullyScored: number;
  scoresIn: number;
  scoresNeeded: number;
  judgesPerEntry: number;
  rows: { code: string; sector: string; judgesAssigned: number; scoresIn: number; state: EntryGradingState }[];
}

export type ResultOutcome = 'winner' | 'finalist' | 'not_selected';

export interface LeaderboardRow {
  rank: number;
  code: string;
  businessName: string;
  sector: string;
  /** weighted aggregate, 0..10 */
  aggregate: number;
  outcome: ResultOutcome;
}

export interface Leaderboard { cycleId: string; publishedAt: string; rows: LeaderboardRow[] }

const FINALISTS = 5;
const outcomeFor = (rank: number): ResultOutcome => (rank === 1 ? 'winner' : rank <= FINALISTS ? 'finalist' : 'not_selected');

const summary = (c: CompetitionCycle): CycleSummary => ({ ...c, hostPillarId: HOST_PILLAR, publishedAt: consoleDb.publications.get()[c.id]?.publishedAt });

const cycleOr404 = (id: string, fail: (s: number, c: string, m: string) => never) =>
  db.cycles.get().find(c => c.id === id) ?? fail(404, 'cycle_not_found', 'This competition cycle does not exist');

const ranked = (cycleId: string): LeaderboardRow[] => db.cycleEntries.get()
  .filter(e => e.cycleId === cycleId)
  .sort((a, b) => b.aggregate - a.aggregate || a.code.localeCompare(b.code))
  .map((e, i) => ({ rank: i + 1, code: e.code, businessName: e.businessName, sector: e.sector, aggregate: e.aggregate, outcome: outcomeFor(i + 1) }));

const ACCESS_NOTE = 'Cycles carry pillar_id = young_startups. Every Pillar Representative may monitor cycles (the console nav shows them to all pillars); if the backend limits publication to the host pillar, return 403 not_cycle_owner for other pillars. executive_admin bypasses.';

export const listCycles = defineEndpoint<CycleSummary[]>({
  id: 'competitions.cycles.list', service: 'core', method: 'GET', path: '/competitions/cycles',
  roles: ['pillar_rep', 'executive_admin'], summary: 'All competition cycles with status and entry counts, open and judging first',
  srs: ['FR-A3.9', 'FR-B2.8'], response: 'CycleSummary[]', notes: ACCESS_NOTE,
}, () => {
  const order: Record<CompetitionCycle['status'], number> = { judging: 0, open: 1, upcoming: 2, published: 3 };
  return db.cycles.get().map(summary).sort((a, b) => order[a.status] - order[b.status] || b.closesAt.localeCompare(a.closesAt));
});

export const getCycle = defineEndpoint<CycleSummary, { params: { id: string } }>({
  id: 'competitions.cycles.get', service: 'core', method: 'GET', path: '/competitions/cycles/:id',
  roles: ['pillar_rep', 'executive_admin', 'judge_mentor'], summary: 'One competition cycle',
  srs: ['FR-A3.9'], response: 'CycleSummary',
}, ({ args, fail }) => summary(cycleOr404(args.params.id, fail)));

export const getGradingProgress = defineEndpoint<GradingProgress, { params: { id: string } }>({
  id: 'competitions.progress.get', service: 'core', method: 'GET', path: '/competitions/cycles/:id/progress',
  roles: ['pillar_rep', 'executive_admin'], summary: 'Grading completion for a cycle: entries, judge scores received and per-entry counts',
  srs: ['FR-B2.8'], response: 'GradingProgress',
  notes: 'Counts only. Must not include any score, aggregate, rank or business name, so nobody (including the Pillar Representative) can see results before publication.',
}, ({ args, fail }) => {
  const cycle = cycleOr404(args.params.id, fail);
  const entries = db.cycleEntries.get().filter(e => e.cycleId === cycle.id);
  return {
    cycleId: cycle.id, status: cycle.status, entries: entries.length || cycle.entries,
    fullyScored: entries.filter(e => e.scoresIn >= e.judgesAssigned).length,
    scoresIn: entries.reduce((s, e) => s + Math.min(e.scoresIn, e.judgesAssigned), 0),
    scoresNeeded: entries.reduce((s, e) => s + e.judgesAssigned, 0),
    judgesPerEntry: entries[0]?.judgesAssigned ?? 3,
    rows: entries.map(e => ({
      code: e.code, sector: e.sector, judgesAssigned: e.judgesAssigned, scoresIn: Math.min(e.scoresIn, e.judgesAssigned),
      state: e.scoresIn >= e.judgesAssigned ? 'complete' : e.scoresIn === 0 ? 'not_started' : 'in_progress',
    })),
  };
});

export const publishResults = defineEndpoint<Leaderboard, { params: { id: string } }>({
  id: 'competitions.results.publish', service: 'core', method: 'POST', path: '/competitions/cycles/:id/results/publish',
  roles: ['pillar_rep', 'executive_admin'], summary: 'Publish the ranked results of a cycle and notify every entrant',
  srs: ['FR-A3.9', 'FR-B2.9'], response: 'Leaderboard', emits: ['results.published'],
  notes: `Only from status "judging" (409 invalid_state otherwise). Irreversible. Asks ai-svc for a final aggregate recompute, then ranks by aggregate: rank 1 winner, ranks 2 to ${FINALISTS} finalist, the rest not_selected, and updates each entry's PitchStatus so entrants see their outcome. Entries not fully scored are ranked on the scores received. ${ACCESS_NOTE}`,
}, ({ args, user, fail }) => {
  const cycle = cycleOr404(args.params.id, fail);
  if (cycle.status !== 'judging') fail(409, 'invalid_state', 'Results can only be published for a cycle in judging');
  recomputeAggregates(cycle.id);
  const rows = ranked(cycle.id);
  const publishedAt = nowIso();
  db.cycles.update(list => { const c = list.find(x => x.id === cycle.id); if (c) c.status = 'published'; });
  consoleDb.publications.update(p => { p[cycle.id] = { publishedAt, publishedBy: user?.name ?? 'system' }; });
  const byCode = Object.fromEntries(rows.map(r => [r.code, r.outcome]));
  db.pitches.update(list => list.forEach(p => { if (byCode[p.code]) { p.status = byCode[p.code] as PitchStatus; p.updatedAt = publishedAt.slice(0, 10); } }));
  appendAudit(user, 'Published competition results', cycle.name, HOST_PILLAR);
  return { cycleId: cycle.id, publishedAt, rows };
});

export const getLeaderboard = defineEndpoint<Leaderboard, { params: { id: string } }>({
  id: 'competitions.leaderboard.get', service: 'core', method: 'GET', path: '/competitions/cycles/:id/leaderboard',
  roles: ['pillar_rep', 'executive_admin', 'board_auditor'], summary: 'Ranked leaderboard with business names, available after publication',
  srs: ['FR-A3.9', 'FR-B2.9'], response: 'Leaderboard',
  notes: '409 results_not_published until the cycle is published. Business names are only joined to entry codes here, after publication.',
}, ({ args, fail }) => {
  const cycle = cycleOr404(args.params.id, fail);
  if (cycle.status !== 'published') fail(409, 'results_not_published', 'Results for this cycle are not published yet');
  return { cycleId: cycle.id, publishedAt: consoleDb.publications.get()[cycle.id]?.publishedAt ?? cycle.closesAt, rows: ranked(cycle.id) };
});
