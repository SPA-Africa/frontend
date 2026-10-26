// core-svc / identity: authentication, registration, verification (SRS FR-A1, FR-C1.1, NFR-SEC.3)

import { defineEndpoint } from '../../define';
import { demoUsers } from '../../../mock/users';
import type { Role, User } from '../../../types';

export interface AuthResult {
  /** Short-lived JWT (15 min). The refresh token is set as an httpOnly cookie. */
  accessToken: string;
  user: User;
}

export interface LoginRequest { identifier: string; password: string }

export interface RegisterLearnerRequest {
  name: string;
  identifier: string; // email or phone
  password: string;
  dateOfBirth: string; // YYYY-MM-DD, minimum age enforced server-side (FR-A1.3)
  gender: 'female' | 'male' | 'prefer_not';
  country: string;
  region: string;
  pillars: string[];
  language: 'en' | 'fr' | 'rw';
  consents: { dataProcessing: boolean; aiRecommendations: boolean; news: boolean };
  /** "mentor" applications are reviewed by the Executive Office before access */
  intent?: 'learner' | 'mentor';
}

export interface RegisterOrganisationRequest {
  legalName: string;
  registrationNumber?: string;
  country: string;
  region: string;
  sector: string;
  staffSize: string;
  contact: { name: string; email: string; phone: string };
}

export interface VerificationPending { verificationId: string; channel: 'email' | 'sms'; destination: string }

const token = (u: User) => `mock.${u.role}.${u.id}`;
const demo = (role: Role): AuthResult => ({ accessToken: token(demoUsers[role]), user: demoUsers[role] });

export const login = defineEndpoint<AuthResult, { body: LoginRequest }>({
  id: 'identity.auth.login', service: 'core', method: 'POST', path: '/auth/login',
  roles: ['public'], summary: 'Sign in with email or phone and password', srs: ['FR-A1.1', 'NFR-SEC.2', 'NFR-SEC.7'],
  request: 'LoginRequest', response: 'AuthResult',
  notes: 'Rate limit 5 attempts per 15 minutes per IP. Sets the refresh token cookie (httpOnly, Secure, SameSite=Lax).',
}, () => demo('beneficiary'));

export const loginWithGoogle = defineEndpoint<AuthResult, { body: { idToken: string } }>({
  id: 'identity.auth.google', service: 'core', method: 'POST', path: '/auth/oauth/google',
  roles: ['public'], summary: 'Sign in or sign up with a Google ID token', srs: ['FR-A1.1'],
  request: '{ idToken: string }', response: 'AuthResult',
}, () => demo('beneficiary'));

export const refresh = defineEndpoint<{ accessToken: string }>({
  id: 'identity.auth.refresh', service: 'core', method: 'POST', path: '/auth/refresh',
  roles: ['public'], summary: 'Exchange the refresh cookie for a new access token', srs: ['NFR-SEC.3'],
  response: '{ accessToken: string }', notes: 'Called automatically by lib/api/http.ts on any 401. Rotate the refresh token on every call.',
}, () => ({ accessToken: 'mock.refreshed' }));

export const logout = defineEndpoint<void>({
  id: 'identity.auth.logout', service: 'core', method: 'POST', path: '/auth/logout',
  roles: ['authenticated'], summary: 'Revoke the refresh token and clear the cookie', srs: ['NFR-SEC.3'], response: 'void',
}, () => undefined);

export const me = defineEndpoint<User>({
  id: 'identity.auth.me', service: 'core', method: 'GET', path: '/auth/me',
  roles: ['authenticated'], summary: 'The signed-in user with role, pillar and organisation', srs: ['FR-B1.1', 'FR-B1.2'], response: 'User',
}, ({ user, fail }) => user ?? fail(401, 'unauthenticated', 'Please sign in'));

export const registerLearner = defineEndpoint<VerificationPending, { body: RegisterLearnerRequest }>({
  id: 'identity.register.learner', service: 'core', method: 'POST', path: '/auth/register',
  roles: ['public'], summary: 'Create a learner (beneficiary) account and send a verification code',
  srs: ['FR-A1.1', 'FR-A1.2', 'FR-A1.3', 'FR-A1.6', 'FR-A1.7', 'NFR-COMPLY.2'],
  request: 'RegisterLearnerRequest', response: 'VerificationPending', offline: true, emits: ['user.registered'],
  notes: 'Reject under the configured minimum age (default 15) with code "under_minimum_age". Store gender and youth_status for M&E (FR-A1.6).',
}, ({ args }) => ({ verificationId: 'ver-demo', channel: args.body.identifier.includes('@') ? 'email' : 'sms', destination: args.body.identifier }));

export const registerOrganisation = defineEndpoint<VerificationPending, { body: RegisterOrganisationRequest }>({
  id: 'identity.register.organisation', service: 'core', method: 'POST', path: '/orgs/register',
  roles: ['public'], summary: 'Create an organisation client account and its first admin user', srs: ['FR-C1.1', 'FR-C1.2'],
  request: 'RegisterOrganisationRequest', response: 'VerificationPending', emits: ['organisation.registered'],
}, ({ args }) => ({ verificationId: 'ver-org-demo', channel: 'email', destination: args.body.contact.email }));

export const verify = defineEndpoint<AuthResult, { body: { verificationId: string; code: string } }>({
  id: 'identity.verify', service: 'core', method: 'POST', path: '/auth/verify',
  roles: ['public'], summary: 'Confirm the 6-digit email or SMS code and sign in', srs: ['FR-A1.7'],
  request: '{ verificationId: string; code: string }', response: 'AuthResult',
}, ({ args }) => demo(args.body.verificationId.startsWith('ver-org') ? 'org_client' : 'beneficiary'));

/** Mock mode only: sign in as one of the demo accounts. Not part of the real API. */
export const demoSignIn = (role: Role): AuthResult => demo(role);
