// Mock tables for the organisation client portal (SRS module C).
// Bookings and invoices themselves stay in the shared `db.bookings` and `db.invoices` tables so the
// Executive Office sees them too. These tables hold what the shared ones do not: which organisation
// owns a booking, the assessment questionnaire and results, organisation profiles and their users,
// and capacity-building settings (travel fee rule).

import { mockTable } from '../mock-db';

/* ---------- needs assessment questionnaire (configured in core-svc, FR-C3.1) ---------- */
export type AreaId = 'maturity' | 'leadership' | 'team' | 'change' | 'delivery' | 'reporting' | 'impact';

export interface AssessmentArea { id: AreaId; title: string; intro: string; weight: number; topicIds: string[] }
export interface AssessmentQuestion { id: string; areaId: AreaId; text: string; weight: number }
export interface ScalePoint { value: number; label: string }

export interface Questionnaire {
  version: number;
  areas: AssessmentArea[];
  questions: AssessmentQuestion[];
  scale: ScalePoint[];
}

const questionnaireSeed: Questionnaire = {
  version: 1,
  areas: [
    { id: 'maturity', title: 'Organisational maturity', intro: 'How settled your structures, systems and plans are.', weight: 0.2, topicIds: ['t-capacity', 't-strategy'] },
    { id: 'leadership', title: 'Leadership practices', intro: 'How leaders decide, give feedback and grow others.', weight: 0.15, topicIds: ['t-leadership', 't-team'] },
    { id: 'team', title: 'Team health', intro: 'Workload, wellbeing and how safe people feel to speak up.', weight: 0.15, topicIds: ['t-healthy', 't-people'] },
    { id: 'change', title: 'Change readiness', intro: 'How well the organisation adapts to new ways of working.', weight: 0.1, topicIds: ['t-change', 't-innovation'] },
    { id: 'delivery', title: 'Project delivery', intro: 'Planning, running and closing projects.', weight: 0.15, topicIds: ['t-project'] },
    { id: 'reporting', title: 'Reporting quality', intro: 'Reports for donors, boards and partners.', weight: 0.1, topicIds: ['t-reporting'] },
    { id: 'impact', title: 'Impact measurement', intro: 'Knowing where you start and proving the change you make.', weight: 0.15, topicIds: ['t-baseline'] },
  ],
  questions: [
    { id: 'q1', areaId: 'maturity', text: 'We have clear roles, written processes and a plan for the next two to three years.', weight: 1 },
    { id: 'q2', areaId: 'maturity', text: 'Our finance, HR and data systems help our work rather than slow it down.', weight: 1 },
    { id: 'q3', areaId: 'leadership', text: 'Leaders give regular, useful feedback and explain how decisions are made.', weight: 1.2 },
    { id: 'q4', areaId: 'leadership', text: 'We are actively growing the next generation of leaders inside the organisation.', weight: 0.8 },
    { id: 'q5', areaId: 'team', text: 'Workloads are manageable and people feel safe raising concerns.', weight: 1 },
    { id: 'q6', areaId: 'change', text: 'When we change how we work, people understand why and come along.', weight: 1 },
    { id: 'q7', areaId: 'delivery', text: 'Our projects are usually delivered on time and on budget.', weight: 1 },
    { id: 'q8', areaId: 'reporting', text: 'Our reports are clear, on time and useful to the people who read them.', weight: 1 },
    { id: 'q9', areaId: 'impact', text: 'We collect baseline data before a programme starts.', weight: 0.8 },
    { id: 'q10', areaId: 'impact', text: 'We can show evidence of the change our work creates.', weight: 1.2 },
  ],
  scale: [
    { value: 1, label: 'Not at all' },
    { value: 2, label: 'Rarely' },
    { value: 3, label: 'Sometimes' },
    { value: 4, label: 'Mostly' },
    { value: 5, label: 'Fully in place' },
  ],
};

/* ---------- assessment results (written by ai-svc) ---------- */
export interface StoredAssessment {
  id: string;
  orgId: string;
  version: number;
  completedAt: string; // ISO datetime
  answers: Record<string, number>;
  areaScores: Record<AreaId, number>; // 0 to 1
  overall: number; // 0 to 1
  weakest: AreaId[];
  topicIds: string[];
  packageId: string;
}

/* ---------- organisations ---------- */
export interface OrgProfile {
  id: string;
  name: string;
  type: string;
  sector: string;
  country: string;
  city: string;
  address: string;
  tin: string;
  size: string;
  website: string;
  billingEmail: string;
}

export type OrgUserRole = 'owner' | 'finance' | 'coordinator';
export interface OrgUser { id: string; orgId: string; name: string; email: string; role: OrgUserRole; status: 'active' | 'invited'; invitedAt?: string }

/* ---------- booking ownership and details not on the shared Booking row ---------- */
export interface BookingMeta {
  orgId: string;
  start: string; // YYYY-MM-DD
  end?: string;
  reason?: string;
  notes?: string;
  invoiceId?: string;
  recommended?: { topicIds: string[]; packageId: string };
  rescheduleRequest?: { start: string; end?: string; reason: string; requestedAt: string };
}

export interface CapacityFeeRules {
  /** Flat travel fee in RWF added for in-person or hybrid delivery outside the exempt locations */
  travelFee: number;
  /** Locations where no travel fee applies (case-insensitive match on the location field) */
  travelFeeExemptLocations: string[];
}

export const orgDb = {
  questionnaire: mockTable('org.questionnaire', () => questionnaireSeed),

  assessments: mockTable<StoredAssessment[]>('org.assessments', () => [
    {
      id: 'as-1', orgId: 'org-1', version: 1, completedAt: '2026-06-20T09:30:00Z',
      answers: { q1: 3, q2: 2, q3: 3, q4: 2, q5: 4, q6: 3, q7: 2, q8: 3, q9: 1, q10: 2 },
      areaScores: { maturity: 0.375, leadership: 0.4, team: 0.75, change: 0.5, delivery: 0.25, reporting: 0.5, impact: 0.15 },
      overall: 0.4075, weakest: ['impact', 'delivery', 'maturity'], topicIds: ['t-baseline', 't-project', 't-capacity'], packageId: 'pkg-advanced',
    },
  ]),

  orgs: mockTable<OrgProfile[]>('org.orgs', () => [
    { id: 'org-1', name: 'Green Hills Youth Network', type: 'NGO', sector: 'Youth development', country: 'Rwanda', city: 'Kigali', address: 'KG 9 Ave, Kigali', tin: '', size: '25 to 50 staff', website: '', billingEmail: 'finance@greenhills.example.org' },
    { id: 'org-2', name: 'Lakeview Cooperative Union', type: 'Cooperative', sector: 'Agriculture', country: 'Rwanda', city: 'Rubavu', address: 'Rubavu District', tin: '102345678', size: '50 to 200 staff', website: '', billingEmail: 'accounts@lakeview.example.org' },
    { id: 'org-3', name: 'Twese Health Partners', type: 'NGO', sector: 'Health', country: 'Rwanda', city: 'Huye', address: 'Huye District', tin: '', size: '10 to 25 staff', website: '', billingEmail: 'admin@twese.example.org' },
  ]),

  users: mockTable<OrgUser[]>('org.users', () => [
    { id: 'ou-1', orgId: 'org-1', name: 'Jean Mugisha', email: 'jean@greenhills.example.org', role: 'owner', status: 'active' },
    { id: 'ou-2', orgId: 'org-1', name: 'Diane Ingabire', email: 'diane@greenhills.example.org', role: 'finance', status: 'active' },
    { id: 'ou-3', orgId: 'org-1', name: 'Samuel Nkurunziza', email: 'samuel@greenhills.example.org', role: 'coordinator', status: 'invited', invitedAt: '2026-10-12' },
  ]),

  /** Keyed by booking id. Bookings without an entry belong to no organisation client. */
  bookingMeta: mockTable<Record<string, BookingMeta>>('org.bookingMeta', () => ({
    'bk-104': { orgId: 'org-1', start: '2026-11-10', end: '2026-11-13', invoiceId: 'inv-1' },
    'bk-097': { orgId: 'org-1', start: '2026-12-02', invoiceId: 'inv-3' },
    'bk-081': { orgId: 'org-1', start: '2026-07-14', end: '2026-07-16', invoiceId: 'inv-2', recommended: { topicIds: ['t-capacity'], packageId: 'pkg-standard' } },
    'bk-070': { orgId: 'org-2', start: '2026-05-20', invoiceId: 'inv-4' },
    'bk-066': { orgId: 'org-3', start: '2026-09-02', invoiceId: 'inv-5' },
    'bk-059': { orgId: 'org-2', start: '2026-10-20', invoiceId: 'inv-6' },
  })),

  feeRules: mockTable<CapacityFeeRules>('org.feeRules', () => ({ travelFee: 150000, travelFeeExemptLocations: ['Kigali', 'Online'] })),
};
