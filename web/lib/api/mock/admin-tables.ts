// Mock tables owned by the Executive Office and Board scope (governance + reporting services).
// Shared tables (people, audit, reports, funding, settings, packages, invoices) live in tables.ts.

import { mockTable } from '../mock-db';
import { pillars } from '../../mock/data';
import { programmeStatus } from '../../mock/internal';
import type { PillarId } from '../../types';

export interface ProgrammeRecord {
  id: string;
  pillarId: PillarId;
  name: string;
  active: boolean;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const adminDb = {
  /** Programmes under each pillar. Inactive ones are hidden from learners and course authors. */
  programmes: mockTable<ProgrammeRecord[]>('admin.programmes', () =>
    pillars.flatMap(p => p.programs.map(name => ({ id: `pg-${slug(name)}`, pillarId: p.id, name, active: programmeStatus[name] ?? true })))),

  /** Eligibility rules that sit next to settings.minimumAge */
  eligibility: mockTable('admin.eligibility', () => ({ youthMaxAge: 35, guardianConsentUnder18: true })),

  /** Invoice sequence counter (settings holds the format, VAT and payment terms) */
  invoiceSequence: mockTable('admin.invoiceSequence', () => ({ next: 36 })),
};
