// core-svc / capacity: coaching catalogue, packages, bookings, invoices, organisation profile (SRS module C)
//
// Scope rule for the backend: every endpoint used by an organisation client (role org_client) must be
// limited to the caller's own organisation (user.orgId), enforced with Postgres row-level security on
// bookings, invoices, assessments, organisations and organisation users. A booking or invoice id from
// another organisation returns 404, never 403, so ids cannot be probed.

import { defineEndpoint, paginate, type MockContext, type CallArgs, type Page } from '../../define';
import { db } from '../../mock/tables';
import { mockId, nowIso } from '../../mock-db';
import { orgDb, type BookingMeta, type OrgProfile, type OrgUser, type OrgUserRole, type Questionnaire } from '../../mock/org-tables';
import type { Booking, BookingStatus, CatalogueTopic, Invoice, InvoiceStatus, ServicePackage } from '../../../types';

export type { AreaId, AssessmentArea, AssessmentQuestion, Questionnaire, ScalePoint, OrgProfile, OrgUser, OrgUserRole } from '../../mock/org-tables';

/* ---------- types ---------- */

export type DeliveryMode = Booking['mode'];

export type CatalogueQuery = { kind?: CatalogueTopic["kind"]; mode?: DeliveryMode; language?: string };

export interface PackageView extends ServicePackage {
  /** Most topics one booking on this package may cover; null means no limit */
  maxTopics: number | null;
}

export interface CapacitySettings {
  currency: 'RWF';
  /** VAT applied to every invoice, from the platform settings (default 0.18) */
  vatRate: number;
  /** Days between issue and due date on new invoices */
  paymentTermsDays: number;
  travelFee: {
    amount: number;
    /** Applies to in-person and hybrid delivery */
    modes: DeliveryMode[];
    /** No fee when the location matches one of these */
    exemptLocations: string[];
  };
}

export interface BookingRequest {
  topicIds: string[];
  packageId: string;
  start: string; // YYYY-MM-DD
  end?: string; // YYYY-MM-DD, empty for a single day
  participants: number;
  mode: DeliveryMode;
  location: string;
  notes?: string;
  /** Optional reason when the organisation changes the assessment recommendation (FR-C3.4) */
  overrideReason?: string;
}

export type EstimateRequest = Pick<BookingRequest, 'topicIds' | 'packageId' | 'mode' | 'location'>;

export interface InvoiceLine { description: string; qty: number; unitPrice: number }

export interface BookingEstimate {
  currency: 'RWF';
  /** True for Custom packages: no price yet, the team sends a quote */
  quoted: boolean;
  lines: InvoiceLine[];
  subtotal: number;
  vatRate: number;
  tax: number;
  total: number;
}

export interface BookingView extends Booking {
  start: string;
  end?: string;
  topicTitles: string[];
  packageName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceStatus?: InvoiceStatus;
  notes?: string;
  overrideReason?: string;
  recommended?: { topicIds: string[]; packageId: string };
  rescheduleRequest?: BookingMeta['rescheduleRequest'];
}

export interface InvoiceTotals { subtotal: number; tax: number; total: number; paid: number; balance: number }

export interface InvoiceRow extends Invoice { totals: InvoiceTotals }

export interface InvoiceDetail {
  invoice: InvoiceRow;
  billedTo: OrgProfile;
  booking: BookingView | null;
}

export interface CreateBookingResult { booking: BookingView; invoice: InvoiceRow | null }

export interface RescheduleRequest { start: string; end?: string; reason: string }

export interface OrgSummary {
  billed: number;
  paid: number;
  outstanding: number;
  overdueCount: number;
  pendingBookings: number;
  upcomingBookings: number;
  nextEngagement: BookingView | null;
}

export type OrgProfileUpdate = Omit<OrgProfile, 'id'>;
export interface InviteOrgUserRequest { name: string; email: string; role: Exclude<OrgUserRole, 'owner'> }

/* ---------- mock helpers ---------- */

const today = () => new Date().toISOString().slice(0, 10);

const maxTopicsFor = (p: ServicePackage): number | null => (p.name === 'Standard' ? 1 : p.name === 'Advanced' ? 3 : null);

const orgOf = <A extends CallArgs>(ctx: MockContext<A>): string =>
  ctx.user?.orgId ?? ctx.fail(403, 'no_organisation', 'Your account is not linked to an organisation');

const totalsOf = (inv: Invoice): InvoiceTotals => {
  const subtotal = inv.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const tax = Math.round(subtotal * inv.taxRate);
  return { subtotal, tax, total: subtotal + tax, paid: inv.paid, balance: subtotal + tax - inv.paid };
};
const toRow = (inv: Invoice): InvoiceRow => ({ ...inv, totals: totalsOf(inv) });

const settingsNow = (): CapacitySettings => {
  const s = db.settings.get();
  const fee = orgDb.feeRules.get();
  return {
    currency: 'RWF', vatRate: s.vatRate, paymentTermsDays: s.paymentTermsDays,
    travelFee: { amount: fee.travelFee, modes: ['In-person', 'Hybrid'], exemptLocations: fee.travelFeeExemptLocations },
  };
};

const topicTitle = (id: string) => db.catalogue.get().find(t => t.id === id)?.title ?? id;

const fmtWindow = (a: string, b?: string) => {
  const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const da = new Date(a + 'T00:00:00');
  if (!b || a === b) return da.toLocaleDateString('en-GB', o);
  const dbb = new Date(b + 'T00:00:00');
  return `${da.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${dbb.toLocaleDateString('en-GB', o)}`;
};

const viewOf = (b: Booking): BookingView => {
  const m = orgDb.bookingMeta.get()[b.id];
  const inv = m?.invoiceId ? db.invoices.get().find(i => i.id === m.invoiceId) : undefined;
  return {
    ...b,
    start: m?.start ?? b.createdAt,
    end: m?.end,
    topicTitles: b.topics.map(topicTitle),
    packageName: db.packages.get().find(p => p.id === b.packageId)?.name ?? b.packageId,
    invoiceId: inv?.id,
    invoiceNumber: inv?.number,
    invoiceStatus: inv?.status,
    notes: m?.notes,
    overrideReason: m?.reason,
    recommended: m?.recommended,
    rescheduleRequest: m?.rescheduleRequest,
  };
};

const myBookings = (orgId: string) => {
  const meta = orgDb.bookingMeta.get();
  return db.bookings.get().filter(b => meta[b.id]?.orgId === orgId);
};

const myInvoices = (orgId: string) => {
  const meta = orgDb.bookingMeta.get();
  return db.invoices.get()
    .filter(i => meta[i.bookingId]?.orgId === orgId)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.number.localeCompare(a.number));
};

const findMyBooking = <A extends CallArgs>(ctx: MockContext<A>, id: string) =>
  myBookings(orgOf(ctx)).find(b => b.id === id) ?? ctx.fail(404, 'not_found', 'Booking not found');

/** Pricing rules shared by estimate and create, so the server stays the source of truth. */
function price<A extends CallArgs>(ctx: MockContext<A>, r: EstimateRequest): BookingEstimate {
  const s = settingsNow();
  const pkg = db.packages.get().find(p => p.id === r.packageId) ?? ctx.fail(400, 'unknown_package', 'Choose a package');
  const published = db.catalogue.get().filter(t => t.status === 'published');
  const topics = r.topicIds.map(id => published.find(t => t.id === id) ?? ctx.fail(400, 'unknown_topic', `Topic ${id} is not available`));
  const max = maxTopicsFor(pkg);
  if (max !== null && topics.length > max) ctx.fail(400, 'too_many_topics', `The ${pkg.name} package covers up to ${max} topics`);
  if (pkg.price === null) return { currency: 'RWF', quoted: true, lines: [], subtotal: 0, vatRate: s.vatRate, tax: 0, total: 0 };

  const lines: InvoiceLine[] = [{ description: `${pkg.name} package: ${topics.map(t => t.title).join(' + ') || 'topic to be chosen'}`, qty: 1, unitPrice: pkg.price }];
  const loc = r.location.trim();
  const exempt = s.travelFee.exemptLocations.some(x => x.toLowerCase() === loc.toLowerCase());
  if (s.travelFee.modes.includes(r.mode) && loc && !exempt) lines.push({ description: `Travel to venue (${loc})`, qty: 1, unitPrice: s.travelFee.amount });
  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const tax = Math.round(subtotal * s.vatRate);
  return { currency: 'RWF', quoted: false, lines, subtotal, vatRate: s.vatRate, tax, total: subtotal + tax };
}

/* ---------- public catalogue (FR-C2) ---------- */

export const listCatalogue = defineEndpoint<CatalogueTopic[], { query?: CatalogueQuery }>({
  id: 'capacity.catalogue.list', service: 'core', method: 'GET', path: '/capacity/catalogue',
  roles: ['public'], summary: 'Published coaching and training topics, with optional filters',
  srs: ['FR-C2.1', 'FR-C2.2'], response: 'CatalogueTopic[]',
  query: ['kind?: Capacity Building | Leadership Training | Coaching', 'mode?: In-person | Virtual | Hybrid', 'language?: string'],
  notes: 'Only topics with status "published". Draft and retired topics are managed through capacityAdmin.',
}, ({ args }) => {
  const q = args.query ?? {};
  return db.catalogue.get()
    .filter(t => t.status === 'published')
    .filter(t => (!q.kind || t.kind === q.kind) && (!q.mode || t.modes.includes(q.mode)) && (!q.language || t.languages.includes(q.language)))
    .map(({ status: _s, ...t }) => t);
});

export const getTopic = defineEndpoint<CatalogueTopic, { params: { id: string } }>({
  id: 'capacity.catalogue.get', service: 'core', method: 'GET', path: '/capacity/catalogue/:id',
  roles: ['public'], summary: 'One published topic with outcomes, audience, length, modes and languages',
  srs: ['FR-C2.2'], response: 'CatalogueTopic', notes: '404 for unpublished topics.',
}, ({ args, fail }) => {
  const t = db.catalogue.get().find(x => x.id === args.params.id && x.status === 'published') ?? fail(404, 'not_found', 'Topic not found');
  const { status: _s, ...rest } = t;
  return rest;
});

export const listPackages = defineEndpoint<PackageView[]>({
  id: 'capacity.packages.list', service: 'core', method: 'GET', path: '/capacity/packages',
  roles: ['public'], summary: 'Service packages with price, size, length, inclusions and topic limit',
  srs: ['FR-C2.4'], response: 'PackageView[]', notes: 'price is null for Custom (quoted). maxTopics null means no limit.',
}, () => db.packages.get().map(p => ({ ...p, maxTopics: maxTopicsFor(p) })));

export const getSettings = defineEndpoint<CapacitySettings>({
  id: 'capacity.settings.get', service: 'core', method: 'GET', path: '/capacity/settings',
  roles: ['public'], summary: 'Pricing settings used for estimates: VAT rate, travel fee rule, payment terms',
  srs: ['FR-C4.3', 'FR-C4.6'], response: 'CapacitySettings',
  notes: 'All values are configurable by the Executive Office. Defaults: VAT 0.18, payment terms 30 days, travel fee RWF 150,000 for in-person or hybrid delivery outside Kigali.',
}, () => settingsNow());

/* ---------- assessment questionnaire (served by core so it can be configured, FR-C3.1) ---------- */

export const getQuestionnaire = defineEndpoint<Questionnaire>({
  id: 'capacity.assessment.questionnaire', service: 'core', method: 'GET', path: '/capacity/assessment/questionnaire',
  roles: ['org_client'], summary: 'The active needs assessment: areas with weights, questions with weights, answer scale',
  srs: ['FR-C3.1'], response: 'Questionnaire',
  notes: 'Versioned. ai-svc scores against the version the client submits. Seed: 10 questions across 7 areas, area weights sum to 1.',
}, () => orgDb.questionnaire.get());

/* ---------- bookings (FR-C4) ---------- */

export const estimate = defineEndpoint<BookingEstimate, { body: EstimateRequest }>({
  id: 'capacity.bookings.estimate', service: 'core', method: 'POST', path: '/capacity/bookings/estimate',
  roles: ['org_client'], summary: 'Itemised estimate for a draft booking, priced by the server',
  srs: ['FR-C4.3'], request: 'EstimateRequest', response: 'BookingEstimate',
  notes: 'No side effects. Same pricing code as booking create. Validates topics are published and within the package topic limit.',
}, ctx => price(ctx, ctx.args.body));

export const createBooking = defineEndpoint<CreateBookingResult, { body: BookingRequest }>({
  id: 'capacity.bookings.create', service: 'core', method: 'POST', path: '/capacity/bookings',
  roles: ['org_client'], summary: 'Create a booking (status pending) and issue its invoice',
  srs: ['FR-C4.1', 'FR-C4.2', 'FR-C4.3', 'FR-C4.4', 'FR-C3.4', 'FR-C4.6'], request: 'BookingRequest', response: 'CreateBookingResult',
  emits: ['booking.created', 'invoice.issued'], offline: true,
  notes: 'Recompute the price server side (ignore any client totals). Validate start >= today, end >= start, participants >= 1, location required unless Virtual, every topic supports the mode. Custom packages create the booking with no invoice (quote follows) and do not emit invoice.issued. Store the latest assessment recommendation and the optional override reason with the booking.',
}, ctx => {
  const orgId = orgOf(ctx);
  const r = ctx.args.body;
  if (!r.topicIds.length) ctx.fail(400, 'no_topics', 'Choose at least one topic');
  if (!r.start || r.start < today()) ctx.fail(400, 'invalid_start', 'The start date must be today or later');
  if (r.end && r.end < r.start) ctx.fail(400, 'invalid_end', 'The end date must be after the start date');
  if (!Number.isFinite(r.participants) || r.participants < 1) ctx.fail(400, 'invalid_participants', 'Add at least one participant');
  if (r.mode !== 'Virtual' && !r.location.trim()) ctx.fail(400, 'location_required', 'Tell us where to deliver the training');
  const topics = db.catalogue.get().filter(t => r.topicIds.includes(t.id));
  if (topics.some(t => !t.modes.includes(r.mode))) ctx.fail(400, 'mode_unavailable', `${r.mode} delivery is not available for every topic you chose`);
  const est = price(ctx, r);

  const s = settingsNow();
  const n = Math.max(104, ...db.bookings.get().map(b => Number(b.id.replace(/\D/g, '')) || 0)) + 1;
  const booking: Booking = {
    id: `bk-${n}`, topics: r.topicIds, packageId: r.packageId, window: fmtWindow(r.start, r.end), participants: r.participants,
    mode: r.mode, location: r.mode === 'Virtual' ? 'Online' : r.location.trim(), status: 'pending', createdAt: today(),
  };

  let invoice: Invoice | null = null;
  if (!est.quoted) {
    const year = new Date().getFullYear();
    const seq = Math.max(0, ...db.invoices.get().map(i => Number(i.number.split('-').pop()) || 0)) + 1;
    const due = new Date(); due.setDate(due.getDate() + s.paymentTermsDays);
    invoice = {
      id: mockId('inv'), number: db.settings.get().invoiceNumberFormat.replace('{YEAR}', String(year)).replace('{SEQ}', String(seq).padStart(4, '0')),
      bookingId: booking.id, issuedAt: today(), dueAt: due.toISOString().slice(0, 10), currency: 'RWF',
      lines: est.lines, taxRate: est.vatRate, paid: 0, status: 'issued',
    };
  }

  const latest = orgDb.assessments.get().filter(a => a.orgId === orgId).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
  db.bookings.update(list => { list.unshift(booking); });
  if (invoice) db.invoices.update(list => { list.unshift(invoice!); });
  orgDb.bookingMeta.update(m => {
    m[booking.id] = {
      orgId, start: r.start, end: r.end || undefined, notes: r.notes?.trim() || undefined, reason: r.overrideReason?.trim() || undefined,
      invoiceId: invoice?.id, recommended: latest ? { topicIds: latest.topicIds, packageId: latest.packageId } : undefined,
    };
  });
  return { booking: viewOf(booking), invoice: invoice ? toRow(invoice) : null };
});

export const listBookings = defineEndpoint<BookingView[], { query?: { status?: BookingStatus } }>({
  id: 'capacity.bookings.list', service: 'core', method: 'GET', path: '/capacity/bookings',
  roles: ['org_client'], summary: "The organisation's bookings, newest first", srs: ['FR-C4.5'],
  response: 'BookingView[]', query: ['status?: BookingStatus'],
  notes: 'RLS: only bookings of the caller organisation.',
}, ctx => myBookings(orgOf(ctx))
  .filter(b => !ctx.args.query?.status || b.status === ctx.args.query.status)
  .map(viewOf)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

export const getBooking = defineEndpoint<BookingView, { params: { id: string } }>({
  id: 'capacity.bookings.get', service: 'core', method: 'GET', path: '/capacity/bookings/:id',
  roles: ['org_client'], summary: 'One booking with its invoice reference and notes', srs: ['FR-C4.5'],
  response: 'BookingView', notes: '404 when the booking belongs to another organisation.',
}, ctx => viewOf(findMyBooking(ctx, ctx.args.params.id)));

export const cancelBooking = defineEndpoint<BookingView, { params: { id: string }; body?: { reason?: string } }>({
  id: 'capacity.bookings.cancel', service: 'core', method: 'POST', path: '/capacity/bookings/:id/cancel',
  roles: ['org_client'], summary: 'Cancel a booking that is still pending', srs: ['FR-C4.6'],
  request: '{ reason?: string }', response: 'BookingView', emits: ['booking.cancelled'], offline: true,
  notes: 'Only from status pending, otherwise 409 "not_cancellable". The Executive Office then cancels or credits the linked invoice.',
}, ctx => {
  const b = findMyBooking(ctx, ctx.args.params.id);
  if (b.status !== 'pending') ctx.fail(409, 'not_cancellable', 'Only pending bookings can be cancelled. Contact our team to change a confirmed booking.');
  db.bookings.update(list => { const x = list.find(y => y.id === b.id); if (x) x.status = 'cancelled'; });
  return viewOf({ ...b, status: 'cancelled' });
});

export const requestReschedule = defineEndpoint<BookingView, { params: { id: string }; body: RescheduleRequest }>({
  id: 'capacity.bookings.reschedule', service: 'core', method: 'POST', path: '/capacity/bookings/:id/reschedule-requests',
  roles: ['org_client'], summary: 'Ask for new dates on a pending or confirmed booking', srs: ['FR-C4.6'],
  request: 'RescheduleRequest', response: 'BookingView', emits: ['booking.reschedule_requested'], offline: true,
  notes: 'Creates a request only. The Executive Office accepts it, which sets status rescheduled and updates the window. One open request per booking.',
}, ctx => {
  const b = findMyBooking(ctx, ctx.args.params.id);
  const r = ctx.args.body;
  if (!['pending', 'confirmed', 'rescheduled'].includes(b.status)) ctx.fail(409, 'not_reschedulable', 'This booking can no longer be moved');
  if (!r.start || r.start < today()) ctx.fail(400, 'invalid_start', 'The new start date must be today or later');
  if (r.end && r.end < r.start) ctx.fail(400, 'invalid_end', 'The end date must be after the start date');
  if (!r.reason.trim()) ctx.fail(400, 'reason_required', 'Tell us why you need new dates');
  orgDb.bookingMeta.update(m => { m[b.id] = { ...m[b.id], rescheduleRequest: { start: r.start, end: r.end || undefined, reason: r.reason.trim(), requestedAt: nowIso() } }; });
  return viewOf(b);
});

/* ---------- invoices (FR-C4) ---------- */

export const listInvoices = defineEndpoint<Page<InvoiceRow>, { query?: { status?: InvoiceStatus; page?: number; pageSize?: number } }>({
  id: 'capacity.invoices.list', service: 'core', method: 'GET', path: '/capacity/invoices',
  roles: ['org_client'], summary: "The organisation's invoices with totals and balance, newest first", srs: ['FR-C4.7'],
  response: 'Page<InvoiceRow>', paginated: true, query: ['status?: InvoiceStatus', 'page?: number', 'pageSize?: number (default 20)'],
  notes: 'RLS: only invoices whose booking belongs to the caller organisation. Totals computed server side.',
}, ctx => paginate(myInvoices(orgOf(ctx)).filter(i => !ctx.args.query?.status || i.status === ctx.args.query.status).map(toRow), ctx.args.query));

export const getInvoice = defineEndpoint<InvoiceDetail, { params: { id: string } }>({
  id: 'capacity.invoices.get', service: 'core', method: 'GET', path: '/capacity/invoices/:id',
  roles: ['org_client'], summary: 'One invoice with lines, totals, billing details and its booking', srs: ['FR-C4.7', 'FR-C4.3'],
  response: 'InvoiceDetail', notes: 'billedTo is the organisation profile snapshot at issue time. 404 for other organisations.',
}, ctx => {
  const orgId = orgOf(ctx);
  const inv = myInvoices(orgId).find(i => i.id === ctx.args.params.id) ?? ctx.fail(404, 'not_found', 'Invoice not found');
  const b = db.bookings.get().find(x => x.id === inv.bookingId);
  const org = orgDb.orgs.get().find(o => o.id === orgId) ?? ctx.fail(404, 'not_found', 'Organisation not found');
  return { invoice: toRow(inv), billedTo: org, booking: b ? viewOf(b) : null };
});

export const getInvoicePdf = defineEndpoint<{ url: string; expiresAt: string }, { params: { id: string } }>({
  id: 'capacity.invoices.pdf', service: 'core', method: 'GET', path: '/capacity/invoices/:id/pdf',
  roles: ['org_client'], summary: 'Short-lived download link for the invoice PDF', srs: ['FR-C4.3'],
  response: '{ url: string; expiresAt: string }',
  notes: 'Return a MinIO pre-signed GET URL (5 minute expiry). Render the PDF on invoice.issued and cache it in MinIO. Mock mode returns the printable page.',
}, ctx => {
  const inv = myInvoices(orgOf(ctx)).find(i => i.id === ctx.args.params.id) ?? ctx.fail(404, 'not_found', 'Invoice not found');
  return { url: `/org/invoices/${inv.id}?print=1`, expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
});

/* ---------- organisation dashboard summary ---------- */

export const getSummary = defineEndpoint<OrgSummary>({
  id: 'capacity.orgs.summary', service: 'core', method: 'GET', path: '/orgs/me/summary',
  roles: ['org_client'], summary: 'Totals for the organisation home: billed, paid, outstanding, bookings and next engagement',
  srs: ['FR-C4.5', 'FR-C4.7'], response: 'OrgSummary',
  notes: 'Excludes draft, cancelled and written-off invoices from billed totals. Next engagement is the soonest confirmed or rescheduled booking starting today or later.',
}, ctx => {
  const orgId = orgOf(ctx);
  const open = myInvoices(orgId).filter(i => !['draft', 'cancelled', 'written_off'].includes(i.status));
  const billed = open.reduce((s, i) => s + totalsOf(i).total, 0);
  const paid = open.reduce((s, i) => s + i.paid, 0);
  const views = myBookings(orgId).map(viewOf);
  const upcoming = views.filter(b => ['pending', 'confirmed', 'rescheduled'].includes(b.status) && b.start >= today());
  const next = upcoming.filter(b => b.status !== 'pending').sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
  return {
    billed, paid, outstanding: billed - paid, overdueCount: open.filter(i => i.status === 'overdue').length,
    pendingBookings: views.filter(b => b.status === 'pending').length, upcomingBookings: upcoming.length, nextEngagement: next,
  };
});

/* ---------- organisation profile and authorised users (FR-C1) ---------- */

export const getOrganisation = defineEndpoint<OrgProfile>({
  id: 'capacity.orgs.get', service: 'core', method: 'GET', path: '/orgs/me',
  roles: ['org_client'], summary: "The signed-in user's organisation profile", srs: ['FR-C1.2'], response: 'OrgProfile',
}, ctx => {
  const orgId = orgOf(ctx);
  return orgDb.orgs.get().find(o => o.id === orgId) ?? ctx.fail(404, 'not_found', 'Organisation not found');
});

export const updateOrganisation = defineEndpoint<OrgProfile, { body: OrgProfileUpdate }>({
  id: 'capacity.orgs.update', service: 'core', method: 'PATCH', path: '/orgs/me',
  roles: ['org_client'], summary: 'Update organisation details shown on invoices', srs: ['FR-C1.2'],
  request: 'OrgProfileUpdate', response: 'OrgProfile', offline: true, emits: ['organisation.updated'],
  notes: 'Owner role inside the organisation only. Name and billing email required. Existing invoices keep their billing snapshot.',
}, ctx => {
  const orgId = orgOf(ctx);
  const b = ctx.args.body;
  if (!b.name.trim()) ctx.fail(400, 'name_required', 'Enter the organisation name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.billingEmail.trim())) ctx.fail(400, 'invalid_email', 'Enter a valid billing email');
  let out: OrgProfile | undefined;
  orgDb.orgs.update(list => { const i = list.findIndex(o => o.id === orgId); if (i >= 0) { list[i] = { ...b, id: orgId }; out = list[i]; } });
  return out ?? ctx.fail(404, 'not_found', 'Organisation not found');
});

export const listOrgUsers = defineEndpoint<OrgUser[]>({
  id: 'capacity.orgs.users.list', service: 'core', method: 'GET', path: '/orgs/me/users',
  roles: ['org_client'], summary: 'People authorised to book and see invoices for the organisation', srs: ['FR-C1.3'], response: 'OrgUser[]',
}, ctx => {
  const orgId = orgOf(ctx);
  return orgDb.users.get().filter(u => u.orgId === orgId);
});

export const inviteOrgUser = defineEndpoint<OrgUser, { body: InviteOrgUserRequest }>({
  id: 'capacity.orgs.users.invite', service: 'core', method: 'POST', path: '/orgs/me/users',
  roles: ['org_client'], summary: 'Invite a colleague by email as finance or coordinator', srs: ['FR-C1.3'],
  request: 'InviteOrgUserRequest', response: 'OrgUser', emits: ['org_user.invited'],
  notes: 'Owner only. Sends an invitation email with a one-time link (7 day expiry). 409 "already_member" when the email is already on the list.',
}, ctx => {
  const orgId = orgOf(ctx);
  const b = ctx.args.body;
  if (!b.name.trim()) ctx.fail(400, 'name_required', 'Enter a name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) ctx.fail(400, 'invalid_email', 'Enter a valid email address');
  const email = b.email.trim().toLowerCase();
  if (orgDb.users.get().some(u => u.orgId === orgId && u.email.toLowerCase() === email)) ctx.fail(409, 'already_member', 'This person is already on your list');
  const u: OrgUser = { id: mockId('ou'), orgId, name: b.name.trim(), email, role: b.role, status: 'invited', invitedAt: today() };
  orgDb.users.update(list => { list.push(u); });
  return u;
});

export const removeOrgUser = defineEndpoint<void, { params: { id: string } }>({
  id: 'capacity.orgs.users.remove', service: 'core', method: 'DELETE', path: '/orgs/me/users/:id',
  roles: ['org_client'], summary: "Remove a colleague's access to the organisation", srs: ['FR-C1.3'],
  response: 'void', emits: ['org_user.removed'],
  notes: 'Owner only. The owner and the caller cannot be removed (409). Revokes the user sessions. Past bookings and invoices are kept.',
}, ctx => {
  const orgId = orgOf(ctx);
  const u = orgDb.users.get().find(x => x.id === ctx.args.params.id && x.orgId === orgId) ?? ctx.fail(404, 'not_found', 'User not found');
  if (u.role === 'owner' || u.email === ctx.user?.email) ctx.fail(409, 'cannot_remove', 'This user cannot be removed');
  orgDb.users.update(list => list.filter(x => x.id !== u.id));
});
