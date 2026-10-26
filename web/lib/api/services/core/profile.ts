// core-svc / profile: learner profile, preferences, consent and data rights (SRS FR-A1.5, FR-A1.6, NFR-COMPLY.1 to NFR-COMPLY.3)

import { defineEndpoint } from '../../define';
import { nowIso } from '../../mock-db';
import { learnerDb, profileFor, type Language, type LearnerConsents, type StoredProfile } from '../../mock/learner-tables';
import type { PillarId } from '../../../types';

export type { Language, LearnerConsents };

export interface LearnerProfile {
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  bio: string;
  gender: 'female' | 'male' | 'prefer_not';
  birthYear: number;
  pillars: PillarId[];
  language: Language;
  /** smaller images, 360p video, no autoplay */
  dataSaver: boolean;
  consents: LearnerConsents;
  deletionRequest: DeletionRequest | null;
  exportRequestedAt: string | null;
}

export type ProfileUpdate = Partial<Pick<LearnerProfile, 'name' | 'email' | 'phone' | 'country' | 'city' | 'bio' | 'gender' | 'pillars' | 'language' | 'dataSaver'>>;

export interface DeletionRequest {
  requestedAt: string;
  /** the account is erased on this date unless the request is cancelled */
  dueBy: string;
  reason: string | null;
}

const DELETION_SLA_DAYS = 30;
const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 864e5).toISOString();

const toProfile = (p: StoredProfile): LearnerProfile => ({
  name: p.name, email: p.email, phone: p.phone, country: p.country, city: p.city, bio: p.bio, gender: p.gender, birthYear: p.birthYear,
  pillars: p.pillars, language: p.language, dataSaver: p.dataSaver, consents: p.consents,
  deletionRequest: p.deletionRequestedAt ? { requestedAt: p.deletionRequestedAt, dueBy: addDays(p.deletionRequestedAt, DELETION_SLA_DAYS), reason: p.deletionReason } : null,
  exportRequestedAt: p.exportRequestedAt,
});

type Ctx = { user: { id: string; name: string; email: string; country?: string } | null; fail: (s: number, c: string, m: string) => never };
const mine = ({ user, fail }: Ctx) => (user ? profileFor(user) : fail(401, 'unauthenticated', 'Please sign in'));
const save = (userId: string, fn: (p: StoredProfile) => void) => learnerDb.profiles.update(d => { fn(d[userId]); })[userId];

export const get = defineEndpoint<LearnerProfile>({
  id: 'profile.me.get', service: 'core', method: 'GET', path: '/profile/me',
  roles: ['beneficiary'], summary: 'The learner’s profile, preferences and consent choices', srs: ['FR-A1.5', 'NFR-COMPLY.2'], response: 'LearnerProfile',
}, ctx => toProfile(mine(ctx)));

export const update = defineEndpoint<LearnerProfile, { body: ProfileUpdate }>({
  id: 'profile.me.update', service: 'core', method: 'PATCH', path: '/profile/me',
  roles: ['beneficiary'], summary: 'Update profile details, pillars of interest, language or data saver', srs: ['FR-A1.5', 'NFR-UX.1', 'NFR-BW.3'],
  request: 'ProfileUpdate', response: 'LearnerProfile', offline: true, emits: ['profile.updated'],
  notes: 'Changing the email or phone sends a new verification code before it takes effect. 400 "invalid_name" for an empty name.',
}, ctx => {
  const p = mine(ctx);
  const b = ctx.args.body;
  if (b.name !== undefined && !b.name.trim()) ctx.fail(400, 'invalid_name', 'Please enter your name');
  return toProfile(save(p.userId, d => { Object.assign(d, b, b.name ? { name: b.name.trim() } : {}); }));
});

export const updateConsents = defineEndpoint<LearnerConsents, { body: Partial<LearnerConsents> }>({
  id: 'profile.consents.update', service: 'core', method: 'PUT', path: '/profile/me/consents',
  roles: ['beneficiary'], summary: 'Change consent choices; each change is timestamped for audit', srs: ['NFR-COMPLY.2', 'FR-A2.15'],
  request: 'Partial<LearnerConsents>', response: 'LearnerConsents', emits: ['consent.updated'],
  notes: 'dataProcessing cannot be withdrawn here (400 "consent_required"); the learner asks for deletion instead. Turning off aiRecommendations empties GET /api/ai/recommendations/courses.',
}, ctx => {
  const p = mine(ctx);
  if (ctx.args.body.dataProcessing === false) ctx.fail(400, 'consent_required', 'Data processing is needed to keep an account. Request deletion instead.');
  return save(p.userId, d => { d.consents = { ...d.consents, ...ctx.args.body, dataProcessing: true }; }).consents;
});

export const requestDeletion = defineEndpoint<DeletionRequest, { body: { reason?: string } }>({
  id: 'profile.deletion.request', service: 'core', method: 'POST', path: '/profile/me/deletion-request',
  roles: ['beneficiary'], summary: 'Ask for the account and personal data to be deleted', srs: ['NFR-COMPLY.1', 'NFR-COMPLY.3'],
  request: '{ reason?: string }', response: 'DeletionRequest', emits: ['account.deletion_requested'],
  notes: 'Erase within the configured window (default 30 days). Issued certificates stay verifiable unless revocation is asked for. Idempotent.',
}, ctx => {
  const p = mine(ctx);
  const at = p.deletionRequestedAt ?? nowIso();
  const s = save(p.userId, d => { d.deletionRequestedAt = at; d.deletionReason = ctx.args.body.reason?.trim() || null; });
  return { requestedAt: at, dueBy: addDays(at, DELETION_SLA_DAYS), reason: s.deletionReason };
});

export const cancelDeletion = defineEndpoint<void>({
  id: 'profile.deletion.cancel', service: 'core', method: 'DELETE', path: '/profile/me/deletion-request',
  roles: ['beneficiary'], summary: 'Cancel a pending deletion request', srs: ['NFR-COMPLY.3'], response: 'void', emits: ['account.deletion_cancelled'],
}, ctx => { const p = mine(ctx); save(p.userId, d => { d.deletionRequestedAt = null; d.deletionReason = null; }); });

export const requestExport = defineEndpoint<{ requestedAt: string; dueBy: string }>({
  id: 'profile.export.request', service: 'core', method: 'POST', path: '/profile/me/data-export',
  roles: ['beneficiary'], summary: 'Ask for a copy of all personal data', srs: ['NFR-COMPLY.1'], response: '{ requestedAt: string; dueBy: string }',
  emits: ['account.export_requested'], notes: 'Email a download link (signed, 7 days) within 30 days.',
}, ctx => {
  const p = mine(ctx);
  const at = nowIso();
  save(p.userId, d => { d.exportRequestedAt = at; });
  return { requestedAt: at, dueBy: addDays(at, DELETION_SLA_DAYS) };
});
