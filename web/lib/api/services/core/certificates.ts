// core-svc / certificates: issue, list, public verification (SRS FR-A2.10 to FR-A2.13)

import { defineEndpoint } from '../../define';
import { db } from '../../mock/tables';
import type { Certificate, PillarId } from '../../../types';

export const listMine = defineEndpoint<Certificate[]>({
  id: 'certificates.mine', service: 'core', method: 'GET', path: '/certificates/me',
  roles: ['beneficiary'], summary: "The learner's certificates, newest first", srs: ['FR-A2.13'], response: 'Certificate[]',
}, ({ user }) => db.certificates.get().filter(c => c.holder === user?.name).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)));

export const getMine = defineEndpoint<Certificate, { params: { code: string } }>({
  id: 'certificates.get', service: 'core', method: 'GET', path: '/certificates/me/:code',
  roles: ['beneficiary'], summary: 'One of the learner’s certificates, for the printable page', srs: ['FR-A2.11', 'FR-A2.13'], response: 'Certificate',
  notes: '404 "certificate_not_found" when the code does not belong to the caller.',
}, ({ args, user, fail }) => {
  const code = decodeURIComponent(args.params.code).trim().toUpperCase();
  return db.certificates.get().find(c => c.code === code && c.holder === user?.name) ?? fail(404, 'certificate_not_found', 'We could not find this certificate');
});

/** What anyone can see about a certificate. Nothing else about the holder is disclosed. */
export interface CertificateVerification {
  code: string;
  status: 'valid' | 'revoked' | 'not_found';
  holder?: string;
  courseTitle?: string;
  pillarId?: PillarId;
  issuedAt?: string;
}

export const verify = defineEndpoint<CertificateVerification, { params: { code: string } }>({
  id: 'certificates.verify', service: 'core', method: 'GET', path: '/certificates/verify/:code',
  roles: ['public'], summary: 'Public check of a certificate code', srs: ['FR-A2.12', 'NFR-SEC.6'], response: 'CertificateVerification',
  notes: 'Returns only holder name, course, pillar, issue date and status. Unknown codes return status "not_found" with 200. Rate limit 30 per minute per IP.',
}, ({ args }) => {
  const code = decodeURIComponent(args.params.code).trim().toUpperCase();
  const c = db.certificates.get().find(x => x.code === code);
  if (!c) return { code, status: 'not_found' };
  return { code: c.code, status: c.status, holder: c.holder, courseTitle: c.courseTitle, pillarId: c.pillarId, issuedAt: c.issuedAt };
});
