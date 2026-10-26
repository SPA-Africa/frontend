// core-svc / notifications and support (SRS FR-C1.6, FR-C4.4, FR-B1.9)

import { defineEndpoint } from '../../define';
import { mockId, mockTable } from '../../mock-db';
import type { Role } from '../../../types';

export interface Notification {
  id: string;
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  read: boolean;
}

export interface SupportTicketRequest { subject: string; message: string; page: string }

const seed: Record<Role, Omit<Notification, 'id'>[]> = {
  beneficiary: [
    { title: 'Live session tomorrow', body: 'AI Foundations: Q&A with the facilitator at 18:00.', href: '/app/schedule', createdAt: '2026-10-25T09:00:00Z', read: false },
    { title: 'Pitch deadline in 3 weeks', body: 'East Africa Youth Pitch 2026 closes on 15 Nov.', href: '/app/pitch', createdAt: '2026-10-24T08:00:00Z', read: false },
    { title: 'Certificate issued', body: 'Values-Based Leadership is now in your certificates.', href: '/app/certificates', createdAt: '2026-09-30T12:00:00Z', read: true },
  ],
  org_client: [
    { title: 'Booking confirmed', body: 'BK-104, Leadership Training and Project Management, 10 to 13 Nov.', href: '/org/bookings', createdAt: '2026-10-03T10:00:00Z', read: false },
    { title: 'Invoice issued', body: 'SPA-INV-2026-0035 is due on 18 Nov.', href: '/org/invoices', createdAt: '2026-10-19T10:00:00Z', read: false },
  ],
  pillar_rep: [
    { title: 'KPI behind target', body: 'Institutions digitally transformed is at 51% of the expected level.', href: '/console/kpis', createdAt: '2026-10-24T06:00:00Z', read: false },
    { title: '6 pitch entries still being scored', body: 'Kigali Pilot Pitch Night.', href: '/console/competitions', createdAt: '2026-10-23T06:00:00Z', read: true },
  ],
  judge_mentor: [
    { title: '2 entries waiting', body: 'Kigali Pilot Pitch Night. Please score by 31 Oct.', href: '/judge', createdAt: '2026-10-22T06:00:00Z', read: false },
  ],
  executive_admin: [
    { title: '4 staff accounts awaiting approval', body: 'Pillar Representatives and Judges.', href: '/admin/approvals', createdAt: '2026-10-24T07:00:00Z', read: false },
    { title: 'Q3 report ready for review', body: 'Approve it to publish to the Board.', href: '/admin/reports', createdAt: '2026-10-20T07:00:00Z', read: false },
    { title: 'Board term ending', body: 'One trustee term ends within 6 months.', href: '/admin/users', createdAt: '2026-10-15T07:00:00Z', read: true },
  ],
  board_auditor: [
    { title: 'Q2 2026 report published', body: 'Read it in Quarterly reports.', href: '/board/reports', createdAt: '2026-07-20T07:00:00Z', read: true },
  ],
};

const table = mockTable<Record<string, Notification[]>>('notifications', () =>
  Object.fromEntries(Object.entries(seed).map(([role, list]) => [role, list.map((n, i) => ({ ...n, id: `n-${role}-${i}` }))])));

export const list = defineEndpoint<Notification[]>({
  id: 'notifications.list', service: 'core', method: 'GET', path: '/notifications',
  roles: ['authenticated'], summary: 'Latest notifications for the signed-in user, newest first', srs: ['FR-C1.6', 'FR-C4.4', 'FR-B1.9'],
  response: 'Notification[]', query: ['unread?: boolean', 'limit?: number (default 20)'],
}, ({ user }) => table.get()[user!.role] ?? []);

export const markRead = defineEndpoint<void, { body: { ids: string[] | 'all' } }>({
  id: 'notifications.markRead', service: 'core', method: 'POST', path: '/notifications/read',
  roles: ['authenticated'], summary: 'Mark some or all notifications as read', request: "{ ids: string[] | 'all' }", response: 'void',
}, ({ user, args }) => {
  table.update(t => {
    t[user!.role] = (t[user!.role] ?? []).map(n => (args.body.ids === 'all' || args.body.ids.includes(n.id) ? { ...n, read: true } : n));
  });
});

export const createSupportTicket = defineEndpoint<{ id: string }, { body: SupportTicketRequest }>({
  id: 'support.tickets.create', service: 'core', method: 'POST', path: '/support/tickets',
  roles: ['authenticated'], summary: 'Send a help request to the SPA team from inside the app', request: 'SupportTicketRequest',
  response: '{ id: string }', offline: true, emits: ['support.ticket_created'],
}, () => ({ id: mockId('tkt') }));

