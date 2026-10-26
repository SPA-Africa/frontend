// ai-svc / evaluation: pitch routing, anonymisation, aggregate scoring (SRS FR-A3.7, FR-B2.6)
//
// core-svc owns entries and raw scores; ai-svc decides which judges see which entry and computes
// the weighted aggregates. core-svc calls these on domain events (pitch.submitted, pitch.scored,
// pitch.recused); staff can also trigger them by hand from the console.

import { defineEndpoint } from '../../define';
import { nowIso } from '../../mock-db';
import { db } from '../../mock/tables';
import { consoleDb } from '../../mock/console-tables';
import { rubric } from '../../../mock/data';

export interface RoutingResult {
  cycleId: string;
  entries: number;
  /** judge assignments created (3 per entry by default) */
  assignments: number;
  routedAt: string;
}

export interface RerouteResult {
  code: string;
  /** opaque id of the newly assigned judge; never the judge's name */
  assignedTo: string;
  routedAt: string;
}

export interface AggregateResult {
  cycleId: string;
  entries: number;
  /** entries with all assigned judges scored */
  complete: number;
  computedAt: string;
}

/** Weighted rubric total, 0..10 (FR-B2.4). */
export const weightedTotal = (scores: Record<string, number>) => rubric.reduce((t, r) => t + (scores[r.id] ?? 0) * r.weight, 0);

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Mock of the ai-svc aggregate job: mean of every judge's weighted score per entry. */
export function recomputeAggregates(cycleId: string): AggregateResult {
  const scores = consoleDb.judgeScores.get();
  const peers = consoleDb.peerAverages.get();
  let complete = 0;
  db.cycleEntries.update(list => {
    list.filter(e => e.cycleId === cycleId).forEach(e => {
      const mine = scores.filter(s => s.code === e.code).map(s => weightedTotal(s.scores));
      const others = peers[e.code] ?? e.aggregate;
      const k = Math.max(1, e.scoresIn - mine.length);
      if (mine.length) e.aggregate = round1((others * k + mine.reduce((a, b) => a + b, 0)) / (k + mine.length));
      if (e.scoresIn >= e.judgesAssigned) complete += 1;
    });
  });
  return { cycleId, entries: db.cycleEntries.get().filter(e => e.cycleId === cycleId).length, complete, computedAt: nowIso() };
}

/** Mock of re-routing after a recusal: pick another active judge who has not recused. */
export function rerouteEntry(code: string, fromJudgeId: string | null): RerouteResult {
  const recused = new Set(consoleDb.recusals.get().filter(r => r.code === code).map(r => r.judgeId));
  const pool = db.people.get().filter(p => p.role === 'judge_mentor' && p.status === 'active').map(p => p.id).filter(id => id !== 'p-06' && !recused.has(id));
  const to = pool[0] ?? 'pool-overflow';
  const cycleId = db.cycleEntries.get().find(e => e.code === code)?.cycleId ?? db.judgeQueue.get().find(e => e.code === code)?.cycleId ?? '';
  const at = nowIso();
  consoleDb.routing.update(list => { list.push({ code, cycleId, fromJudgeId, toJudgeId: to, reason: fromJudgeId ? 'recusal' : 'initial', at }); });
  return { code, assignedTo: `judge-${to.replace(/\W/g, '')}`, routedAt: at };
}

export const routeCycle = defineEndpoint<RoutingResult, { params: { cycleId: string } }>({
  id: 'evaluation.routing.cycle', service: 'ai', method: 'POST', path: '/evaluation/cycles/:cycleId/routing',
  roles: ['executive_admin', 'pillar_rep'], summary: 'Assign every submitted entry of a cycle to judges, balancing load and sector expertise',
  srs: ['FR-A3.7', 'FR-B2.1', 'FR-B2.2'], response: 'RoutingResult', emits: ['pitch.routed'],
  notes: 'Runs automatically when a cycle closes. Strips names, photos, contact details and file metadata before an entry enters a judge queue (FR-A3.7, NFR-SEC.9). Never assigns a judge with a declared conflict on that entry. Idempotent: existing assignments are kept.',
}, ({ args, fail }) => {
  const cycle = db.cycles.get().find(c => c.id === args.params.cycleId) ?? fail(404, 'cycle_not_found', 'This cycle does not exist');
  const entries = db.cycleEntries.get().filter(e => e.cycleId === cycle.id);
  return { cycleId: cycle.id, entries: entries.length, assignments: entries.reduce((s, e) => s + e.judgesAssigned, 0), routedAt: nowIso() };
});

export const rerouteAfterRecusal = defineEndpoint<RerouteResult, { params: { code: string }; body: { fromJudgeId: string } }>({
  id: 'evaluation.routing.reroute', service: 'ai', method: 'POST', path: '/evaluation/entries/:code/reroute',
  roles: ['executive_admin'], summary: 'Assign an entry to a replacement judge after a conflict-of-interest recusal',
  srs: ['FR-B2.7'], request: '{ fromJudgeId: string }', response: 'RerouteResult', emits: ['pitch.routed'],
  notes: 'Called by core-svc on the pitch.recused event (POST /judging/entries/:code/recusal); exposed for the Executive Office to retry. Excludes every judge who has recused from this entry.',
}, ({ args }) => rerouteEntry(args.params.code, args.body.fromJudgeId));

export const recomputeCycleAggregates = defineEndpoint<AggregateResult, { params: { cycleId: string } }>({
  id: 'evaluation.aggregates.recompute', service: 'ai', method: 'POST', path: '/evaluation/cycles/:cycleId/aggregates',
  roles: ['executive_admin', 'pillar_rep'], summary: 'Recompute weighted aggregate scores for every entry in a cycle',
  srs: ['FR-B2.6'], response: 'AggregateResult', emits: ['pitch.aggregated'],
  notes: 'Runs on every pitch.scored event; this route forces a full recompute. Aggregate = mean over judges of sum(score x criterion weight). Results stay hidden from pillar_rep until the cycle is published.',
}, ({ args, fail }) => {
  if (!db.cycles.get().some(c => c.id === args.params.cycleId)) fail(404, 'cycle_not_found', 'This cycle does not exist');
  return recomputeAggregates(args.params.cycleId);
});
