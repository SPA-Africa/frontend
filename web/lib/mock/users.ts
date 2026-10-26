import type { Role, User } from '../types';

// Fictional sample accounts, one per role, used by the demo sign-in.
export const demoUsers: Record<Role, User> = {
  beneficiary: { id: 'u-ben-1', name: 'Aline Uwase', email: 'aline@example.com', role: 'beneficiary', country: 'Rwanda' },
  org_client: { id: 'u-org-1', name: 'Jean Mugisha', email: 'jean@greenhills.example.org', role: 'org_client', orgId: 'org-1', country: 'Rwanda' },
  pillar_rep: { id: 'u-rep-1', name: 'Grace Ineza', email: 'grace@spa.example.org', role: 'pillar_rep', pillarId: 'technology' },
  judge_mentor: { id: 'u-judge-1', name: 'David Okello', email: 'david@spa.example.org', role: 'judge_mentor' },
  executive_admin: { id: 'u-exec-1', name: 'Executive Office', email: 'office@spa.example.org', role: 'executive_admin' },
  board_auditor: { id: 'u-board-1', name: 'Board Member', email: 'board@spa.example.org', role: 'board_auditor' },
};

export const roleLabel: Record<Role, string> = {
  beneficiary: 'Learner',
  org_client: 'Organisation',
  pillar_rep: 'Pillar Representative',
  judge_mentor: 'Judge / Mentor',
  executive_admin: 'Executive Office',
  board_auditor: 'Board of Trustees',
};

export const roleBlurb: Record<Role, string> = {
  beneficiary: 'Take courses, earn certificates, pitch your startup and sell produce.',
  org_client: 'Book trainings and coaching for your team and track invoices.',
  pillar_rep: 'Manage courses, milestones and KPIs for your pillar.',
  judge_mentor: 'Score anonymised startup pitches.',
  executive_admin: 'Run the platform: approvals, settings, reports and audit.',
  board_auditor: 'Read-only view of progress against the ten-year plan.',
};
