// core-svc / judging: blind grading terminal (SRS FR-B2.1 to FR-B2.7)
//
// Judges only ever see an anonymous entry code. Business name, team, founder names, photos,
// contact details and original file names never reach them (FR-A3.7, NFR-SEC.9), and documents are
// only served as anonymised copies that core-svc prepares in the background after submission (FR-B2.2).

import { defineEndpoint } from '../../define';
import { nowIso } from '../../mock-db';
import { db } from '../../mock/tables';
import { copyStatus } from '../../mock/assist-tables';
import { demoPdf } from '../../mock/demo-pdf';
import { appendAudit, consoleDb, type JudgeDraft } from '../../mock/console-tables';
import { recomputeAggregates, rerouteEntry, weightedTotal } from '../ai/evaluation';
import { rubric as seedRubric } from '../../../mock/data';
import type { RubricCriterion } from '../../../types';

export const MIN_COMMENT = 50;
export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

export type QueueStatus = 'pending' | 'in_progress' | 'submitted';

export interface JudgeQueueItem {
  code: string;
  cycleId: string;
  cycleName: string;
  /** grading deadline for the cycle */
  dueAt: string;
  sector: string;
  summary: string;
  fundingRequested: number;
  status: QueueStatus;
}

export interface EntryDocument {
  kind: 'business_plan' | 'pitch_deck';
  /** anonymised display name, `<code>-business-plan.pdf` */
  name: string;
  sizeMb: number;
  scan: 'pending' | 'clean';
  /** the anonymised copy: ready to view, still being prepared, or not available (judge on the summary) */
  status: 'ready' | 'pending' | 'unavailable';
}

export interface GradingEntry {
  code: string;
  cycle: { id: string; name: string; region: string };
  sector: string;
  summary: string;
  fundingRequested: number;
  status: QueueStatus;
  documents: EntryDocument[];
  /** the caller's saved, unsubmitted work */
  draft?: JudgeDraft;
  /** the caller's submitted score, once submitted */
  submitted?: MyScore;
}

export interface MyScore {
  code: string;
  cycleId: string;
  cycleName: string;
  sector: string;
  submittedAt: string;
  scores: Record<string, number>;
  comment: string;
  /** weighted total, 0..10 */
  weighted: number;
  /** other judges' average; present because the caller has submitted (FR-B2.5) */
  peerAverage: number | null;
}

export interface PeerAverage { code: string; average: number; judges: number }

export interface SaveDraftRequest { scores: Record<string, number>; comment: string }
export interface SubmitScoreRequest { scores: Record<string, number>; comment: string }

export type RecusalReason = 'knows_team' | 'financial_interest' | 'advised_team' | 'other';
export interface RecusalRequest { reason: RecusalReason; details?: string; confirmed: boolean }
export interface RecusalResult { code: string; reassigned: boolean }

export interface DocumentLink { url: string; expiresAt: string; redacted: boolean }

/* ---------- helpers ---------- */

const judgeIdOf = (user: { id: string } | null) => user?.id ?? 'anonymous';
const draftKey = (judgeId: string, code: string) => `${judgeId}:${code}`;
const cycleOf = (id: string) => db.cycles.get().find(c => c.id === id);

const peerAverageOf = (code: string) => {
  const v = consoleDb.peerAverages.get()[code] ?? db.cycleEntries.get().find(e => e.code === code)?.aggregate;
  return v === undefined ? null : v;
};

const myScoreOf = (judgeId: string, code: string): MyScore | undefined => {
  const s = consoleDb.judgeScores.get().find(x => x.judgeId === judgeId && x.code === code);
  if (!s) return undefined;
  return { ...s, cycleName: cycleOf(s.cycleId)?.name ?? s.cycleId, weighted: weightedTotal(s.scores), peerAverage: peerAverageOf(code) };
};

const statusOf = (judgeId: string, code: string): QueueStatus =>
  myScoreOf(judgeId, code) ? 'submitted' : consoleDb.judgeDrafts.get()[draftKey(judgeId, code)] ? 'in_progress' : 'pending';

function assigned(code: string, fail: (s: number, c: string, m: string) => never) {
  return db.judgeQueue.get().find(e => e.code === code) ?? fail(404, 'not_assigned', 'This entry is not in your queue, or you have been recused from it');
}

/** Demo entries without stored files get both documents */
const DEMO_FILES = [{ kind: 'business_plan' as const, sizeMb: 2.1, scan: 'clean' as const }, { kind: 'pitch_deck' as const, sizeMb: 5.4, scan: 'clean' as const }];

/** Current clean files only, as the backend returns them, each with the state of its anonymised copy */
const documentsOf = (code: string): EntryDocument[] => {
  const files = db.pitches.get().find(p => p.code === code)?.files;
  return (files?.length ? files : DEMO_FILES).filter(f => f.scan === 'clean')
    .map(f => ({ kind: f.kind, name: `${code}-${f.kind.replace('_', '-')}.pdf`, sizeMb: f.sizeMb, scan: f.scan, status: copyStatus(code, f.kind) }));
};

/** Mock mode: a stand-in anonymised copy built in the browser, one object URL per document */
const demoCopies = new Map<string, string>();
function demoCopyUrl(e: { code: string; sector: string; summary: string; fundingRequested: number }, kind: EntryDocument['kind']) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return `/media/redacted/${e.code}/${kind}.pdf`;
  const key = `${e.code}:${kind}`;
  let url = demoCopies.get(key);
  if (!url) {
    const deck = kind === 'pitch_deck';
    const h = (text: string) => ({ text, size: 13, bold: true, gapAfter: 4 });
    url = URL.createObjectURL(demoPdf([
      { text: `Anonymised copy - ${e.code} - ${deck ? 'Pitch deck' : 'Business plan'}`, size: 16, bold: true, gapAfter: 4 },
      { text: 'Prepared for blind judging. Names, contact details and other identifying details are replaced with [REDACTED]. Pictures, logos and the original layout are not included.', size: 9.5, gapAfter: 16 },
      h(deck ? 'Slide 1: The problem and our answer' : 'Summary'), { text: e.summary },
      h(deck ? 'Slide 2: The ask' : 'Funding requested'), { text: `USD ${e.fundingRequested.toLocaleString('en-US')} to grow [REDACTED] in the ${e.sector.toLowerCase()} sector.` },
      h(deck ? 'Slide 3: Team' : 'Team and contact'), { text: '[REDACTED] (Founder) and [REDACTED] (Operations). Contact: [REDACTED].' },
      { text: 'Demo copy. In the live system this is the anonymised text of the document the founder uploaded.', size: 9, gapAfter: 0 },
    ]));
    demoCopies.set(key, url);
  }
  return url;
}

function checkScores(scores: Record<string, number>, fail: (s: number, c: string, m: string) => never, complete: boolean) {
  const ids = new Set(seedRubric.map(r => r.id));
  Object.entries(scores).forEach(([k, v]) => {
    if (!ids.has(k)) fail(400, 'unknown_criterion', `Unknown criterion "${k}"`);
    if (!Number.isInteger(v) || v < SCORE_MIN || v > SCORE_MAX) fail(400, 'score_out_of_range', `Scores must be whole numbers from ${SCORE_MIN} to ${SCORE_MAX}`);
  });
  if (complete && seedRubric.some(r => scores[r.id] === undefined)) fail(400, 'incomplete_rubric', 'Score every criterion before submitting');
}

/* ---------- endpoints ---------- */

export const listQueue = defineEndpoint<JudgeQueueItem[], { query?: { status?: QueueStatus } }>({
  id: 'judging.queue.list', service: 'core', method: 'GET', path: '/judging/queue',
  roles: ['judge_mentor'], summary: 'Anonymised entries routed to the calling judge, with the judge\'s own progress on each',
  srs: ['FR-B2.1', 'FR-B2.2', 'NFR-SEC.9'], response: 'JudgeQueueItem[]', query: ['status?: "pending" | "in_progress" | "submitted"'],
  notes: 'Assignments are created by ai-svc routing (POST /api/ai/evaluation/cycles/:cycleId/routing) after anonymisation. Never include business name, team, founder names or original file names. Entries the judge recused from are excluded. Sorted by status (in progress, pending, submitted) then code.',
}, ({ args, user }) => {
  const jid = judgeIdOf(user);
  const order: Record<QueueStatus, number> = { in_progress: 0, pending: 1, submitted: 2 };
  return db.judgeQueue.get()
    .map(e => {
      const c = cycleOf(e.cycleId);
      return { code: e.code, cycleId: e.cycleId, cycleName: c?.name ?? e.cycleId, dueAt: c?.closesAt ?? '', sector: e.sector, summary: e.summary, fundingRequested: e.fundingRequested, status: statusOf(jid, e.code) };
    })
    .filter(e => !args.query?.status || e.status === args.query.status)
    .sort((a, b) => order[a.status] - order[b.status] || a.code.localeCompare(b.code));
});

export const getEntry = defineEndpoint<GradingEntry, { params: { code: string } }>({
  id: 'judging.entries.get', service: 'core', method: 'GET', path: '/judging/entries/:code',
  roles: ['judge_mentor'], summary: 'Anonymised entry for grading by its code, with documents and the caller\'s draft or submitted score',
  srs: ['FR-B2.2', 'FR-B2.3', 'NFR-SEC.9'], response: 'GradingEntry',
  notes: '404 not_assigned unless the entry is routed to the caller and not recused. Response must contain no personal data: no names, team, photos, emails, phones or original file names (NFR-SEC.9). `documents` lists the entry\'s current files that passed the virus scan (none for an entry without files), each with the `status` of its anonymised copy: ready, pending (being prepared) or unavailable (AI turned off, three failed attempts, or the original is missing).',
}, ({ args, user, fail }) => {
  const e = assigned(args.params.code, fail);
  const jid = judgeIdOf(user);
  const c = cycleOf(e.cycleId);
  const documents = documentsOf(e.code);
  const submitted = myScoreOf(jid, e.code);
  return {
    code: e.code, cycle: { id: e.cycleId, name: c?.name ?? e.cycleId, region: c?.region ?? '' }, sector: e.sector, summary: e.summary,
    fundingRequested: e.fundingRequested, status: statusOf(jid, e.code), documents, submitted,
    draft: submitted ? undefined : consoleDb.judgeDrafts.get()[draftKey(jid, e.code)],
  };
});

export const getDocumentLink = defineEndpoint<DocumentLink, { params: { code: string; kind: EntryDocument['kind'] } }>({
  id: 'judging.documents.link', service: 'core', method: 'GET', path: '/judging/entries/:code/documents/:kind',
  roles: ['judge_mentor'], summary: 'Short-lived pre-signed link to the anonymised copy of an entry document',
  srs: ['FR-B2.2', 'FR-B2.3', 'NFR-SEC.9'], response: 'DocumentLink',
  notes: 'Serves the anonymised copy only, never the upload: a PDF rendered after submission with names, contact details, links and other identifying details replaced by [REDACTED] (Claude, then a deterministic pass over the entry\'s known names). Opened inline in the page viewer; the URL expires after 5 minutes. 409 redaction_pending while the copy is being prepared; 409 redaction_unavailable when there is none.',
}, ({ args, fail }) => {
  const e = assigned(args.params.code, fail);
  const doc = documentsOf(e.code).find(d => d.kind === args.params.kind);
  if (doc?.status === 'pending') fail(409, 'redaction_pending', 'The anonymised copy is still being prepared. Try again in a minute.');
  if (doc?.status !== 'ready') fail(409, 'redaction_unavailable', 'An anonymised copy of this document is not available');
  return { url: demoCopyUrl(e, args.params.kind), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(), redacted: true };
});

export const getRubric = defineEndpoint<RubricCriterion[], { params: { cycleId: string } }>({
  id: 'judging.rubric.get', service: 'core', method: 'GET', path: '/judging/cycles/:cycleId/rubric',
  roles: ['judge_mentor', 'pillar_rep', 'executive_admin'], summary: 'Scoring rubric of a cycle: criteria, weights (sum to 1) and hints',
  srs: ['FR-B2.4'], response: 'RubricCriterion[]',
}, ({ args, fail }) => {
  if (!cycleOf(args.params.cycleId)) fail(404, 'cycle_not_found', 'This cycle does not exist');
  return seedRubric;
});

export const saveDraft = defineEndpoint<JudgeDraft, { params: { code: string }; body: SaveDraftRequest }>({
  id: 'judging.drafts.save', service: 'core', method: 'PUT', path: '/judging/entries/:code/draft',
  roles: ['judge_mentor'], summary: 'Save unsubmitted scores and comment so grading can continue later or offline',
  srs: ['FR-B2.4'], request: 'SaveDraftRequest', response: 'JudgeDraft', offline: true,
  notes: 'Partial rubric allowed; each score must be an integer 1 to 10. 409 already_submitted once the score is submitted. Drafts are private to the judge.',
}, ({ args, user, fail }) => {
  const e = assigned(args.params.code, fail);
  const jid = judgeIdOf(user);
  if (myScoreOf(jid, e.code)) fail(409, 'already_submitted', 'This score is already submitted');
  checkScores(args.body.scores, fail, false);
  const draft: JudgeDraft = { scores: args.body.scores, comment: args.body.comment ?? '', savedAt: nowIso() };
  consoleDb.judgeDrafts.update(d => { d[draftKey(jid, e.code)] = draft; });
  return draft;
});

export const submitScore = defineEndpoint<MyScore, { params: { code: string }; body: SubmitScoreRequest }>({
  id: 'judging.scores.submit', service: 'core', method: 'POST', path: '/judging/entries/:code/scores',
  roles: ['judge_mentor'], summary: 'Submit the final rubric score and written comment for an entry',
  srs: ['FR-B2.4', 'FR-B2.5', 'FR-B2.6'], request: 'SubmitScoreRequest', response: 'MyScore', emits: ['pitch.scored'], offline: true,
  notes: `Every criterion scored with an integer ${SCORE_MIN} to ${SCORE_MAX} (400 incomplete_rubric / score_out_of_range); comment at least ${MIN_COMMENT} characters after trimming (400 comment_too_short). 409 already_submitted: scores are immutable once submitted. On success ai-svc recomputes the aggregate (FR-B2.6) and the response includes the other judges' average (FR-B2.5).`,
}, ({ args, user, fail }) => {
  const e = assigned(args.params.code, fail);
  const jid = judgeIdOf(user);
  if (myScoreOf(jid, e.code)) fail(409, 'already_submitted', 'This score is already submitted');
  checkScores(args.body.scores, fail, true);
  const comment = (args.body.comment ?? '').trim();
  if (comment.length < MIN_COMMENT) fail(400, 'comment_too_short', `Write at least ${MIN_COMMENT} characters of feedback`);
  const at = nowIso();
  consoleDb.judgeScores.update(list => { list.push({ judgeId: jid, code: e.code, cycleId: e.cycleId, sector: e.sector, submittedAt: at, scores: args.body.scores, comment }); });
  consoleDb.judgeDrafts.update(d => { delete d[draftKey(jid, e.code)]; });
  db.judgeQueue.update(list => { const q = list.find(x => x.code === e.code); if (q) (q as { status: string }).status = 'submitted'; });
  db.cycleEntries.update(list => { const c = list.find(x => x.code === e.code); if (c) c.scoresIn = Math.min(c.judgesAssigned, c.scoresIn + 1); });
  recomputeAggregates(e.cycleId);
  appendAudit(user, 'Submitted score', e.code, 'young_startups');
  return myScoreOf(jid, e.code)!;
});

export const getPeerAverage = defineEndpoint<PeerAverage, { params: { code: string } }>({
  id: 'judging.peers.average', service: 'core', method: 'GET', path: '/judging/entries/:code/peer-average',
  roles: ['judge_mentor'], summary: 'Average weighted score of the other judges on an entry',
  srs: ['FR-B2.5'], response: 'PeerAverage',
  notes: '403 score_not_submitted until the caller has submitted their own score for this entry, so judging stays independent. Never reveals individual judges or their scores.',
}, ({ args, user, fail }) => {
  const jid = judgeIdOf(user);
  if (!myScoreOf(jid, args.params.code)) fail(403, 'score_not_submitted', 'Submit your own score to see the other judges\' average');
  const entry = db.cycleEntries.get().find(e => e.code === args.params.code);
  return { code: args.params.code, average: peerAverageOf(args.params.code) ?? 0, judges: Math.max(1, (entry?.scoresIn ?? 3) - 1) };
});

export const recuse = defineEndpoint<RecusalResult, { params: { code: string }; body: RecusalRequest }>({
  id: 'judging.recusals.create', service: 'core', method: 'POST', path: '/judging/entries/:code/recusal',
  roles: ['judge_mentor'], summary: 'Declare a conflict of interest, leave the entry and have it re-routed to another judge',
  srs: ['FR-B2.7'], request: 'RecusalRequest', response: 'RecusalResult', emits: ['pitch.recused'],
  notes: 'Requires confirmed = true and a reason (details required when reason = other, max 500 chars). 409 already_submitted after a score is submitted. Discards the judge\'s draft, removes the assignment, writes an audit entry and calls ai-svc POST /evaluation/entries/:code/reroute so a replacement judge is assigned.',
}, ({ args, user, fail }) => {
  const e = assigned(args.params.code, fail);
  const jid = judgeIdOf(user);
  const b = args.body;
  if (!b.confirmed) fail(400, 'not_confirmed', 'Confirm the declaration to continue');
  if (!['knows_team', 'financial_interest', 'advised_team', 'other'].includes(b.reason)) fail(400, 'reason_required', 'Choose a reason');
  if (b.reason === 'other' && !b.details?.trim()) fail(400, 'details_required', 'Describe the conflict in a few words');
  if (myScoreOf(jid, e.code)) fail(409, 'already_submitted', 'You have already submitted a score for this entry');
  consoleDb.recusals.update(list => { list.push({ code: e.code, judgeId: jid, reason: b.reason, at: nowIso() }); });
  consoleDb.judgeDrafts.update(d => { delete d[draftKey(jid, e.code)]; });
  db.judgeQueue.update(list => list.filter(x => x.code !== e.code));
  rerouteEntry(e.code, jid);
  appendAudit(user, 'Declared conflict of interest', e.code, 'young_startups');
  return { code: e.code, reassigned: true };
});

export const listMyScores = defineEndpoint<MyScore[]>({
  id: 'judging.scores.mine', service: 'core', method: 'GET', path: '/judging/scores/me',
  roles: ['judge_mentor'], summary: 'Scores the caller has submitted, newest first, with the other judges\' average',
  srs: ['FR-B2.5'], response: 'MyScore[]',
}, ({ user }) => {
  const jid = judgeIdOf(user);
  return consoleDb.judgeScores.get().filter(s => s.judgeId === jid)
    .map(s => myScoreOf(jid, s.code)!)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
});
