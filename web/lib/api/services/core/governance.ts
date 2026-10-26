// core-svc / governance: approvals, people, board terms, settings, programmes, finance config, audit, funding (SRS FR-B1.5 to FR-B1.9, FR-C4.6)
//
// Access model
//   executive_admin  full read and write across every pillar. Every cross-pillar read is itself written
//                    to the audit log by the backend (FR-B1.6), so these GETs are not side-effect free.
//   board_auditor    SELECT-only database role (FR-B1.8). Only the read endpoints that list it may be called;
//                    the gateway must reject any write from this role even if the UI is bypassed.

import { defineEndpoint, paginate, type Page } from '../../define';
import { db } from '../../mock/tables';
import { adminDb, type ProgrammeRecord } from '../../mock/admin-tables';
import { mockId, nowIso } from '../../mock-db';
import { invoiceTotals, pillars } from '../../../mock/data';
import {
  BOARD_MAX_TERMS, BOARD_TERM_YEARS, RWF_PER_USD, TODAY, fundingStages, fundingTargetMix, orgByBooking,
  type AccountStatus, type AuditEvent, type FundingItem, type FundingStage, type FundingType, type Person,
} from '../../../mock/internal';
import type { Invoice, InvoiceStatus, PillarId, Role, ServicePackage, User } from '../../../types';

export type { AccountStatus, AuditEvent, FundingItem, FundingStage, FundingType, Person, ProgrammeRecord };

/* ---------- helpers ---------- */

const STAFF_ROLES: Role[] = ['pillar_rep', 'judge_mentor'];

/** Append-only audit write used by every mutation below (NFR-SEC.6). */
function writeAudit(user: User | null, action: string, target: string, pillarId?: PillarId) {
  db.audit.update(rows => {
    rows.unshift({
      id: mockId('ae'), at: nowIso(), actor: user?.name ?? 'system', role: user?.role ?? 'system', action, target,
      ...(pillarId ? { pillarId } : {}),
    });
  });
}

/* ---------- staff approvals (FR-B1.7) ---------- */

export interface StaffAccount extends Person {
  /** Role requested at registration */
  role: Role;
}

export interface DeclineStaffRequest {
  /** Optional reason included in the email to the applicant */
  reason?: string;
}

export const listStaffRequests = defineEndpoint<StaffAccount[], { query?: { status?: AccountStatus | 'all' } }>({
  id: 'governance.staffRequests.list', service: 'core', method: 'GET', path: '/governance/staff-requests',
  roles: ['executive_admin'], summary: 'Pillar Representative and Judge/Mentor accounts, newest first, filtered by approval status',
  srs: ['FR-B1.7'], response: 'StaffAccount[]', query: ['status?: "pending_approval" | "active" | "declined" | "suspended" | "all" (default pending_approval)'],
  notes: 'Self-registered staff are created with status pending_approval and cannot sign in (login returns 403 account_pending) until approved.',
}, ({ args }) => {
  const status = args.query?.status ?? 'pending_approval';
  return db.people.get()
    .filter(p => STAFF_ROLES.includes(p.role) && (status === 'all' || p.status === status))
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
});

const decide = (kind: 'approve' | 'decline') => ({ args, user, fail }: { args: { params: { id: string }; body?: DeclineStaffRequest }; user: User | null; fail: (s: number, c: string, m: string) => never }) => {
  const person = db.people.get().find(p => p.id === args.params.id);
  if (!person || !STAFF_ROLES.includes(person.role)) return fail(404, 'not_found', 'Staff request not found');
  if (person.status !== 'pending_approval') return fail(409, 'invalid_state', 'This request has already been decided');
  const status: AccountStatus = kind === 'approve' ? 'active' : 'declined';
  db.people.update(rows => {
    const p = rows.find(x => x.id === person.id)!;
    p.status = status;
    if (kind === 'decline' && args.body?.reason) p.note = args.body.reason;
  });
  writeAudit(user, kind === 'approve' ? 'Approved staff account' : 'Declined staff account', person.name, person.pillarId);
  return { ...person, status };
};

export const approveStaff = defineEndpoint<StaffAccount, { params: { id: string } }>({
  id: 'governance.staffRequests.approve', service: 'core', method: 'POST', path: '/governance/staff-requests/:id/approve',
  roles: ['executive_admin'], summary: 'Approve a pending staff account so the person can sign in',
  srs: ['FR-B1.7'], response: 'StaffAccount', emits: ['staff.approved'],
  notes: 'Only from pending_approval (else 409 invalid_state). Grants the role; for pillar_rep also binds the RLS pillar scope. Sends the welcome email. Audit-logged.',
}, decide('approve'));

export const declineStaff = defineEndpoint<StaffAccount, { params: { id: string }; body?: DeclineStaffRequest }>({
  id: 'governance.staffRequests.decline', service: 'core', method: 'POST', path: '/governance/staff-requests/:id/decline',
  roles: ['executive_admin'], summary: 'Decline a pending staff account', srs: ['FR-B1.7'],
  request: 'DeclineStaffRequest', response: 'StaffAccount', emits: ['staff.declined'],
  notes: 'Only from pending_approval (else 409). The account stays unable to sign in; the applicant may register again. Audit-logged.',
}, decide('decline'));

/* ---------- people and board terms (FR-B1.8, FR-B1.9) ---------- */

export interface BoardTerm {
  termNumber: 1 | 2;
  termStart: string;
  termEnd: string;
  monthsLeft: number;
  /** Ends within 6 months: the Executive Office gets a reminder */
  endingSoon: boolean;
  /** Second consecutive term, cannot be renewed */
  finalTerm: boolean;
}

export interface PersonRow extends Person {
  term?: BoardTerm;
}

export interface BoardTermsSummary {
  termYears: number;
  maxConsecutiveTerms: number;
  /** Months before the end of a term when the reminder is raised */
  reminderMonths: number;
  trustees: PersonRow[];
}

export type PeopleQuery = {
  q?: string;
  role?: Role | 'all';
  status?: AccountStatus | 'all';
  pillar?: PillarId | 'all';
  page?: number;
  pageSize?: number;
};

function termOf(p: Person): BoardTerm | undefined {
  if (!p.termStart || !p.termNumber) return undefined;
  const start = new Date(p.termStart + 'T00:00:00Z');
  const end = new Date(start);
  end.setUTCFullYear(start.getUTCFullYear() + BOARD_TERM_YEARS);
  const termEnd = end.toISOString().slice(0, 10);
  const monthsLeft = (Date.parse(termEnd) - Date.parse(TODAY)) / (1000 * 60 * 60 * 24 * 30.44);
  return {
    termNumber: p.termNumber, termStart: p.termStart, termEnd, monthsLeft: Math.round(monthsLeft * 10) / 10,
    endingSoon: monthsLeft <= 6 && monthsLeft >= 0, finalTerm: p.termNumber >= BOARD_MAX_TERMS,
  };
}
const withTerm = (p: Person): PersonRow => ({ ...p, term: termOf(p) });

export const listPeople = defineEndpoint<Page<PersonRow>, { query?: PeopleQuery }>({
  id: 'governance.people.list', service: 'core', method: 'GET', path: '/governance/people',
  roles: ['executive_admin'], summary: 'Everyone with an account, with board term details for trustees',
  srs: ['FR-B1.8', 'FR-B1.9', 'NFR-BW.5'], response: 'Page<PersonRow>', paginated: true,
  query: ['q?: string (name or email)', 'role?: Role | "all"', 'status?: AccountStatus | "all"', 'pillar?: PillarId | "all"', 'page?: number', 'pageSize?: number (max 200)'],
  notes: 'Cross-pillar read: the backend writes an audit entry per request (FR-B1.6). Learner PII is limited to name and email here',
}, ({ args }) => {
  const q = args.query ?? {};
  const needle = (q.q ?? '').trim().toLowerCase();
  const rows = db.people.get().filter(p =>
    (!needle || `${p.name} ${p.email}`.toLowerCase().includes(needle)) &&
    (!q.role || q.role === 'all' || p.role === q.role) &&
    (!q.status || q.status === 'all' || p.status === q.status) &&
    (!q.pillar || q.pillar === 'all' || p.pillarId === q.pillar))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(withTerm);
  return paginate(rows, { ...q, pageSize: Math.min(200, Number(q.pageSize ?? 20)) });
});

export const listBoardTerms = defineEndpoint<BoardTermsSummary>({
  id: 'governance.boardTerms.list', service: 'core', method: 'GET', path: '/governance/board-terms',
  roles: ['executive_admin'], summary: 'Trustees with their current term, end date and renewal eligibility',
  srs: ['FR-B1.9'], response: 'BoardTermsSummary',
  notes: `Terms are ${BOARD_TERM_YEARS} years, at most ${BOARD_MAX_TERMS} consecutive. A nightly job raises a reminder notification to executive_admin when a term ends within 6 months.`,
}, () => ({
  termYears: BOARD_TERM_YEARS, maxConsecutiveTerms: BOARD_MAX_TERMS, reminderMonths: 6,
  trustees: db.people.get().filter(p => p.role === 'board_auditor').map(withTerm)
    .sort((a, b) => (a.term?.termEnd ?? '').localeCompare(b.term?.termEnd ?? '')),
}));

/* ---------- platform settings (FR-B1.5) ---------- */

export type LanguageCode = 'en' | 'fr' | 'rw' | 'sw' | 'pt';
export const SUPPORTED_LANGUAGES: LanguageCode[] = ['en', 'fr', 'rw', 'sw', 'pt'];

export interface PlatformSettings {
  /** Minimum learner age at registration (FR-A1.3) */
  minimumAge: number;
  /** 0..1 */
  quizPassMark: number;
  maxQuizAttempts: number;
  languages: LanguageCode[];
  deletionSlaDays: number;
  uploadLimitsMb: { businessPlan: number; pitchDeck: number };
  certificateVerification: boolean;
}

const pickSettings = (): PlatformSettings => {
  const s = db.settings.get();
  return {
    minimumAge: s.minimumAge, quizPassMark: s.quizPassMark, maxQuizAttempts: s.maxQuizAttempts,
    languages: s.languages as LanguageCode[], deletionSlaDays: s.deletionSlaDays,
    uploadLimitsMb: { ...s.uploadLimitsMb }, certificateVerification: s.certificateVerification,
  };
};

export const getSettings = defineEndpoint<PlatformSettings>({
  id: 'governance.settings.get', service: 'core', method: 'GET', path: '/governance/settings',
  roles: ['executive_admin'], summary: 'Platform-wide defaults: quizzes, languages, privacy, uploads, certificates',
  srs: ['FR-B1.5'], response: 'PlatformSettings',
}, pickSettings);

export const updateSettings = defineEndpoint<PlatformSettings, { body: Partial<PlatformSettings> }>({
  id: 'governance.settings.update', service: 'core', method: 'PATCH', path: '/governance/settings',
  roles: ['executive_admin'], summary: 'Change one or more platform defaults', srs: ['FR-B1.5', 'NFR-SEC.6'],
  request: 'Partial<PlatformSettings>', response: 'PlatformSettings', emits: ['settings.updated'],
  notes: 'Validation: quizPassMark 0.01 to 1; maxQuizAttempts 1 to 10; deletionSlaDays 1 to 90; upload limits 1 to 200 MB; languages must include "en". One audit entry per changed field.',
}, ({ args, user, fail }) => {
  const b = args.body ?? {};
  if (b.quizPassMark !== undefined && (b.quizPassMark <= 0 || b.quizPassMark > 1)) fail(400, 'invalid_pass_mark', 'Pass mark must be between 1 and 100%');
  if (b.maxQuizAttempts !== undefined && (b.maxQuizAttempts < 1 || b.maxQuizAttempts > 10)) fail(400, 'invalid_attempts', 'Attempts must be between 1 and 10');
  if (b.deletionSlaDays !== undefined && (b.deletionSlaDays < 1 || b.deletionSlaDays > 90)) fail(400, 'invalid_sla', 'Deletion SLA must be between 1 and 90 days');
  if (b.uploadLimitsMb && Object.values(b.uploadLimitsMb).some(v => v < 1 || v > 200)) fail(400, 'invalid_upload_limit', 'Upload limits must be between 1 and 200 MB');
  if (b.languages && !b.languages.includes('en')) fail(400, 'language_required', 'English cannot be turned off');
  if (b.minimumAge !== undefined && (b.minimumAge < 10 || b.minimumAge > 30)) fail(400, 'invalid_min_age', 'Minimum age must be between 10 and 30');
  const before = pickSettings();
  db.settings.update(s => ({ ...s, ...b, uploadLimitsMb: { ...s.uploadLimitsMb, ...(b.uploadLimitsMb ?? {}) } }));
  (Object.keys(b) as (keyof PlatformSettings)[])
    .filter(k => JSON.stringify(before[k]) !== JSON.stringify(b[k]))
    .forEach(k => writeAudit(user, 'Updated setting', `${k} set to ${JSON.stringify(b[k])}`));
  return pickSettings();
});

/* ---------- pillars and programmes (FR-B1.5) ---------- */

export interface Eligibility {
  minimumAge: number;
  /** Upper age counted as youth in inclusion reporting */
  youthMaxAge: number;
  guardianConsentUnder18: boolean;
}

export interface PillarProgrammes {
  id: PillarId;
  name: string;
  description: string;
  courseCount: number;
  /** Active Pillar Representatives */
  reps: string[];
  programmes: ProgrammeRecord[];
}

export interface ProgrammesConfig {
  eligibility: Eligibility;
  pillars: PillarProgrammes[];
}

export interface CreateProgrammeRequest { pillarId: PillarId; name: string }
export interface UpdateProgrammeRequest { name?: string; active?: boolean }

const eligibility = (): Eligibility => ({ minimumAge: db.settings.get().minimumAge, ...adminDb.eligibility.get() });

export const getProgrammes = defineEndpoint<ProgrammesConfig>({
  id: 'governance.programmes.get', service: 'core', method: 'GET', path: '/governance/programmes',
  roles: ['executive_admin'], summary: 'The five pillars with their programmes, active state, reps and eligibility rules',
  srs: ['FR-B1.5'], response: 'ProgrammesConfig',
}, () => {
  const people = db.people.get();
  const courses = db.courses.get();
  const progs = adminDb.programmes.get();
  return {
    eligibility: eligibility(),
    pillars: pillars.map(p => ({
      id: p.id, name: p.name, description: p.description,
      courseCount: courses.filter(c => c.pillarId === p.id).length,
      reps: people.filter(x => x.role === 'pillar_rep' && x.pillarId === p.id && x.status === 'active').map(x => x.name),
      programmes: progs.filter(x => x.pillarId === p.id),
    })),
  };
});

export const updateEligibility = defineEndpoint<Eligibility, { body: Partial<Eligibility> }>({
  id: 'governance.eligibility.update', service: 'core', method: 'PATCH', path: '/governance/eligibility',
  roles: ['executive_admin'], summary: 'Change the minimum learner age, youth upper age and guardian consent rule',
  srs: ['FR-A1.3', 'FR-B1.5'], request: 'Partial<Eligibility>', response: 'Eligibility', emits: ['settings.updated'],
  notes: 'minimumAge 10 to 30 (default 15), youthMaxAge 18 to 40 (default 35). Registration validates date of birth against minimumAge server-side. Audit-logged.',
}, ({ args, user, fail }) => {
  const b = args.body ?? {};
  if (b.minimumAge !== undefined && (b.minimumAge < 10 || b.minimumAge > 30)) fail(400, 'invalid_min_age', 'Minimum age must be between 10 and 30');
  if (b.youthMaxAge !== undefined && (b.youthMaxAge < 18 || b.youthMaxAge > 40)) fail(400, 'invalid_youth_age', 'Youth upper age must be between 18 and 40');
  if (b.minimumAge !== undefined) db.settings.update(s => { s.minimumAge = b.minimumAge!; });
  adminDb.eligibility.update(e => ({
    youthMaxAge: b.youthMaxAge ?? e.youthMaxAge,
    guardianConsentUnder18: b.guardianConsentUnder18 ?? e.guardianConsentUnder18,
  }));
  writeAudit(user, 'Updated setting', `Eligibility: minimum age ${eligibility().minimumAge}, youth to ${eligibility().youthMaxAge}`);
  return eligibility();
});

export const createProgramme = defineEndpoint<ProgrammeRecord, { body: CreateProgrammeRequest }>({
  id: 'governance.programmes.create', service: 'core', method: 'POST', path: '/governance/programmes',
  roles: ['executive_admin'], summary: 'Add a programme under a pillar, starting inactive', srs: ['FR-B1.5'],
  request: 'CreateProgrammeRequest', response: 'ProgrammeRecord', emits: ['programme.created'],
  notes: 'Name 3 to 80 characters, unique within the pillar (409 duplicate_programme).',
}, ({ args, user, fail }) => {
  const name = args.body?.name?.trim() ?? '';
  if (name.length < 3 || name.length > 80) return fail(400, 'invalid_name', 'Use 3 to 80 characters');
  if (adminDb.programmes.get().some(p => p.pillarId === args.body.pillarId && p.name.toLowerCase() === name.toLowerCase())) {
    return fail(409, 'duplicate_programme', 'This pillar already has a programme with that name');
  }
  const rec: ProgrammeRecord = { id: mockId('pg'), pillarId: args.body.pillarId, name, active: false };
  adminDb.programmes.update(rows => { rows.push(rec); });
  writeAudit(user, 'Created programme', name, rec.pillarId);
  return rec;
});

export const updateProgramme = defineEndpoint<ProgrammeRecord, { params: { id: string }; body: UpdateProgrammeRequest }>({
  id: 'governance.programmes.update', service: 'core', method: 'PATCH', path: '/governance/programmes/:id',
  roles: ['executive_admin'], summary: 'Rename a programme or turn it on or off', srs: ['FR-B1.5'],
  request: 'UpdateProgrammeRequest', response: 'ProgrammeRecord', emits: ['programme.updated'],
  notes: 'Inactive programmes are hidden from the public catalogue and from course authoring pickers; existing enrolments continue.',
}, ({ args, user, fail }) => {
  const cur = adminDb.programmes.get().find(p => p.id === args.params.id);
  if (!cur) return fail(404, 'not_found', 'Programme not found');
  const next = { ...cur, ...args.body };
  adminDb.programmes.update(rows => rows.map(r => (r.id === cur.id ? next : r)));
  writeAudit(user, next.active === cur.active ? 'Renamed programme' : next.active ? 'Activated programme' : 'Deactivated programme', next.name, next.pillarId);
  return next;
});

/* ---------- finance configuration and packages (FR-C4.6) ---------- */

export interface FinanceConfig {
  /** 0..1, Rwanda standard rate 0.18 */
  vatRate: number;
  /** Must contain {SEQ}; may contain {YEAR} */
  invoiceNumberFormat: string;
  nextSequence: number;
  paymentTermsDays: number;
  /** Number the next invoice will get */
  nextInvoiceNumber: string;
}

const financeConfig = (): FinanceConfig => {
  const s = db.settings.get();
  const next = adminDb.invoiceSequence.get().next;
  return {
    vatRate: s.vatRate, invoiceNumberFormat: s.invoiceNumberFormat, nextSequence: next, paymentTermsDays: s.paymentTermsDays,
    nextInvoiceNumber: s.invoiceNumberFormat.replace('{YEAR}', TODAY.slice(0, 4)).replace('{SEQ}', String(next).padStart(4, '0')),
  };
};

export const getFinanceConfig = defineEndpoint<FinanceConfig>({
  id: 'governance.finance.get', service: 'core', method: 'GET', path: '/governance/finance-config',
  roles: ['executive_admin'], summary: 'VAT rate, invoice numbering and payment terms', srs: ['FR-C4.6'], response: 'FinanceConfig',
}, financeConfig);

export const updateFinanceConfig = defineEndpoint<FinanceConfig, { body: Partial<Omit<FinanceConfig, 'nextInvoiceNumber'>> }>({
  id: 'governance.finance.update', service: 'core', method: 'PATCH', path: '/governance/finance-config',
  roles: ['executive_admin'], summary: 'Change VAT, numbering format, next sequence or payment terms', srs: ['FR-C4.6'],
  request: 'Partial<FinanceConfig>', response: 'FinanceConfig', emits: ['settings.updated'],
  notes: 'Format must include {SEQ}. nextSequence can only move forward (never reuse a number). Applies to invoices issued after the change. Audit-logged.',
}, ({ args, user, fail }) => {
  const b = args.body ?? {};
  if (b.invoiceNumberFormat !== undefined && !b.invoiceNumberFormat.includes('{SEQ}')) fail(400, 'invalid_format', 'Include {SEQ} so numbers are unique');
  if (b.vatRate !== undefined && (b.vatRate < 0 || b.vatRate > 0.5)) fail(400, 'invalid_vat', 'VAT must be between 0 and 50%');
  if (b.paymentTermsDays !== undefined && (b.paymentTermsDays < 0 || b.paymentTermsDays > 120)) fail(400, 'invalid_terms', 'Payment terms must be between 0 and 120 days');
  if (b.nextSequence !== undefined && b.nextSequence < adminDb.invoiceSequence.get().next) fail(400, 'sequence_backwards', 'The sequence can only move forward');
  db.settings.update(s => {
    if (b.vatRate !== undefined) s.vatRate = b.vatRate;
    if (b.invoiceNumberFormat !== undefined) s.invoiceNumberFormat = b.invoiceNumberFormat;
    if (b.paymentTermsDays !== undefined) s.paymentTermsDays = b.paymentTermsDays;
  });
  if (b.nextSequence !== undefined) adminDb.invoiceSequence.set({ next: b.nextSequence });
  writeAudit(user, 'Updated setting', 'Invoice settings');
  return financeConfig();
});

export const listPackages = defineEndpoint<ServicePackage[]>({
  id: 'governance.packages.list', service: 'core', method: 'GET', path: '/governance/packages',
  roles: ['executive_admin'], summary: 'Coaching service packages with their current prices, for editing', srs: ['FR-C4.6'],
  response: 'ServicePackage[]',
}, () => db.packages.get());

export const updatePackage = defineEndpoint<ServicePackage, { params: { id: string }; body: Partial<Omit<ServicePackage, 'id' | 'name'>> }>({
  id: 'governance.packages.update', service: 'core', method: 'PATCH', path: '/governance/packages/:id',
  roles: ['executive_admin'], summary: 'Change a package price, size, duration, support hours or inclusions', srs: ['FR-C4.6'],
  request: 'Partial<ServicePackage>', response: 'ServicePackage', emits: ['package.updated'],
  notes: 'price is RWF before VAT, or null for "quoted on request". New prices apply to bookings created after the change; existing bookings and invoices keep their price. Organisations see the change immediately.',
}, ({ args, user, fail }) => {
  const b = args.body ?? {};
  const cur = db.packages.get().find(p => p.id === args.params.id);
  if (!cur) return fail(404, 'not_found', 'Package not found');
  if (b.price !== undefined && b.price !== null && (b.price < 0 || !Number.isFinite(b.price))) fail(400, 'invalid_price', 'Price must be zero or more');
  if (b.supportHours !== undefined && b.supportHours < 0) fail(400, 'invalid_hours', 'Support hours must be zero or more');
  const next: ServicePackage = { ...cur, ...b, includes: (b.includes ?? cur.includes).map(s => s.trim()).filter(Boolean) };
  db.packages.update(rows => rows.map(p => (p.id === cur.id ? next : p)));
  writeAudit(user, 'Updated package', `${cur.name}${next.price !== cur.price ? `: price ${next.price ?? 'quoted'}` : ''}`);
  return next;
});

/* ---------- invoices across organisations ---------- */

export interface InvoiceRow extends Invoice {
  organisation: string;
  subtotal: number;
  tax: number;
  total: number;
  balance: number;
}

export interface InvoiceList extends Page<InvoiceRow> {
  totals: { billed: number; received: number; outstanding: number; overdue: number };
}

export const listInvoices = defineEndpoint<InvoiceList, { query?: { status?: InvoiceStatus | 'all'; q?: string; page?: number; pageSize?: number } }>({
  id: 'governance.invoices.list', service: 'core', method: 'GET', path: '/governance/invoices',
  roles: ['executive_admin'], summary: 'Every invoice issued to every organisation, newest number first, with totals',
  srs: ['FR-C4.6', 'NFR-BW.5'], response: 'InvoiceList', paginated: true,
  query: ['status?: InvoiceStatus | "all"', 'q?: string (number or organisation)', 'page?: number', 'pageSize?: number (max 200)'],
  notes: 'Cross-organisation read, audit-logged (FR-B1.6). totals cover the whole filtered set, not just the page. Amounts in RWF incl. VAT',
}, ({ args }) => {
  const q = args.query ?? {};
  const needle = (q.q ?? '').trim().toLowerCase();
  const rows: InvoiceRow[] = db.invoices.get().map(i => ({ ...i, organisation: orgByBooking[i.bookingId] ?? 'Unknown organisation', ...invoiceTotals(i) }))
    .filter(i => (!q.status || q.status === 'all' || i.status === q.status) && (!needle || `${i.number} ${i.organisation}`.toLowerCase().includes(needle)))
    .sort((a, b) => b.number.localeCompare(a.number));
  const totals = rows.reduce((s, i) => ({
    billed: s.billed + i.total, received: s.received + i.paid, outstanding: s.outstanding + i.balance,
    overdue: s.overdue + (i.status === 'overdue' ? i.balance : 0),
  }), { billed: 0, received: 0, outstanding: 0, overdue: 0 });
  return { ...paginate(rows, { ...q, pageSize: Math.min(200, Number(q.pageSize ?? 20)) }), totals };
});

/* ---------- audit log (NFR-SEC.6, FR-B1.6) ---------- */

export type AuditQuery = {
  q?: string;
  role?: Role | 'system' | 'all';
  action?: string;
  /** "none" means organisation-wide entries without a pillar */
  pillar?: PillarId | 'none' | 'all';
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export interface AuditPage extends Page<AuditEvent> {
  /** Distinct action names in the log, for the filter */
  actions: string[];
}

export const listAudit = defineEndpoint<AuditPage, { query?: AuditQuery }>({
  id: 'governance.audit.list', service: 'core', method: 'GET', path: '/governance/audit-events',
  roles: ['executive_admin'], summary: 'Immutable audit log, newest first, with filters', srs: ['NFR-SEC.6', 'FR-B1.6'],
  response: 'AuditPage', paginated: true,
  query: ['q?: string (actor or target)', 'role?: Role | "system" | "all"', 'action?: string', 'pillar?: PillarId | "none" | "all"', 'from?: ISO date', 'to?: ISO date', 'page?: number', 'pageSize?: number (max 500)'],
  notes: 'Append-only table: no UPDATE or DELETE grants for any role, enforced in Postgres. Reading the log is itself logged',
}, ({ args }) => {
  const q = args.query ?? {};
  const all = db.audit.get();
  const needle = (q.q ?? '').trim().toLowerCase();
  const rows = all.filter(e =>
    (!needle || `${e.actor} ${e.target}`.toLowerCase().includes(needle)) &&
    (!q.role || q.role === 'all' || e.role === q.role) &&
    (!q.action || e.action === q.action) &&
    (!q.pillar || q.pillar === 'all' || (q.pillar === 'none' ? !e.pillarId : e.pillarId === q.pillar)) &&
    (!q.from || e.at >= q.from) && (!q.to || e.at.slice(0, 10) <= q.to))
    .sort((a, b) => b.at.localeCompare(a.at));
  return { ...paginate(rows, { ...q, pageSize: Math.min(500, Number(q.pageSize ?? 20)) }), actions: [...new Set(all.map(e => e.action))].sort() };
});

/* ---------- funding pipeline (FR-B1.8, board funding visibility per SRS 1.2.1) ---------- */

export interface FundingPipeline {
  items: FundingItem[];
  stages: FundingStage[];
  /** Plan target share of secured funding: grants and partnerships vs earned income */
  targetMix: { grants: number; earned: number };
  rwfPerUsd: number;
}

export const listFunding = defineEndpoint<FundingPipeline>({
  id: 'governance.funding.list', service: 'core', method: 'GET', path: '/governance/funding',
  roles: ['executive_admin', 'board_auditor'], summary: 'Grants, partnerships and earned income by stage, in USD',
  srs: ['FR-B1.8'], response: 'FundingPipeline',
  notes: 'board_auditor: SELECT-only. Earned income rows are derived from invoices (paid = received, otherwise committed) at the configured RWF/USD rate.',
}, () => {
  const earned: FundingItem[] = db.invoices.get().map(inv => {
    const t = invoiceTotals(inv);
    const received = inv.status === 'paid';
    return {
      id: `f-${inv.id}`, source: `Coaching invoice ${inv.number}`, type: 'earned', stage: received ? 'received' : 'committed',
      amountUsd: Math.round(t.total / RWF_PER_USD), note: received ? 'Paid in full' : `RWF ${t.balance.toLocaleString('en-US')} outstanding`,
    };
  });
  return {
    items: [...db.funding.get().filter(f => !f.id.startsWith('f-inv')), ...earned],
    stages: fundingStages, targetMix: fundingTargetMix, rwfPerUsd: RWF_PER_USD,
  };
});
