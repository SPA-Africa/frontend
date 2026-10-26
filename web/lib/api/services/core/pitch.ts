// core-svc / pitch: Pitch Entry Sandbox for learners (SRS FR-A3.1 to FR-A3.8)
// Files go straight to MinIO with a pre-signed URL; the API only records them and runs the virus scan.

import { API_MODE } from '../../config';
import { defineEndpoint } from '../../define';
import { uploadToPresignedUrl } from '../../http';
import { mockId, nowIso } from '../../mock-db';
import { db } from '../../mock/tables';
import { learnerDb } from '../../mock/learner-tables';
import type { CompetitionCycle, PitchEntry } from '../../../types';

export type PitchFileKind = 'business_plan' | 'pitch_deck';

/** What the learner may see about their entry. "scored" is reported as "under_review" until results are published. */
export type LearnerPitchStatus = 'draft' | 'submitted' | 'under_review' | 'finalist' | 'winner' | 'not_selected';

export interface PitchCycle extends CompetitionCycle {
  /** the learner's entry in this cycle, if any */
  myEntryId: string | null;
}

export interface PitchRules {
  summaryMin: number;
  summaryMax: number;
  teamMax: number;
  files: Record<PitchFileKind, { exts: string[]; contentTypes: string[]; maxMb: number }>;
}

export interface PitchFile {
  kind: PitchFileKind;
  name: string;
  sizeMb: number;
  scan: 'pending' | 'clean' | 'infected';
  uploadId: string | null;
}

export interface LearnerPitch {
  id: string;
  /** anonymous reference shown to judges */
  code: string;
  cycleId: string;
  cycleName: string;
  closesAt: string;
  cycleOpen: boolean;
  businessName: string;
  sector: string;
  summary: string;
  fundingRequested: number;
  team: { name: string; role: string }[];
  status: LearnerPitchStatus;
  updatedAt: string;
  submittedAt: string | null;
  files: PitchFile[];
}

export interface PitchDraftUpdate {
  businessName?: string;
  sector?: string;
  summary?: string;
  fundingRequested?: number;
  team?: { name: string; role: string }[];
}

export interface UploadUrlRequest { kind: PitchFileKind; fileName: string; sizeBytes: number; contentType: string }

export interface UploadTicket {
  uploadId: string;
  method: 'PUT';
  /** pre-signed MinIO URL, valid for 15 minutes */
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface PitchReceipt {
  reference: string;
  businessName: string;
  cycleName: string;
  submittedAt: string;
  files: { kind: PitchFileKind; name: string; sizeMb: number; scan: PitchFile['scan'] }[];
}

/* ---------- mock helpers ---------- */

const SCAN_MS = 3000;
const rules = (): PitchRules => {
  const lim = db.settings.get().uploadLimitsMb;
  return {
    summaryMin: 100, summaryMax: 1500, teamMax: 5,
    files: {
      business_plan: { exts: ['pdf', 'docx'], contentTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], maxMb: lim.businessPlan },
      pitch_deck: { exts: ['pdf', 'pptx'], contentTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'], maxMb: lim.pitchDeck },
    },
  };
};

const closesAtMs = (c: CompetitionCycle) => new Date(`${c.closesAt}T23:59:59Z`).getTime();
const isOpen = (c: CompetitionCycle) => c.status === 'open' && Date.now() <= closesAtMs(c);

function scanOf(f: PitchEntry['files'][number] & { uploadId?: string }) {
  const up = learnerDb.pitchUploads.get().find(u => u.id === f.uploadId);
  if (!up?.uploadedAt) return f.scan;
  return Date.now() - new Date(up.uploadedAt).getTime() >= SCAN_MS ? 'clean' : 'pending';
}

function toLearner(p: PitchEntry): LearnerPitch {
  const cycle = db.cycles.get().find(c => c.id === p.cycleId);
  const uploads = learnerDb.pitchUploads.get();
  return {
    id: p.id, code: p.code, cycleId: p.cycleId, cycleName: cycle?.name ?? '', closesAt: cycle?.closesAt ?? '', cycleOpen: !!cycle && isOpen(cycle),
    businessName: p.businessName, sector: p.sector, summary: p.summary, fundingRequested: p.fundingRequested, team: p.team,
    status: p.status === 'scored' ? 'under_review' : p.status,
    updatedAt: p.updatedAt,
    submittedAt: learnerDb.pitchSubmittedAt.get()[p.id] ?? null,
    files: p.files.map(f => {
      const up = uploads.filter(u => u.entryId === p.id && u.kind === f.kind && u.status === 'uploaded').at(-1);
      return { kind: f.kind, name: f.name, sizeMb: f.sizeMb, uploadId: up?.id ?? null, scan: scanOf({ ...f, uploadId: up?.id }) };
    }),
  };
}

function ownEntry(id: string, fail: (s: number, c: string, m: string) => never) {
  const p = db.pitches.get().find(x => x.id === id);
  return p ?? fail(404, 'entry_not_found', 'We could not find this pitch');
}

function editableEntry(id: string, fail: (s: number, c: string, m: string) => never) {
  const p = ownEntry(id, fail);
  if (p.status !== 'draft') fail(409, 'entry_locked', 'This pitch has been submitted and can no longer change');
  const cycle = db.cycles.get().find(c => c.id === p.cycleId);
  if (!cycle || !isOpen(cycle)) fail(409, 'cycle_closed', 'This competition is no longer taking entries');
  return p;
}

const touch = (id: string, fn: (p: PitchEntry) => void) =>
  db.pitches.update(list => { const p = list.find(x => x.id === id); if (p) { fn(p); p.updatedAt = nowIso().slice(0, 10); } });

/* ---------- cycles and rules ---------- */

export const listCycles = defineEndpoint<PitchCycle[]>({
  id: 'pitch.cycles.list', service: 'core', method: 'GET', path: '/pitch/cycles',
  roles: ['beneficiary'], summary: 'Competition cycles a learner can see: open, upcoming and in judging', srs: ['FR-A3.1'], response: 'PitchCycle[]',
}, () => {
  const mine = db.pitches.get();
  return db.cycles.get()
    .filter(c => c.status !== 'published')
    .map(c => ({ ...c, myEntryId: mine.find(p => p.cycleId === c.id)?.id ?? null }))
    .sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || a.closesAt.localeCompare(b.closesAt));
});

export const getRules = defineEndpoint<PitchRules>({
  id: 'pitch.rules.get', service: 'core', method: 'GET', path: '/pitch/rules',
  roles: ['beneficiary'], summary: 'Limits for pitch entries: summary length, team size, file types and sizes', srs: ['FR-A3.3', 'FR-A3.4'],
  response: 'PitchRules', notes: 'File limits come from platform settings (default 20 MB business plan, 30 MB deck).',
}, rules);

/* ---------- entries ---------- */

export const listMine = defineEndpoint<LearnerPitch[]>({
  id: 'pitch.entries.mine', service: 'core', method: 'GET', path: '/pitch/entries/me',
  roles: ['beneficiary'], summary: "The learner's pitch entries, most recently updated first", srs: ['FR-A3.2', 'FR-A3.7'], response: 'LearnerPitch[]',
  notes: 'RLS: owner only. Never return judge identities, individual or aggregate scores.',
}, () => db.pitches.get().map(toLearner).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

export const get = defineEndpoint<LearnerPitch, { params: { id: string } }>({
  id: 'pitch.entries.get', service: 'core', method: 'GET', path: '/pitch/entries/:id',
  roles: ['beneficiary'], summary: 'One of the learner’s entries with its files and scan state', srs: ['FR-A3.2', 'FR-A3.7'], response: 'LearnerPitch',
  notes: 'RLS: owner only (404 otherwise). No scores or judge details.',
}, ({ args, fail }) => toLearner(ownEntry(args.params.id, fail)));

export const create = defineEndpoint<LearnerPitch, { body: { cycleId: string } }>({
  id: 'pitch.entries.create', service: 'core', method: 'POST', path: '/pitch/entries',
  roles: ['beneficiary'], summary: 'Start a draft entry for an open cycle', srs: ['FR-A3.2'],
  request: '{ cycleId: string }', response: 'LearnerPitch', emits: ['pitch.draft_created'],
  notes: 'One entry per learner per cycle (409 "entry_exists"). 409 "cycle_closed" when the cycle is not open. Generates the anonymous code.',
}, ({ args, user, fail }) => {
  const cycle = db.cycles.get().find(c => c.id === args.body.cycleId);
  if (!cycle || !isOpen(cycle)) fail(409, 'cycle_closed', 'This competition is not taking entries');
  if (db.pitches.get().some(p => p.cycleId === cycle!.id)) fail(409, 'entry_exists', 'You already have an entry in this competition');
  const entry: PitchEntry = {
    id: mockId('p'), code: `PITCH-${new Date().getFullYear()}-${String(400 + Math.floor(Math.random() * 600)).padStart(5, '0')}`,
    cycleId: cycle!.id, businessName: '', sector: '', summary: '', fundingRequested: 0,
    team: [{ name: user?.name ?? '', role: 'Founder' }], status: 'draft', updatedAt: nowIso().slice(0, 10), files: [],
  };
  db.pitches.update(list => { list.unshift(entry); });
  return toLearner(entry);
});

export const update = defineEndpoint<LearnerPitch, { params: { id: string }; body: PitchDraftUpdate }>({
  id: 'pitch.entries.update', service: 'core', method: 'PATCH', path: '/pitch/entries/:id',
  roles: ['beneficiary'], summary: 'Save changes to a draft entry', srs: ['FR-A3.2', 'FR-A3.3'],
  request: 'PitchDraftUpdate', response: 'LearnerPitch', offline: true,
  notes: 'Drafts only, while the cycle is open (409 "entry_locked" / "cycle_closed"). 400 "summary_too_long" over 1,500 characters, "team_too_large" over 5 people.',
}, ({ args, fail }) => {
  const p = editableEntry(args.params.id, fail);
  const b = args.body;
  const r = rules();
  if (b.summary !== undefined && b.summary.length > r.summaryMax) fail(400, 'summary_too_long', `Keep the summary under ${r.summaryMax} characters`);
  if (b.team && (b.team.length < 1 || b.team.length > r.teamMax)) fail(400, 'team_too_large', `A team has 1 to ${r.teamMax} people`);
  if (b.fundingRequested !== undefined && b.fundingRequested < 0) fail(400, 'invalid_amount', 'The amount cannot be negative');
  touch(p.id, x => {
    if (b.businessName !== undefined) x.businessName = b.businessName.trim();
    if (b.sector !== undefined) x.sector = b.sector;
    if (b.summary !== undefined) x.summary = b.summary;
    if (b.fundingRequested !== undefined) x.fundingRequested = b.fundingRequested;
    if (b.team) x.team = b.team.map(t => ({ name: t.name.trim(), role: t.role.trim() }));
  });
  return toLearner(db.pitches.get().find(x => x.id === p.id)!);
});

export const remove = defineEndpoint<void, { params: { id: string } }>({
  id: 'pitch.entries.delete', service: 'core', method: 'DELETE', path: '/pitch/entries/:id',
  roles: ['beneficiary'], summary: 'Delete a draft entry and its files', srs: ['FR-A3.2'], response: 'void',
  notes: 'Drafts only (409 "entry_locked"). Deletes the MinIO objects too.',
}, ({ args, fail }) => {
  const p = ownEntry(args.params.id, fail);
  if (p.status !== 'draft') fail(409, 'entry_locked', 'Submitted pitches cannot be deleted');
  db.pitches.update(list => list.filter(x => x.id !== p.id));
  learnerDb.pitchUploads.update(list => list.filter(u => u.entryId !== p.id));
});

/* ---------- uploads (pre-signed) ---------- */

export const requestUpload = defineEndpoint<UploadTicket, { params: { id: string }; body: UploadUrlRequest }>({
  id: 'pitch.uploads.request', service: 'core', method: 'POST', path: '/pitch/entries/:id/uploads',
  roles: ['beneficiary'], summary: 'Get a pre-signed URL to upload a business plan or pitch deck', srs: ['FR-A3.3', 'FR-A3.4', 'FR-A3.5'],
  request: 'UploadUrlRequest', response: 'UploadTicket',
  notes: 'Business plan: PDF or DOCX up to 20 MB. Pitch deck: PDF or PPTX up to 30 MB. 400 "invalid_file_type" / "file_too_large". The URL is valid for 15 minutes and bound to the declared size and content type.',
}, ({ args, fail }) => {
  const p = editableEntry(args.params.id, fail);
  const { kind, fileName, sizeBytes, contentType } = args.body;
  const rule = rules().files[kind];
  if (!rule) fail(400, 'invalid_kind', 'Unknown file kind');
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (!rule.exts.includes(ext)) fail(400, 'invalid_file_type', `Please choose a ${rule.exts.map(e => e.toUpperCase()).join(' or ')} file`);
  if (sizeBytes > rule.maxMb * 1024 * 1024) fail(400, 'file_too_large', `The limit is ${rule.maxMb} MB`);
  const uploadId = mockId('up');
  learnerDb.pitchUploads.update(list => {
    list.push({ id: uploadId, entryId: p.id, kind, name: fileName, sizeMb: Math.max(0.1, Math.round((sizeBytes / 1024 / 1024) * 10) / 10), contentType, status: 'requested', uploadedAt: null });
  });
  return {
    uploadId, method: 'PUT', url: `/media/uploads/pitch/${p.id}/${uploadId}?X-Amz-Signature=mock`,
    headers: { 'Content-Type': contentType || 'application/octet-stream' }, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
});

export const completeUpload = defineEndpoint<PitchFile, { params: { id: string; uploadId: string } }>({
  id: 'pitch.uploads.complete', service: 'core', method: 'POST', path: '/pitch/entries/:id/uploads/:uploadId/complete',
  roles: ['beneficiary'], summary: 'Confirm an upload finished; attaches the file and starts the virus scan', srs: ['FR-A3.5', 'FR-A3.6'],
  response: 'PitchFile', emits: ['pitch.file_uploaded'],
  notes: 'Verify the object exists in MinIO with the declared size. Replaces any earlier file of the same kind. Scan state starts as "pending".',
}, ({ args, fail }) => {
  const p = editableEntry(args.params.id, fail);
  const up = learnerDb.pitchUploads.get().find(u => u.id === args.params.uploadId && u.entryId === p.id);
  if (!up) return fail(404, 'upload_not_found', 'We could not find this upload');
  learnerDb.pitchUploads.update(list => { const u = list.find(x => x.id === up.id); if (u) { u.status = 'uploaded'; u.uploadedAt = nowIso(); } });
  touch(p.id, x => { x.files = [...x.files.filter(f => f.kind !== up.kind), { kind: up.kind, name: up.name, sizeMb: up.sizeMb, scan: 'pending' }]; });
  return { kind: up.kind, name: up.name, sizeMb: up.sizeMb, scan: 'pending', uploadId: up.id };
});

export const getUpload = defineEndpoint<PitchFile, { params: { id: string; uploadId: string } }>({
  id: 'pitch.uploads.get', service: 'core', method: 'GET', path: '/pitch/entries/:id/uploads/:uploadId',
  roles: ['beneficiary'], summary: 'Scan state of an uploaded file (pending, clean or infected)', srs: ['FR-A3.6'], response: 'PitchFile',
  notes: 'Polled every 2 seconds while pending. Infected files are deleted and cannot be submitted.',
}, ({ args, fail }) => {
  const up = learnerDb.pitchUploads.get().find(u => u.id === args.params.uploadId && u.entryId === args.params.id);
  if (!up || up.status !== 'uploaded') return fail(404, 'upload_not_found', 'We could not find this upload');
  const scan = Date.now() - new Date(up.uploadedAt!).getTime() >= SCAN_MS ? 'clean' : 'pending';
  if (scan === 'clean') db.pitches.update(list => { const f = list.find(x => x.id === up.entryId)?.files.find(x => x.kind === up.kind && x.name === up.name); if (f) f.scan = 'clean'; });
  return { kind: up.kind, name: up.name, sizeMb: up.sizeMb, scan, uploadId: up.id };
});

export const removeFile = defineEndpoint<LearnerPitch, { params: { id: string; kind: PitchFileKind } }>({
  id: 'pitch.files.delete', service: 'core', method: 'DELETE', path: '/pitch/entries/:id/files/:kind',
  roles: ['beneficiary'], summary: 'Remove the business plan or pitch deck from a draft', srs: ['FR-A3.3'], response: 'LearnerPitch',
}, ({ args, fail }) => {
  const p = editableEntry(args.params.id, fail);
  touch(p.id, x => { x.files = x.files.filter(f => f.kind !== args.params.kind); });
  learnerDb.pitchUploads.update(list => list.filter(u => !(u.entryId === p.id && u.kind === args.params.kind)));
  return toLearner(db.pitches.get().find(x => x.id === p.id)!);
});

/**
 * Upload a file with a ticket from requestUpload. Live mode PUTs straight to MinIO;
 * mock mode simulates the transfer so progress can be shown.
 */
export async function uploadFile(ticket: UploadTicket, file: File, onProgress?: (share: number) => void) {
  if (API_MODE === 'live') return uploadToPresignedUrl(ticket.url, file, onProgress);
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await new Promise(r => setTimeout(r, 90 + Math.min(file.size / 2e5, 160)));
    onProgress?.(i / steps);
  }
}

/* ---------- submission ---------- */

export const submit = defineEndpoint<LearnerPitch, { params: { id: string } }>({
  id: 'pitch.entries.submit', service: 'core', method: 'POST', path: '/pitch/entries/:id/submit',
  roles: ['beneficiary'], summary: 'Submit a draft; the entry is locked and sent for anonymous judging', srs: ['FR-A3.7', 'FR-A3.8', 'FR-B2.1'],
  response: 'LearnerPitch', emits: ['pitch.submitted'],
  notes: 'Rejected after the cycle closes (409 "cycle_closed"). 400 "incomplete" unless name, sector, summary (100 to 1,500 chars), amount, team names, both files present and scanned clean. Status becomes "submitted" and the entry is read-only. Judges only ever see the anonymous code.',
}, ({ args, fail }) => {
  const p = editableEntry(args.params.id, fail);
  const lp = toLearner(p);
  const r = rules();
  const ok = lp.businessName && lp.sector && lp.summary.trim().length >= r.summaryMin && lp.summary.length <= r.summaryMax
    && lp.fundingRequested > 0 && lp.team.every(t => t.name.trim())
    && (['business_plan', 'pitch_deck'] as const).every(k => lp.files.some(f => f.kind === k && f.scan === 'clean'));
  if (!ok) fail(400, 'incomplete', 'Please complete every section and wait for the security scan');
  const at = nowIso();
  touch(p.id, x => { x.status = 'submitted'; x.files = x.files.map(f => ({ ...f, scan: 'clean' })); });
  learnerDb.pitchSubmittedAt.update(d => { d[p.id] = at; });
  db.cycleEntries.update(list => { if (!list.some(e => e.code === p.code)) list.push({ code: p.code, cycleId: p.cycleId, businessName: lp.businessName, sector: lp.sector, judgesAssigned: 0, scoresIn: 0, aggregate: 0 }); });
  db.cycles.update(list => { const c = list.find(x => x.id === p.cycleId); if (c) c.entries += 1; });
  return toLearner(db.pitches.get().find(x => x.id === p.id)!);
});

export const receipt = defineEndpoint<PitchReceipt, { params: { id: string } }>({
  id: 'pitch.entries.receipt', service: 'core', method: 'GET', path: '/pitch/entries/:id/receipt',
  roles: ['beneficiary'], summary: 'Submission receipt for a submitted entry', srs: ['FR-A3.8'], response: 'PitchReceipt',
  notes: '409 "not_submitted" for drafts. The same receipt is emailed on pitch.submitted.',
}, ({ args, fail }) => {
  const lp = toLearner(ownEntry(args.params.id, fail));
  if (lp.status === 'draft') fail(409, 'not_submitted', 'This pitch has not been submitted yet');
  return {
    reference: lp.code, businessName: lp.businessName, cycleName: lp.cycleName, submittedAt: lp.submittedAt ?? lp.updatedAt,
    files: lp.files.map(f => ({ kind: f.kind, name: f.name, sizeMb: f.sizeMb, scan: f.scan })),
  };
});
