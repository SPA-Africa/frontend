// ai-svc / assessment: needs assessment scoring and recommendations (SRS FR-C3.2, FR-C3.6)
//
// Scoring model (seed questionnaire v1, served by core-svc GET /capacity/assessment/questionnaire):
//   1. Each answer on the 1 to 5 scale maps to 0 to 1: (answer - 1) / 4.
//   2. Area score = question-weighted mean of its answers.
//   3. Overall = area-weighted mean of area scores (area weights sum to 1).
//   4. Focus areas = up to three areas scoring below 0.6, weakest first (or the single weakest area).
//   5. Recommended topics = the first topic mapped to each focus area.
//   6. Package = Custom when overall < 0.3 with three focus areas, Advanced for more than one topic, else Standard.

import { defineEndpoint, type CallArgs, type MockContext } from '../../define';
import { db } from '../../mock/tables';
import { mockId, nowIso } from '../../mock-db';
import { orgDb, type AreaId, type StoredAssessment } from '../../mock/org-tables';

export interface SubmitAssessmentRequest {
  /** Questionnaire version the answers were given against */
  version: number;
  /** Question id to answer on the scale (1 to 5) */
  answers: Record<string, number>;
}

export interface RecommendedTopic { id: string; title: string; areaId: AreaId; duration: string; modes: string[] }

export interface AssessmentResult {
  id: string;
  version: number;
  completedAt: string;
  answers: Record<string, number>;
  /** 0 to 1 per area */
  areaScores: Record<AreaId, number>;
  /** 0 to 1 */
  overall: number;
  /** Focus areas, weakest first */
  weakest: AreaId[];
  topics: RecommendedTopic[];
  packageId: string;
  packageName: string;
  packagePrice: number | null;
  /** Overall score of the previous assessment, for re-assessment comparison */
  previousOverall: number | null;
}

export interface AssessmentHistoryItem { id: string; completedAt: string; overall: number }

const orgOf = <A extends CallArgs>(ctx: MockContext<A>) => ctx.user?.orgId ?? ctx.fail(403, 'no_organisation', 'Your account is not linked to an organisation');

const historyOf = (orgId: string) =>
  orgDb.assessments.get().filter(a => a.orgId === orgId).sort((a, b) => b.completedAt.localeCompare(a.completedAt));

function present(a: StoredAssessment, previous?: StoredAssessment): AssessmentResult {
  const catalogue = db.catalogue.get();
  const pkg = db.packages.get().find(p => p.id === a.packageId);
  return {
    id: a.id, version: a.version, completedAt: a.completedAt, answers: a.answers, areaScores: a.areaScores, overall: a.overall, weakest: a.weakest,
    topics: a.topicIds.map((id, i) => {
      const t = catalogue.find(x => x.id === id);
      return { id, title: t?.title ?? id, areaId: a.weakest[i], duration: t?.duration ?? '', modes: t?.modes ?? [] };
    }),
    packageId: a.packageId, packageName: pkg?.name ?? a.packageId, packagePrice: pkg?.price ?? null,
    previousOverall: previous?.overall ?? null,
  };
}

export const submit = defineEndpoint<AssessmentResult, { body: SubmitAssessmentRequest }>({
  id: 'assessment.submit', service: 'ai', method: 'POST', path: '/assessments',
  roles: ['org_client'], summary: 'Score a completed needs assessment and recommend topics and a package',
  srs: ['FR-C3.2', 'FR-C3.3', 'FR-C3.4', 'FR-C3.6'], request: 'SubmitAssessmentRequest', response: 'AssessmentResult',
  emits: ['assessment.completed'], offline: true,
  notes: 'Fetch weights from core-svc for the submitted version. Every question must be answered with an integer 1 to 5 (400 "incomplete"). Store the result per organisation; re-assessment appends a new result and keeps history. Only recommend published topics.',
}, ctx => {
  const orgId = orgOf(ctx);
  const q = orgDb.questionnaire.get();
  const { answers, version } = ctx.args.body;
  if (version !== q.version) ctx.fail(409, 'stale_questionnaire', 'The questionnaire changed. Please reload and answer again.');
  if (q.questions.some(x => !Number.isInteger(answers[x.id]) || answers[x.id] < 1 || answers[x.id] > 5)) ctx.fail(400, 'incomplete', 'Answer every question');

  const areaScores = {} as Record<AreaId, number>;
  for (const a of q.areas) {
    const qs = q.questions.filter(x => x.areaId === a.id);
    const w = qs.reduce((s, x) => s + x.weight, 0) || 1;
    areaScores[a.id] = qs.reduce((s, x) => s + ((answers[x.id] - 1) / 4) * x.weight, 0) / w;
  }
  const overall = q.areas.reduce((s, a) => s + areaScores[a.id] * a.weight, 0) / q.areas.reduce((s, a) => s + a.weight, 0);
  const sorted = [...q.areas].sort((x, y) => areaScores[x.id] - areaScores[y.id]);
  const weak = sorted.filter(a => areaScores[a.id] < 0.6).slice(0, 3);
  const weakest = (weak.length ? weak : sorted.slice(0, 1)).map(a => a.id);
  const published = new Set(db.catalogue.get().filter(t => t.status === 'published').map(t => t.id));
  const topicIds = weakest
    .map(id => q.areas.find(a => a.id === id)!.topicIds.find(t => published.has(t)))
    .filter((t): t is string => !!t);
  const packageId = overall < 0.3 && weakest.length >= 3 ? 'pkg-custom' : topicIds.length > 1 ? 'pkg-advanced' : 'pkg-standard';

  const previous = historyOf(orgId)[0];
  const stored: StoredAssessment = { id: mockId('as'), orgId, version, completedAt: nowIso(), answers, areaScores, overall, weakest, topicIds, packageId };
  orgDb.assessments.update(list => { list.push(stored); });
  return present(stored, previous);
});

export const latest = defineEndpoint<AssessmentResult | null>({
  id: 'assessment.latest', service: 'ai', method: 'GET', path: '/assessments/me/latest',
  roles: ['org_client'], summary: "The organisation's most recent assessment result, or null", srs: ['FR-C3.5', 'FR-C3.6'],
  response: 'AssessmentResult | null', notes: 'RLS: caller organisation only.',
}, ctx => {
  const [a, prev] = historyOf(orgOf(ctx));
  return a ? present(a, prev) : null;
});

export const history = defineEndpoint<AssessmentHistoryItem[]>({
  id: 'assessment.history', service: 'ai', method: 'GET', path: '/assessments/me',
  roles: ['org_client'], summary: 'Past assessment scores, newest first, to compare re-assessments', srs: ['FR-C3.5'],
  response: 'AssessmentHistoryItem[]',
}, ctx => historyOf(orgOf(ctx)).map(a => ({ id: a.id, completedAt: a.completedAt, overall: a.overall })));
