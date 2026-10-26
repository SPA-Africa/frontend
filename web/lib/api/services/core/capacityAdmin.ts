// core-svc / capacity admin: coaching catalogue management for representatives and the Executive Office (SRS FR-C2.3)
//
// Writes the same `catalogue` table the public coaching page and the organisation booking flow read,
// so a published entry becomes bookable and a retired one disappears from the public list.

import { defineEndpoint } from '../../define';
import { db } from '../../mock/tables';
import { appendAudit } from '../../mock/console-tables';
import type { CatalogueStatus } from '../../../mock/internal';
import type { CatalogueTopic } from '../../../types';

export type { CatalogueStatus } from '../../../mock/internal';

export interface CatalogueEntry extends CatalogueTopic { status: CatalogueStatus }

/** Body of create and update. */
export type CatalogueEntryInput = Omit<CatalogueTopic, 'id'>;

export const CATALOGUE_KINDS: CatalogueTopic['kind'][] = ['Capacity Building', 'Leadership Training', 'Coaching'];
export const CATALOGUE_MODES: CatalogueTopic['modes'][number][] = ['In-person', 'Virtual', 'Hybrid'];
export const CATALOGUE_LANGUAGES = ['English', 'French', 'Kinyarwanda', 'Swahili'];

const ROLES = ['pillar_rep', 'executive_admin'] as const;

function validate(b: CatalogueEntryInput, fail: (s: number, c: string, m: string) => never) {
  if (!b.title?.trim() || b.title.trim().length < 3) fail(400, 'title_required', 'Give the entry a title');
  if (b.title.trim().length > 120) fail(400, 'title_too_long', 'Keep the title under 120 characters');
  if (!b.description?.trim()) fail(400, 'description_required', 'Add a description');
  if (!CATALOGUE_KINDS.includes(b.kind)) fail(400, 'invalid_kind', 'Pick a type');
  if (!b.modes?.length || b.modes.some(m => !CATALOGUE_MODES.includes(m))) fail(400, 'modes_required', 'Pick at least one delivery mode');
  if (!b.languages?.length) fail(400, 'languages_required', 'Pick at least one language');
}

const clean = (b: CatalogueEntryInput): CatalogueEntryInput => ({
  ...b, title: b.title.trim(), description: b.description.trim(), audience: b.audience.trim(), duration: b.duration.trim(),
  outcomes: b.outcomes.map(o => o.trim()).filter(Boolean),
});

function setStatus(id: string, status: CatalogueStatus, allowed: CatalogueStatus[], fail: (s: number, c: string, m: string) => never) {
  const cur = db.catalogue.get().find(t => t.id === id) ?? fail(404, 'entry_not_found', 'This catalogue entry does not exist');
  if (!allowed.includes(cur.status as CatalogueStatus)) fail(409, 'invalid_state', `Cannot change an entry from ${cur.status} to ${status}`);
  db.catalogue.update(list => { const t = list.find(x => x.id === id); if (t) t.status = status; });
  return { ...cur, status } as CatalogueEntry;
}

export const listEntries = defineEndpoint<CatalogueEntry[], { query?: { status?: CatalogueStatus; kind?: CatalogueTopic['kind'] } }>({
  id: 'capacityAdmin.catalogue.list', service: 'core', method: 'GET', path: '/capacity/admin/catalogue',
  roles: [...ROLES], summary: 'Every coaching catalogue entry, drafts and retired included',
  srs: ['FR-C2.3'], response: 'CatalogueEntry[]', query: ['status?: "published" | "draft" | "retired"', 'kind?: string'],
  notes: 'The public GET /capacity/catalogue returns published entries only.',
}, ({ args }) => db.catalogue.get()
  .filter(t => (!args.query?.status || t.status === args.query.status) && (!args.query?.kind || t.kind === args.query.kind)) as CatalogueEntry[]);

export const createEntry = defineEndpoint<CatalogueEntry, { body: CatalogueEntryInput }>({
  id: 'capacityAdmin.catalogue.create', service: 'core', method: 'POST', path: '/capacity/admin/catalogue',
  roles: [...ROLES], summary: 'Create a catalogue entry as a draft',
  srs: ['FR-C2.3'], request: 'CatalogueEntryInput', response: 'CatalogueEntry', emits: ['catalogue.created'],
  notes: 'Validation: title 3 to 120 chars, description required, kind in Capacity Building | Leadership Training | Coaching, at least one mode and one language. Always created as draft.',
}, ({ args, user, fail }) => {
  validate(args.body, fail);
  const base = args.body.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'topic';
  const ids = new Set(db.catalogue.get().map(t => t.id));
  let id = `t-${base}`, n = 2;
  while (ids.has(id)) id = `t-${base}-${n++}`;
  const entry: CatalogueEntry = { ...clean(args.body), id, status: 'draft' };
  db.catalogue.update(list => { list.unshift(entry); });
  appendAudit(user, 'Created catalogue entry', entry.title);
  return entry;
});

export const updateEntry = defineEndpoint<CatalogueEntry, { params: { id: string }; body: CatalogueEntryInput }>({
  id: 'capacityAdmin.catalogue.update', service: 'core', method: 'PUT', path: '/capacity/admin/catalogue/:id',
  roles: [...ROLES], summary: 'Edit a catalogue entry; published edits are visible to organisations straight away',
  srs: ['FR-C2.3'], request: 'CatalogueEntryInput', response: 'CatalogueEntry', emits: ['catalogue.updated'],
  notes: 'Same validation as create. Status is not changed by this route. Past bookings keep the title they were made with.',
}, ({ args, user, fail }) => {
  const cur = db.catalogue.get().find(t => t.id === args.params.id) ?? fail(404, 'entry_not_found', 'This catalogue entry does not exist');
  validate(args.body, fail);
  const entry = { ...clean(args.body), id: cur.id, status: cur.status } as CatalogueEntry;
  db.catalogue.update(list => list.map(t => (t.id === cur.id ? entry : t)));
  appendAudit(user, 'Edited catalogue entry', entry.title);
  return entry;
});

export const publishEntry = defineEndpoint<CatalogueEntry, { params: { id: string } }>({
  id: 'capacityAdmin.catalogue.publish', service: 'core', method: 'POST', path: '/capacity/admin/catalogue/:id/publish',
  roles: [...ROLES], summary: 'Publish a draft or reinstate a retired entry so organisations can book it',
  srs: ['FR-C2.3'], response: 'CatalogueEntry', emits: ['catalogue.published'], notes: '409 invalid_state when already published.',
}, ({ args, user, fail }) => {
  const e = setStatus(args.params.id, 'published', ['draft', 'retired'], fail);
  appendAudit(user, 'Published catalogue entry', e.title);
  return e;
});

export const unpublishEntry = defineEndpoint<CatalogueEntry, { params: { id: string } }>({
  id: 'capacityAdmin.catalogue.unpublish', service: 'core', method: 'POST', path: '/capacity/admin/catalogue/:id/unpublish',
  roles: [...ROLES], summary: 'Move a published entry back to draft',
  srs: ['FR-C2.3'], response: 'CatalogueEntry', emits: ['catalogue.unpublished'], notes: '409 invalid_state unless published. Pending bookings that include it stay valid.',
}, ({ args, user, fail }) => {
  const e = setStatus(args.params.id, 'draft', ['published'], fail);
  appendAudit(user, 'Unpublished catalogue entry', e.title);
  return e;
});

export const retireEntry = defineEndpoint<CatalogueEntry, { params: { id: string } }>({
  id: 'capacityAdmin.catalogue.retire', service: 'core', method: 'POST', path: '/capacity/admin/catalogue/:id/retire',
  roles: [...ROLES], summary: 'Retire an entry: removed from the public catalogue, kept on past bookings and invoices',
  srs: ['FR-C2.3'], response: 'CatalogueEntry', emits: ['catalogue.retired'], notes: '409 invalid_state when already retired. Soft state change, never a delete.',
}, ({ args, user, fail }) => {
  const e = setStatus(args.params.id, 'retired', ['published', 'draft'], fail);
  appendAudit(user, 'Retired catalogue entry', e.title);
  return e;
});
