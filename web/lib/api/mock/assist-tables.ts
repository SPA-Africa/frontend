// Mock tables for the AI assistance features: help assistant conversations and the state of the
// anonymised copies of pitch documents that judges see. Also the help assistant's canned answers in
// mock mode: like the backend's fake AI provider they are short, in English, and built from the
// caller's own demo data.

import { mockTable } from '../mock-db';
import { db } from './tables';
import { orgDb } from './org-tables';
import { invoiceTotals } from '../../mock/data';
import type { User } from '../../types';

export interface StoredAssistantMessage { id: string; role: 'user' | 'assistant'; text: string; createdAt: string }
export interface StoredConversation { id: string; userId: string; turns: number; messages: StoredAssistantMessage[] }

export type CopyStatus = 'ready' | 'pending' | 'unavailable';

/** A pending copy becomes ready this long after a judge first sees it, as the backend job would */
const PREPARE_MS = 45_000;

export const assistDb = {
  conversations: mockTable<StoredConversation[]>('assist.conversations', () => []),
  /** State of the anonymised copy of an entry document, by `<code>:<kind>`; anything not listed is ready */
  copies: mockTable<Record<string, { status: CopyStatus; readyAt?: string }>>('assist.copies', () => ({
    'PITCH-2026-00171:pitch_deck': { status: 'pending' },
    'PITCH-2026-00188:pitch_deck': { status: 'unavailable' },
  })),
};

export function copyStatus(code: string, kind: string): CopyStatus {
  const key = `${code}:${kind}`;
  const copy = assistDb.copies.get()[key];
  if (!copy) return 'ready';
  if (copy.status !== 'pending') return copy.status;
  if (!copy.readyAt) {
    assistDb.copies.update(m => { m[key] = { status: 'pending', readyAt: new Date(Date.now() + PREPARE_MS).toISOString() }; });
    return 'pending';
  }
  if (Date.parse(copy.readyAt) > Date.now()) return 'pending';
  assistDb.copies.update(m => { m[key] = { status: 'ready' }; });
  return 'ready';
}

/* ---------- canned answers ---------- */

const rwf = (n: number) => `RWF ${Math.round(n).toLocaleString('en-US')}`;
const bullets = (items: string[]) => items.map(i => `- ${i}`).join('\n');
const when = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

function learnerAnswer(user: User, has: (...w: string[]) => boolean): string | null {
  if (has('certificate', 'certificat', 'icyemezo', 'ibyemezo')) {
    const mine = db.certificates.get().filter(c => c.holder === user.name && c.status === 'valid');
    if (!mine.length) return 'You have no certificates yet. A certificate is issued automatically when you finish every lesson of a course and pass its quizzes.';
    return `You have ${mine.length} certificate${mine.length === 1 ? '' : 's'}:\n${bullets(mine.map(c => `${c.courseTitle}, code ${c.code}, issued ${c.issuedAt.slice(0, 10)}`))}\nOpen /app/certificates to download them. Anyone can check a code at /verify.`;
  }
  if (has('pitch', 'competition', 'concours', 'irushanwa', 'umushinga')) {
    const cycles = db.cycles.get();
    const pitches = db.pitches.get();
    if (!pitches.length) return 'You have no pitch yet. Open /app/pitch to start one in an open competition.';
    const s = db.settings.get();
    return `Your pitches:\n${bullets(pitches.map(p => {
      const c = cycles.find(x => x.id === p.cycleId);
      return `${p.code}, ${c?.name ?? p.cycleId}: ${p.status.replace('_', ' ')}${p.status === 'draft' && c ? `, closes ${c.closesAt}` : ''}`;
    }))}\nA pitch needs a business plan (up to ${s.uploadLimitsMb.businessPlan} MB) and a pitch deck (up to ${s.uploadLimitsMb.pitchDeck} MB). Scores stay hidden until results are published.`;
  }
  if (has('schedule', 'session', 'deadline', 'agenda', 'ingengabihe', 'coming up')) {
    const now = new Date().toISOString();
    const next = db.sessions.get().filter(s => s.startsAt >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 3);
    if (!next.length) return 'Nothing is coming up in your schedule.';
    return `Coming up:\n${bullets(next.map(s => `${when(s.startsAt)}: ${s.title}`))}\nOpen /app/schedule for the full list.`;
  }
  if (has('listing', 'market', 'buyer', 'sell', 'marché', 'isoko')) {
    const { all, mine } = db.listings.get();
    const titles = all.filter(l => mine.includes(l.id)).map(l => `${l.title}, ${l.quantity} at ${rwf(l.pricePerUnit)} per ${l.unit}`);
    return `${titles.length ? `Your listings:\n${bullets(titles)}\n` : 'You have no listings. '}Buyers contact you through the platform, which never shows your phone number or email.`;
  }
  if (has('my course', 'doing', 'progress', 'enrol', 'continue', 'mes cours', 'amahugurwa yanjye', 'ngeze he')) {
    const { enrollments, completed } = db.learning.get();
    const courses = db.courses.get();
    const rows = enrollments.map(e => {
      const c = courses.find(x => x.id === e.courseId);
      const total = c ? c.modules.reduce((n, m) => n + m.lessons.length, 0) : 0;
      const done = completed[e.courseId]?.length ?? 0;
      return `${c?.title ?? e.courseId}: ${e.status === 'completed' ? 'completed' : `${total ? Math.round((done / total) * 100) : 0}% done`}`;
    });
    if (!rows.length) return 'You are not enrolled in any course yet. Browse the catalogue at /courses.';
    return `You are enrolled in ${rows.length} course${rows.length === 1 ? '' : 's'}:\n${bullets(rows)}\nOpen /app/courses to continue where you stopped.`;
  }
  return null;
}

function organisationAnswer(user: User, has: (...w: string[]) => boolean): string | null {
  const meta = orgDb.bookingMeta.get();
  const ours = (bookingId: string) => !!user.orgId && meta[bookingId]?.orgId === user.orgId;
  if (has('invoice', 'owe', 'pay', 'facture', 'fagitire', 'kwishyura')) {
    const invoices = db.invoices.get().filter(i => ours(i.bookingId) && i.status !== 'draft' && i.status !== 'cancelled');
    if (!invoices.length) return 'Your organisation has no invoices yet.';
    const due = invoices.reduce((s, i) => s + Math.max(0, invoiceTotals(i).balance), 0);
    return `Balance due: ${rwf(due)}.\n${bullets(invoices.map(i => `${i.number}: ${i.status.replace('_', ' ')}, balance ${rwf(invoiceTotals(i).balance)}, due ${i.dueAt}`))}\nThere is no online payment yet: the SPA team shares payment instructions. Open /org/invoices for details.`;
  }
  if (has('booking', 'réservation', 'isaba', 'amasaba', 'training', 'formation', 'dates')) {
    const topics = db.catalogue.get();
    const bookings = db.bookings.get().filter(b => ours(b.id));
    if (!bookings.length) return 'Your organisation has no bookings yet. Open /org/book to book a training.';
    return `Your bookings:\n${bullets(bookings.map(b => `${b.id.toUpperCase()}: ${b.topics.map(id => topics.find(t => t.id === id)?.title ?? id).join(', ')}, ${b.window}, ${b.status}`))}\nA pending booking can be cancelled, and you can ask for new dates from /org/bookings.`;
  }
  if (has('package', 'topic', 'catalogue', 'forfait', 'paki', 'offer', 'propos')) {
    const topics = db.catalogue.get().filter(t => t.status === 'published');
    const packages = db.packages.get().map(p => `${p.name}: ${p.price === null ? 'priced on request' : rwf(p.price)}, ${p.participants}`);
    return `There are ${topics.length} topics to choose from, for example ${topics.slice(0, 3).map(t => t.title).join(', ')}.\nPackages:\n${bullets(packages)}\nThe needs assessment at /org/assessment recommends topics and a package.`;
  }
  return null;
}

/** The mock help assistant's answer, and whether it suggests handing over to the support team */
export function cannedAnswer(user: User, message: string): { text: string; handoff: boolean } {
  const q = message.toLowerCase();
  const has = (...words: string[]) => words.some(w => q.includes(w));
  if (has('human', 'person', 'someone', 'support', 'talk to', 'personne', 'équipe', 'umuntu', 'itsinda')) {
    return { text: 'I can pass this conversation to the SPA support team. Use "Send to the support team" below and they will reply by email.', handoff: true };
  }
  if (has('pass mark', 'attempt', 'quiz', 'rule', 'isuzumabumenyi')) {
    const s = db.settings.get();
    return { text: `Each quiz has a pass mark of ${Math.round(s.quizPassMark * 100)}% and you can take it up to ${s.maxQuizAttempts} times. A certificate is issued when every lesson is done and every quiz is passed.`, handoff: false };
  }
  const own = user.role === 'beneficiary' ? learnerAnswer(user, has) : user.role === 'org_client' ? organisationAnswer(user, has) : null;
  if (own) return { text: own, handoff: false };
  if (has('course', 'cours', 'learn', 'find', 'amahugurwa')) {
    const popular = db.courses.get().filter(c => c.published).sort((a, b) => b.enrolled - a.enrolled).slice(0, 3);
    return { text: `Popular courses:\n${bullets(popular.map(c => `${c.title} (${c.level}, ${c.hours} hours)`))}\nBrowse the full catalogue at /courses.`, handoff: false };
  }
  return {
    text: 'I can explain how the platform works and look up your own courses, certificates, pitches, bookings and invoices. This demo gives short sample answers: try one of the suggestions below.',
    handoff: false,
  };
}
