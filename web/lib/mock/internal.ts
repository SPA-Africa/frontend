// Sample data for the internal staff portals (Pillar console, grading terminal,
// Executive Office and Board). All names are fictional.

import type { EnrollmentStatus, Invoice, Kpi, PillarId, Role } from '../types';
import { courses, invoices, invoiceTotals, kpis, milestones } from './data';

/* ---------- dates and plan timing ---------- */

// Fixed "today" so server and client render the same numbers.
export const TODAY = '2026-10-24';
// The ten-year plan baseline used to pro-rate KPI targets (FR-B3.6).
export const PLAN_START = '2025-07-01';
export const CURRENT_QUARTER = '2026-Q4';

export const quarterLabel = (q: string) => {
  const [y, n] = q.split('-');
  return `${n} ${y}`;
};

const quarterEnd = (q: string) => {
  const [y, n] = q.split('-Q');
  const month = Number(n) * 3;
  const last = new Date(Date.UTC(Number(y), month, 0));
  return last.toISOString().slice(0, 10);
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Share of the KPI period that has passed on a given date. */
export const elapsedShare = (dueYear: number, on: string = TODAY) => {
  const start = Date.parse(PLAN_START);
  const end = Date.parse(`${dueYear}-12-31`);
  return clamp01((Date.parse(on) - start) / (end - start));
};

export interface KpiStatus {
  progress: number; // actual / target
  expected: number; // pro-rated target for today
  ratio: number; // actual / expected
  behind: boolean; // ratio < 0.7
}

export function kpiStatus(k: Kpi, actual = k.actual, on: string = TODAY): KpiStatus {
  const expected = k.target * elapsedShare(k.dueYear, on);
  const ratio = expected > 0 ? actual / expected : 1;
  return { progress: k.target ? actual / k.target : 0, expected, ratio, behind: ratio < 0.7 };
}

export const trendQuarters = ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'];
const trendShape = [0.12, 0.3, 0.52, 0.8, 1];

/** Cumulative actual vs expected per quarter for one KPI. */
export function kpiTrend(k: Kpi) {
  return trendQuarters.map((q, i) => {
    const on = q === CURRENT_QUARTER ? TODAY : quarterEnd(q);
    return { quarter: q, actual: Math.round(k.actual * trendShape[i]), expected: Math.round(k.target * elapsedShare(k.dueYear, on)) };
  });
}

/* ---------- pillar reach and inclusion ---------- */

export const pillarReach: Record<PillarId, { learners: number; women: number; youth: number }> = {
  technology: { learners: 680, women: 0.48, youth: 0.88 },
  education: { learners: 330, women: 0.61, youth: 0.38 },
  leadership: { learners: 554, women: 0.51, youth: 0.74 },
  young_startups: { learners: 355, women: 0.42, youth: 0.97 },
  agriculture: { learners: 204, women: 0.57, youth: 0.92 },
};

export const monthlyEnrolments: Record<PillarId, { month: string; value: number }[]> = {
  technology: [['May', 48], ['Jun', 71], ['Jul', 96], ['Aug', 118], ['Sep', 142], ['Oct', 205]].map(([month, value]) => ({ month: month as string, value: value as number })),
  education: [['May', 22], ['Jun', 31], ['Jul', 40], ['Aug', 52], ['Sep', 66], ['Oct', 119]].map(([month, value]) => ({ month: month as string, value: value as number })),
  leadership: [['May', 54], ['Jun', 60], ['Jul', 88], ['Aug', 97], ['Sep', 120], ['Oct', 135]].map(([month, value]) => ({ month: month as string, value: value as number })),
  young_startups: [['May', 30], ['Jun', 44], ['Jul', 51], ['Aug', 70], ['Sep', 74], ['Oct', 86]].map(([month, value]) => ({ month: month as string, value: value as number })),
  agriculture: [['May', 12], ['Jun', 19], ['Jul', 28], ['Aug', 35], ['Sep', 49], ['Oct', 61]].map(([month, value]) => ({ month: month as string, value: value as number })),
};

/* ---------- learners ---------- */

export type Gender = 'Female' | 'Male';
export type AgeBand = '15 to 24' | '25 to 35' | '36 and over';

export interface Learner {
  id: string;
  name: string;
  country: string;
  gender: Gender;
  ageBand: AgeBand;
  pillarId: PillarId;
  courseId: string;
  progress: number;
  status: EnrollmentStatus;
}

const L = (id: string, name: string, country: string, gender: Gender, ageBand: AgeBand, pillarId: PillarId, courseId: string, progress: number, status: EnrollmentStatus): Learner =>
  ({ id, name, country, gender, ageBand, pillarId, courseId, progress, status });

export const learners: Learner[] = [
  L('ln-01', 'Nadia Mukeshimana', 'Rwanda', 'Female', '15 to 24', 'technology', 'c-ai-foundations', 0.82, 'in_progress'),
  L('ln-02', 'Kevin Ndayishimiye', 'Burundi', 'Male', '25 to 35', 'technology', 'c-ai-foundations', 1, 'completed'),
  L('ln-03', 'Amina Said', 'Kenya', 'Female', '25 to 35', 'technology', 'c-digital-marketing', 0.45, 'in_progress'),
  L('ln-04', 'Joel Tumusiime', 'Uganda', 'Male', '15 to 24', 'technology', 'c-digital-marketing', 0.1, 'enrolled'),
  L('ln-05', 'Fatou Diallo', 'Senegal', 'Female', '15 to 24', 'technology', 'c-ai-foundations', 0.64, 'in_progress'),
  L('ln-06', 'Samuel Mwangi', 'Kenya', 'Male', '36 and over', 'technology', 'c-digital-marketing', 1, 'completed'),
  L('ln-07', 'Esther Nyiraneza', 'Rwanda', 'Female', '25 to 35', 'technology', 'c-ai-foundations', 0.3, 'in_progress'),
  L('ln-08', 'Moses Kato', 'Uganda', 'Male', '25 to 35', 'technology', 'c-ai-foundations', 0.05, 'dropped'),
  L('ln-09', 'Chantal Iradukunda', 'Rwanda', 'Female', '15 to 24', 'technology', 'c-digital-marketing', 0.92, 'in_progress'),
  L('ln-10', 'Ibrahim Traore', "Côte d'Ivoire", 'Male', '15 to 24', 'technology', 'c-ai-foundations', 1, 'completed'),
  L('ln-11', 'Grace Achieng', 'Kenya', 'Female', '36 and over', 'technology', 'c-ai-foundations', 0.57, 'in_progress'),
  L('ln-12', 'Patrick Habineza', 'Rwanda', 'Male', '25 to 35', 'technology', 'c-digital-marketing', 0, 'enrolled'),
  L('ln-13', 'Mariam Juma', 'Tanzania', 'Female', '15 to 24', 'technology', 'c-ai-foundations', 0.71, 'in_progress'),
  L('ln-14', 'Olivier Kabera', 'Rwanda', 'Male', '15 to 24', 'technology', 'c-ai-foundations', 0.38, 'in_progress'),
  L('ln-15', 'Sandrine Uwimana', 'Rwanda', 'Female', '25 to 35', 'technology', 'c-digital-marketing', 1, 'completed'),
  L('ln-16', 'Thabo Nkosi', 'South Africa', 'Male', '25 to 35', 'technology', 'c-ai-foundations', 0.22, 'in_progress'),
  L('ln-17', 'Josiane Mutoni', 'Rwanda', 'Female', '25 to 35', 'education', 'c-teaching-digital', 0.6, 'in_progress'),
  L('ln-18', 'Emmanuel Nsengiyumva', 'Rwanda', 'Male', '36 and over', 'education', 'c-critical-thinking', 1, 'completed'),
  L('ln-19', 'Brian Otieno', 'Kenya', 'Male', '15 to 24', 'leadership', 'c-emerging-leaders', 0.4, 'in_progress'),
  L('ln-20', 'Divine Umutoni', 'Rwanda', 'Female', '15 to 24', 'agriculture', 'c-smart-farming', 0.75, 'in_progress'),
];

export const isYouth = (a: AgeBand) => a !== '36 and over';

/* ---------- competitions ---------- */

export interface CycleEntry {
  code: string;
  cycleId: string;
  businessName: string;
  sector: string;
  judgesAssigned: number;
  scoresIn: number;
  aggregate: number; // weighted, 0..10
}

const pilotNames: [string, string, number, number][] = [
  ['SokoFresh', 'Agritech', 3, 7.6],
  ['Ishuri Offline', 'Edtech', 3, 7.9],
  ['Izuba Kits', 'Clean energy', 3, 8.3],
  ['MamaCare SMS', 'Health', 3, 7.4],
  ['Kigali Crafts Hub', 'Creative industries', 3, 6.2],
  ['PayRoute', 'Fintech', 2, 7.1],
  ['GreenCrate', 'Logistics', 3, 6.8],
  ['Umurima Analytics', 'Agritech', 3, 7.0],
  ['TaxiLink', 'Mobility', 1, 5.9],
  ['Akeza Foods', 'Food processing', 3, 6.6],
  ['CodeSchool Rwanda', 'Edtech', 3, 7.7],
  ['WasteToValue', 'Clean energy', 2, 6.4],
  ['HerShop', 'E-commerce', 3, 7.2],
  ['Inzu Build', 'Construction', 2, 5.8],
  ['FarmLedger', 'Fintech', 3, 6.9],
  ['ClinicQueue', 'Health', 3, 7.3],
  ['Amazi Pure', 'Water', 0, 6.1],
  ['TourLocal', 'Tourism', 3, 6.0],
  ['BeeHive Honey', 'Agritech', 2, 6.7],
  ['SkillMatch', 'Jobs', 3, 7.5],
];

export const cycleEntries: CycleEntry[] = pilotNames.map(([businessName, sector, scoresIn, aggregate], i) => ({
  code: ['PITCH-2026-00163', 'PITCH-2026-00171', 'PITCH-2026-00188', 'PITCH-2026-00102'][i] ?? `PITCH-2026-${String(110 + i * 7).padStart(5, '0')}`,
  cycleId: 'cy-pilot-2026', businessName, sector, judgesAssigned: 3, scoresIn, aggregate,
}));

/* ---------- judging ---------- */

// other judges' aggregate per entry, revealed only after this judge submits (FR-B2.5)
export const otherJudgesAverage: Record<string, number> = {
  'PITCH-2026-00163': 7.4,
  'PITCH-2026-00171': 7.9,
  'PITCH-2026-00188': 8.1,
  'PITCH-2026-00102': 7.2,
};

export interface SubmittedScore {
  code: string;
  cycleId: string;
  sector: string;
  submittedAt: string;
  scores: Record<string, number>;
  comment: string;
}

export const judgeHistory: SubmittedScore[] = [
  { code: 'PITCH-2026-00102', cycleId: 'cy-pilot-2026', sector: 'Health', submittedAt: '2026-07-04',
    scores: { innovation: 7, market: 8, team: 7, finance: 6, impact: 9 },
    comment: 'Strong partnership with community health workers and a clear problem. The cost per message needs to be tested at scale before the next round.' },
  { code: 'PITCH-2025-00841', cycleId: 'cy-pilot-2026', sector: 'Agritech', submittedAt: '2026-07-02',
    scores: { innovation: 6, market: 7, team: 8, finance: 7, impact: 7 },
    comment: 'Experienced team with good farmer relationships. The revenue model depends on one buyer, which is a real risk to plan around.' },
];

/* ---------- catalogue management ---------- */

export type CatalogueStatus = 'published' | 'draft' | 'retired';
export const catalogueStatus: Record<string, CatalogueStatus> = {
  't-change': 'draft',
  't-innovation': 'draft',
};

/* ---------- staff and people ---------- */

export type AccountStatus = 'pending_approval' | 'active' | 'declined' | 'suspended';

export interface Person {
  id: string;
  name: string;
  email: string;
  role: Role;
  pillarId?: PillarId;
  status: AccountStatus;
  joinedAt: string;
  note?: string;
  // board terms (FR-B1.9)
  termStart?: string;
  termNumber?: 1 | 2;
}

export const people: Person[] = [
  { id: 'p-01', name: 'Grace Ineza', email: 'grace@spa.example.org', role: 'pillar_rep', pillarId: 'technology', status: 'active', joinedAt: '2026-02-10' },
  { id: 'p-02', name: 'Yves Bizimana', email: 'yves@spa.example.org', role: 'pillar_rep', pillarId: 'education', status: 'active', joinedAt: '2026-02-14' },
  { id: 'p-03', name: 'Rose Akinyi', email: 'rose@spa.example.org', role: 'pillar_rep', pillarId: 'leadership', status: 'active', joinedAt: '2026-03-02' },
  { id: 'p-04', name: 'Didier Manzi', email: 'didier@spa.example.org', role: 'pillar_rep', pillarId: 'young_startups', status: 'active', joinedAt: '2026-03-05' },
  { id: 'p-05', name: 'Solange Mukamana', email: 'solange@spa.example.org', role: 'pillar_rep', pillarId: 'agriculture', status: 'pending_approval', joinedAt: '2026-10-20', note: 'Replaces the interim Agriculture lead.' },
  { id: 'p-06', name: 'David Okello', email: 'david@spa.example.org', role: 'judge_mentor', status: 'active', joinedAt: '2026-04-11' },
  { id: 'p-07', name: 'Nana Asante', email: 'nana@mentors.example.org', role: 'judge_mentor', status: 'active', joinedAt: '2026-04-15' },
  { id: 'p-08', name: 'Leila Haddad', email: 'leila@mentors.example.org', role: 'judge_mentor', status: 'pending_approval', joinedAt: '2026-10-18', note: 'Angel investor, fintech focus.' },
  { id: 'p-09', name: 'Joseph Mbeki', email: 'joseph@mentors.example.org', role: 'judge_mentor', status: 'pending_approval', joinedAt: '2026-10-22', note: 'Agronomist, mentor for the Agri Innovators Challenge.' },
  { id: 'p-10', name: 'Clarisse Uwera', email: 'clarisse@spa.example.org', role: 'pillar_rep', pillarId: 'education', status: 'pending_approval', joinedAt: '2026-10-23', note: 'Deputy for teacher programmes.' },
  { id: 'p-11', name: 'Executive Office', email: 'office@spa.example.org', role: 'executive_admin', status: 'active', joinedAt: '2026-01-05' },
  { id: 'p-12', name: 'Margaret Wanjiru', email: 'm.wanjiru@board.example.org', role: 'board_auditor', status: 'active', joinedAt: '2024-03-01', termStart: '2024-03-01', termNumber: 1 },
  { id: 'p-13', name: 'Samuel Adeyemi', email: 's.adeyemi@board.example.org', role: 'board_auditor', status: 'active', joinedAt: '2022-01-15', termStart: '2025-01-15', termNumber: 2 },
  { id: 'p-14', name: 'Helene Kayitesi', email: 'h.kayitesi@board.example.org', role: 'board_auditor', status: 'active', joinedAt: '2026-01-10', termStart: '2026-01-10', termNumber: 1 },
  { id: 'p-15', name: 'Aline Uwase', email: 'aline@example.com', role: 'beneficiary', status: 'active', joinedAt: '2026-05-02' },
  { id: 'p-16', name: 'Jean Mugisha', email: 'jean@greenhills.example.org', role: 'org_client', status: 'active', joinedAt: '2026-06-01' },
  { id: 'p-17', name: 'Pacifique Ntwari', email: 'pacifique@mentors.example.org', role: 'judge_mentor', status: 'suspended', joinedAt: '2026-04-20', note: 'Paused at own request.' },
];

export const BOARD_TERM_YEARS = 3;
export const BOARD_MAX_TERMS = 2;

export function termInfo(p: Person) {
  if (!p.termStart) return null;
  const start = new Date(p.termStart + 'T00:00:00Z');
  const end = new Date(start);
  end.setUTCFullYear(start.getUTCFullYear() + BOARD_TERM_YEARS);
  const endIso = end.toISOString().slice(0, 10);
  const monthsLeft = (Date.parse(endIso) - Date.parse(TODAY)) / (1000 * 60 * 60 * 24 * 30.44);
  return { end: endIso, monthsLeft, endingSoon: monthsLeft <= 6 && monthsLeft >= 0, finalTerm: p.termNumber === BOARD_MAX_TERMS };
}

/* ---------- audit log ---------- */

export interface AuditEvent {
  id: string;
  at: string; // ISO datetime
  actor: string;
  role: Role | 'system';
  action: string;
  target: string;
  pillarId?: PillarId;
}

export const auditEvents: AuditEvent[] = [
  { id: 'ae-24', at: '2026-10-24T08:42:00', actor: 'Grace Ineza', role: 'pillar_rep', action: 'Logged milestone', target: 'First cohort of 40 trainees enrolled', pillarId: 'technology' },
  { id: 'ae-23', at: '2026-10-23T17:10:00', actor: 'Clarisse Uwera', role: 'pillar_rep', action: 'Requested staff account', target: 'Pillar Representative, Education', pillarId: 'education' },
  { id: 'ae-22', at: '2026-10-23T14:05:00', actor: 'Executive Office', role: 'executive_admin', action: 'Updated setting', target: 'Data deletion SLA set to 30 days' },
  { id: 'ae-21', at: '2026-10-22T19:31:00', actor: 'Joseph Mbeki', role: 'judge_mentor', action: 'Requested staff account', target: 'Judge / Mentor' },
  { id: 'ae-20', at: '2026-10-22T11:12:00', actor: 'Didier Manzi', role: 'pillar_rep', action: 'Opened competition cycle', target: 'Agri Innovators Challenge', pillarId: 'young_startups' },
  { id: 'ae-19', at: '2026-10-21T09:48:00', actor: 'Grace Ineza', role: 'pillar_rep', action: 'Published course', target: 'Digital Marketing and Remote Work', pillarId: 'technology' },
  { id: 'ae-18', at: '2026-10-20T16:20:00', actor: 'Executive Office', role: 'executive_admin', action: 'Issued invoice', target: 'SPA-INV-2026-0035' },
  { id: 'ae-17', at: '2026-10-20T10:02:00', actor: 'system', role: 'system', action: 'Virus scan passed', target: 'Business plan for PITCH-2026-00417', pillarId: 'young_startups' },
  { id: 'ae-16', at: '2026-10-18T15:44:00', actor: 'Leila Haddad', role: 'judge_mentor', action: 'Requested staff account', target: 'Judge / Mentor' },
  { id: 'ae-15', at: '2026-10-17T12:30:00', actor: 'Rose Akinyi', role: 'pillar_rep', action: 'Updated KPI actual', target: 'Leadership cohorts trained: 2', pillarId: 'leadership' },
  { id: 'ae-14', at: '2026-10-15T09:15:00', actor: 'Executive Office', role: 'executive_admin', action: 'Published quarterly report', target: 'Q3 2026 M&E report' },
  { id: 'ae-13', at: '2026-10-14T13:00:00', actor: 'Yves Bizimana', role: 'pillar_rep', action: 'Edited course', target: 'Teaching with Digital Tools', pillarId: 'education' },
  { id: 'ae-12', at: '2026-10-10T18:22:00', actor: 'Solange Mukamana', role: 'pillar_rep', action: 'Updated KPI actual', target: 'Produce marketed through the platform: 9 tonnes', pillarId: 'agriculture' },
  { id: 'ae-11', at: '2026-10-03T10:40:00', actor: 'Executive Office', role: 'executive_admin', action: 'Issued invoice', target: 'SPA-INV-2026-0031' },
  { id: 'ae-10', at: '2026-09-30T08:05:00', actor: 'system', role: 'system', action: 'Issued certificate', target: 'SPA-LDR-2026-0412', pillarId: 'leadership' },
  { id: 'ae-09', at: '2026-09-12T11:00:00', actor: 'Executive Office', role: 'executive_admin', action: 'Approved staff account', target: 'Rose Akinyi, Pillar Representative', pillarId: 'leadership' },
  { id: 'ae-08', at: '2026-07-04T17:45:00', actor: 'David Okello', role: 'judge_mentor', action: 'Submitted score', target: 'PITCH-2026-00102', pillarId: 'young_startups' },
  { id: 'ae-07', at: '2026-07-03T09:30:00', actor: 'Nana Asante', role: 'judge_mentor', action: 'Declared conflict of interest', target: 'PITCH-2026-00145', pillarId: 'young_startups' },
  { id: 'ae-06', at: '2026-07-02T09:30:00', actor: 'Executive Office', role: 'executive_admin', action: 'Revoked certificate', target: 'SPA-AGR-2026-0057', pillarId: 'agriculture' },
  { id: 'ae-05', at: '2026-06-30T23:59:00', actor: 'system', role: 'system', action: 'Closed submissions', target: 'Kigali Pilot Pitch Night', pillarId: 'young_startups' },
];

/* ---------- quarterly reports ---------- */

export type ReportStatus = 'draft' | 'in_review' | 'published';
export interface QuarterReport {
  quarter: string;
  status: ReportStatus;
  publishedAt?: string;
  summary: string;
  scale: number; // share of today's KPI actuals reached by the end of that quarter
}

export const quarterReports: QuarterReport[] = [
  { quarter: '2026-Q4', status: 'draft', summary: 'Compiling. Pillar Representatives are still logging October and November results.', scale: 1 },
  { quarter: '2026-Q3', status: 'in_review', summary: 'First cohort of the AI and Digital Skills Academy enrolled, baseline study finished and the Kigali pilot pitch judged.', scale: 0.8 },
  { quarter: '2026-Q2', status: 'published', publishedAt: '2026-07-20', summary: 'Pillar Representatives appointed, first courses published and the Kigali Pilot Pitch Night held with 20 entries.', scale: 0.52 },
  { quarter: '2026-Q1', status: 'published', publishedAt: '2026-04-18', summary: 'Registration work under way, first partner conversations held and the platform specification approved.', scale: 0.3 },
];

export function compileReport(quarter: string, scale: number) {
  return {
    kpis: kpis.map(k => ({ ...k, actual: Math.round(k.actual * scale) })),
    milestones: milestones.filter(m => m.quarter <= quarter),
  };
}

/* ---------- phases ---------- */

export const phaseOutputs: Record<number, { by: string; outputs: string[] }> = {
  1: { by: '2027', outputs: ['Legal registration completed', '5 to 10 MOUs signed with partners'] },
  2: { by: '2029', outputs: ['1,500 beneficiaries trained', '5 pilot projects running', 'Programme operations manual'] },
  3: { by: '2031', outputs: ['3 regional hubs open', '5,000 youths reached'] },
  4: { by: '2033', outputs: ['10,000+ beneficiaries', '50+ startups supported'] },
  5: { by: '2035', outputs: ['Presence in 10 African nations'] },
  6: { by: '2036', outputs: ['Self-sustaining institution', 'Research institute established'] },
};

/* ---------- invoices across organisations ---------- */

export const orgByBooking: Record<string, string> = {
  'bk-104': 'Green Hills Academy', 'bk-097': 'Green Hills Academy', 'bk-081': 'Green Hills Academy',
  'bk-070': 'Umurage Savings Cooperative', 'bk-066': 'Lake Kivu Health Network', 'bk-059': 'Imbuto Youth Network',
};

export const otherInvoices: Invoice[] = [
  { id: 'inv-4', number: 'SPA-INV-2026-0027', bookingId: 'bk-070', issuedAt: '2026-05-12', dueAt: '2026-06-11', currency: 'RWF', taxRate: 0.18, paid: 4956000, status: 'paid',
    lines: [{ description: 'Advanced package: Strategic Development and Planning', qty: 1, unitPrice: 4200000 }] },
  { id: 'inv-5', number: 'SPA-INV-2026-0033', bookingId: 'bk-066', issuedAt: '2026-08-20', dueAt: '2026-09-19', currency: 'RWF', taxRate: 0.18, paid: 0, status: 'overdue',
    lines: [{ description: 'Standard package: Healthy Teams, Healthy Organisations', qty: 1, unitPrice: 1800000 }, { description: 'Travel to venue', qty: 1, unitPrice: 220000 }] },
  { id: 'inv-6', number: 'SPA-INV-2026-0034', bookingId: 'bk-059', issuedAt: '2026-09-28', dueAt: '2026-10-28', currency: 'RWF', taxRate: 0.18, paid: 0, status: 'issued',
    lines: [{ description: 'Custom programme: Leadership Training across three districts', qty: 1, unitPrice: 6500000 }] },
];

export const allInvoices = [...invoices, ...otherInvoices].sort((a, b) => b.number.localeCompare(a.number));

/* ---------- funding pipeline ---------- */

export const RWF_PER_USD = 1400;
export type FundingStage = 'prospect' | 'proposal' | 'committed' | 'received';
export type FundingType = 'grant' | 'partnership' | 'earned';

export interface FundingItem {
  id: string;
  source: string;
  type: FundingType;
  stage: FundingStage;
  amountUsd: number;
  note: string;
}

const earnedFromInvoices = (): FundingItem[] => [...invoices, ...otherInvoices].map(inv => {
  const t = invoiceTotals(inv);
  const received = inv.status === 'paid';
  return {
    id: `f-${inv.id}`,
    source: `Coaching invoice ${inv.number}`,
    type: 'earned' as const,
    stage: received ? 'received' as const : 'committed' as const,
    amountUsd: Math.round(t.total / RWF_PER_USD),
    note: received ? 'Paid in full' : `RWF ${t.balance.toLocaleString('en-US')} outstanding`,
  };
});

export const fundingPipeline: FundingItem[] = [
  { id: 'f-1', source: 'Lakeside Foundation youth skills grant', type: 'grant', stage: 'received', amountUsd: 120000, note: 'Two-year grant for the AI and Digital Skills Academy' },
  { id: 'f-2', source: 'Great Rift Education Trust', type: 'grant', stage: 'committed', amountUsd: 85000, note: 'Teacher capacity building, first tranche in January' },
  { id: 'f-3', source: 'Horizon Agri Fund', type: 'grant', stage: 'proposal', amountUsd: 150000, note: 'Smart Agriculture Training Centres' },
  { id: 'f-4', source: 'Continental Youth Enterprise Facility', type: 'grant', stage: 'prospect', amountUsd: 250000, note: 'Seed capital pool for Young Startups' },
  { id: 'f-5', source: 'Kivu Telecom partnership', type: 'partnership', stage: 'committed', amountUsd: 40000, note: 'Connectivity and devices for learning hubs' },
  { id: 'f-6', source: 'University of the Hills', type: 'partnership', stage: 'proposal', amountUsd: 25000, note: 'Co-funded research and library centre' },
  { id: 'f-7', source: 'Leadership retreats for corporate teams', type: 'earned', stage: 'prospect', amountUsd: 30000, note: 'Three enquiries from Kigali firms' },
  ...earnedFromInvoices(),
];

export const fundingStages: FundingStage[] = ['prospect', 'proposal', 'committed', 'received'];
export const fundingTargetMix = { grants: 0.6, earned: 0.4 };

/* ---------- programmes ---------- */

export const programmeStatus: Record<string, boolean> = {
  'Information Monetisation Projects': false,
  'Research and Library Centres': false,
  'Leadership Incubation Centre': false,
  'Startup Accelerator Partnership': false,
};

/* ---------- helpers ---------- */

export const courseTitle = (id: string) => courses.find(c => c.id === id)?.title ?? id;
