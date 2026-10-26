// Shared domain types. Field names follow the SRS data model so the mock layer
// can be swapped for the real NestJS / FastAPI endpoints later.

export type PillarId = 'technology' | 'education' | 'leadership' | 'young_startups' | 'agriculture';

export type Role = 'beneficiary' | 'org_client' | 'pillar_rep' | 'judge_mentor' | 'executive_admin' | 'board_auditor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  pillarId?: PillarId; // pillar_rep only
  orgId?: string; // org_client only
  country?: string;
}

export interface Pillar {
  id: PillarId;
  name: string;
  short: string;
  description: string;
  programs: string[];
}

export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'dropped';
export type LessonType = 'video' | 'reading' | 'pdf' | 'quiz';

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  minutes: number;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  program: string;
  pillarId: PillarId;
  summary: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  hours: number;
  language: ('English' | 'French' | 'Kinyarwanda')[];
  modules: Module[];
  outcomes: string[];
  published: boolean;
  enrolled: number;
}

export interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple' | 'true_false' | 'short';
  prompt: string;
  options?: string[];
  answer?: number[]; // indexes for objective types
}

export interface Certificate {
  code: string;
  holder: string;
  courseTitle: string;
  pillarId: PillarId;
  issuedAt: string;
  status: 'valid' | 'revoked';
}

export type PitchStatus = 'draft' | 'submitted' | 'under_review' | 'scored' | 'finalist' | 'winner' | 'not_selected';

export interface CompetitionCycle {
  id: string;
  name: string;
  region: string;
  opensAt: string;
  closesAt: string;
  status: 'upcoming' | 'open' | 'judging' | 'published';
  entries: number;
}

export interface PitchEntry {
  id: string;
  code: string; // anonymous code shown to judges
  cycleId: string;
  businessName: string;
  sector: string;
  summary: string;
  fundingRequested: number; // USD
  team: { name: string; role: string }[];
  status: PitchStatus;
  updatedAt: string;
  files: { kind: 'business_plan' | 'pitch_deck'; name: string; sizeMb: number; scan: 'pending' | 'clean' }[];
}

export interface RubricCriterion {
  id: string;
  label: string;
  weight: number;
  hint: string;
}

export interface AgriListing {
  id: string;
  title: string;
  category: 'Vegetables' | 'Fruits' | 'Grains' | 'Dairy' | 'Poultry' | 'Coffee & Tea';
  quantity: string;
  pricePerUnit: number; // RWF
  unit: string;
  location: string;
  seller: string;
  postedAt: string;
  image: string; // tailwind gradient classes used as a placeholder image
}

export interface CatalogueTopic {
  id: string;
  title: string;
  kind: 'Capacity Building' | 'Leadership Training' | 'Coaching';
  description: string;
  outcomes: string[];
  audience: string;
  duration: string;
  modes: ('In-person' | 'Virtual' | 'Hybrid')[];
  languages: string[];
  standalone: boolean;
}

export interface ServicePackage {
  id: string;
  name: 'Standard' | 'Advanced' | 'Custom';
  price: number | null; // RWF, null = quoted
  participants: string;
  duration: string;
  supportHours: number;
  includes: string[];
}

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'written_off';

export interface Invoice {
  id: string;
  number: string;
  bookingId: string;
  issuedAt: string;
  dueAt: string;
  currency: 'RWF';
  lines: { description: string; qty: number; unitPrice: number }[];
  taxRate: number;
  paid: number;
  status: InvoiceStatus;
}

export type BookingStatus = 'draft' | 'pending' | 'confirmed' | 'rescheduled' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  topics: string[];
  packageId: string;
  window: string;
  participants: number;
  mode: 'In-person' | 'Virtual' | 'Hybrid';
  location: string;
  status: BookingStatus;
  createdAt: string;
}

export interface Kpi {
  id: string;
  pillarId: PillarId | 'all';
  label: string;
  target: number;
  actual: number;
  unit?: string;
  dueYear: number;
  womenShare: number; // 0..1
  youthShare: number; // 0..1
}

export interface Milestone {
  id: string;
  pillarId: PillarId;
  title: string;
  phase: 1 | 2 | 3 | 4 | 5 | 6;
  quarter: string; // e.g. 2026-Q3
  note: string;
}
