// core-svc / milestones: pillar milestone log (SRS FR-B3.2, FR-B3.3)

import { defineEndpoint } from '../../define';
import { mockId, nowIso } from '../../mock-db';
import { db } from '../../mock/tables';
import { appendAudit } from '../../mock/console-tables';
import type { Milestone, PillarId } from '../../../types';

export type Phase = Milestone['phase'];

export interface MilestoneRecord extends Milestone {
  /** set by the server on create; absent on seeded history */
  loggedAt?: string;
  loggedBy?: string;
}

export interface CreateMilestoneRequest {
  title: string;
  phase: Phase;
  /** `YYYY-Qn` */
  quarter: string;
  note?: string;
}

/** Quarters a milestone may be tagged with: from the plan start to one quarter ahead. */
export const loggableQuarters = (current = '2026-Q4') => {
  const out: string[] = [];
  let [y, q] = current.split('-Q').map(Number);
  q += 1; if (q > 4) { q = 1; y += 1; }
  while (`${y}-Q${q}` >= '2025-Q3') {
    out.push(`${y}-Q${q}`);
    q -= 1; if (q < 1) { q = 4; y -= 1; }
  }
  return out;
};

export const listMilestones = defineEndpoint<MilestoneRecord[], { query?: { pillar?: PillarId; phase?: Phase; quarter?: string } }>({
  id: 'milestones.list', service: 'core', method: 'GET', path: '/milestones',
  roles: ['pillar_rep', 'executive_admin', 'board_auditor'], summary: 'Milestone log, newest quarter first',
  srs: ['FR-B3.2', 'FR-B3.3'], response: 'MilestoneRecord[]', query: ['pillar?: PillarId', 'phase?: 1..6', 'quarter?: YYYY-Qn'],
  notes: 'RLS: pillar_rep only receives their own pillar regardless of the pillar query. Sorted by quarter desc, then loggedAt desc.',
}, ({ args, user }) => {
  const pillar = user?.role === 'pillar_rep' ? user.pillarId : args.query?.pillar;
  const { phase, quarter } = args.query ?? {};
  return (db.milestones.get() as MilestoneRecord[])
    .filter(m => (!pillar || m.pillarId === pillar) && (!phase || m.phase === Number(phase)) && (!quarter || m.quarter === quarter))
    .sort((a, b) => b.quarter.localeCompare(a.quarter) || (b.loggedAt ?? '').localeCompare(a.loggedAt ?? ''));
});

export const createMilestone = defineEndpoint<MilestoneRecord, { body: CreateMilestoneRequest }>({
  id: 'milestones.create', service: 'core', method: 'POST', path: '/milestones',
  roles: ['pillar_rep'], summary: 'Log a milestone for the caller\'s pillar, tagged with a plan phase and quarter',
  srs: ['FR-B3.2', 'FR-B3.3'], request: 'CreateMilestoneRequest', response: 'MilestoneRecord', emits: ['milestone.logged'], offline: true,
  notes: 'pillar_id comes from the token. Validation: title 5 to 160 chars, phase integer 1 to 6, quarter matches YYYY-Qn between 2025-Q3 and next quarter, note up to 1000 chars. Append-only: there is no update or delete, so the record stays auditable. Feeds the quarterly report compiled by ai-svc.',
}, ({ args, user, fail }) => {
  const b = args.body;
  const pillarId = user?.pillarId ?? fail(403, 'no_pillar', 'Your account is not linked to a pillar');
  const title = b.title?.trim() ?? '';
  if (title.length < 5) fail(400, 'title_too_short', 'Give the milestone a clear title of at least 5 characters');
  if (title.length > 160) fail(400, 'title_too_long', 'Keep the title under 160 characters');
  if (![1, 2, 3, 4, 5, 6].includes(Number(b.phase))) fail(400, 'invalid_phase', 'Phase must be between 1 and 6');
  if (!/^\d{4}-Q[1-4]$/.test(b.quarter) || !loggableQuarters().includes(b.quarter)) fail(400, 'invalid_quarter', 'Pick a quarter from the plan period');
  if ((b.note ?? '').length > 1000) fail(400, 'note_too_long', 'Keep the note under 1000 characters');
  const rec: MilestoneRecord = {
    id: mockId('ms'), pillarId, title, phase: Number(b.phase) as Phase, quarter: b.quarter, note: (b.note ?? '').trim(),
    loggedAt: nowIso(), loggedBy: user?.name,
  };
  db.milestones.update(list => { list.unshift(rec); });
  appendAudit(user, 'Logged milestone', title, pillarId);
  return rec;
});
