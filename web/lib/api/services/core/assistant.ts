// core-svc / assistant: the in-app help assistant
//
// Claude answers questions about the platform and looks up the caller's own data through read-only
// tools chosen by role (courses, certificates, schedule, pitches and listings for learners; bookings,
// invoices and the coaching catalogue for organisations; course search and platform rules for all).
// Conversations belong to their author. The assistant never shows other people's data or scores.

import { defineEndpoint } from '../../define';
import { mockId, nowIso } from '../../mock-db';
import { assistDb, cannedAnswer } from '../../mock/assist-tables';
// Only the assistant's own strings: importing the whole bundle would break `npm run api:docs`
import { aiAssist } from '../../../i18n/messages/ai-assist';
import type { Role } from '../../../types';

/** Characters per message */
export const MAX_MESSAGE = 2000;
/** Questions per conversation; after that a new conversation starts */
export const MAX_TURNS = 20;
/** Questions per person per hour (backend config AI_ASSISTANT_HOURLY_LIMIT) */
const MOCK_HOURLY_LIMIT = 30;

export interface AssistantMessageRequest {
  /** omit to start a new conversation */
  conversationId?: string;
  /** 1 to 2000 characters */
  message: string;
  /** the page the person is on, for context */
  page?: string;
}

export interface AssistantReply {
  conversationId: string;
  reply: { id: string; text: string; createdAt: string };
  /** the assistant suggests passing the conversation to the support team */
  handoff: boolean;
  /** up to three follow-up questions in the caller's language */
  suggestions: string[];
}

export interface AssistantChatMessage { id: string; role: 'user' | 'assistant'; text: string; createdAt: string }

export interface AssistantConversation { id: string; messages: AssistantChatMessage[] }

/** Starter and follow-up questions for a role, as i18n keys (ai.assistant.ask.*) */
export const suggestionKeys = (role: Role) => {
  const group = role === 'beneficiary' || role === 'org_client' ? role : 'other';
  return [1, 2, 3].map(n => `ai.assistant.ask.${group}.${n}`);
};

/* ---------- mock helpers ---------- */

// The backend answers in the Accept-Language of the request; the mock reads the page language
const mockLocale = () => {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'en';
  return lang === 'fr' || lang === 'rw' ? lang : 'en';
};

const conversationOf = (id: string, userId: string, fail: (s: number, c: string, m: string) => never) =>
  assistDb.conversations.get().find(c => c.id === id && c.userId === userId)
  ?? fail(404, 'conversation_not_found', 'We could not find this conversation. Please start a new one.');

/* ---------- endpoints ---------- */

export const sendMessage = defineEndpoint<AssistantReply, { body: AssistantMessageRequest }>({
  id: 'assistant.messages.send', service: 'core', method: 'POST', path: '/assistant/messages',
  roles: ['authenticated'], summary: 'Ask the help assistant a question, in a new or an existing conversation',
  request: 'AssistantMessageRequest', response: 'AssistantReply',
  notes: 'Claude (toolTurn, low effort, at most 6 tool rounds) with read-only tools over the caller\'s own data, chosen by role. History is stored exactly as returned and replayed unchanged (append-only); the role, page, language and date go in the user message, never the system prompt. 400 empty_message / message_too_long (2000 characters). 404 conversation_not_found unless the conversation is the caller\'s. 409 conversation_full after 20 questions; 409 conversation_busy when two messages race on one conversation. 429 ai_rate_limited after AI_ASSISTANT_HOURLY_LIMIT questions in an hour. 503 ai_unavailable when AI is turned off or the model cannot be reached; suggest the support team instead. `handoff` is true when the assistant suggests a person; the frontend then offers to send the transcript as a support ticket.',
}, ({ args, user, fail }) => {
  const me = user!;
  const text = (args.body.message ?? '').trim();
  if (!text) fail(400, 'empty_message', 'Please write a message');
  if (text.length > MAX_MESSAGE) fail(400, 'message_too_long', `Keep the message under ${MAX_MESSAGE} characters`);
  const since = Date.now() - 3_600_000;
  const lastHour = assistDb.conversations.get().filter(c => c.userId === me.id)
    .flatMap(c => c.messages).filter(m => m.role === 'user' && Date.parse(m.createdAt) > since).length;
  if (lastHour >= MOCK_HOURLY_LIMIT) fail(429, 'ai_rate_limited', 'You have sent many messages in the last hour. Please try again a little later.');
  const existing = args.body.conversationId ? conversationOf(args.body.conversationId, me.id, fail) : null;
  if (existing && existing.turns >= MAX_TURNS) fail(409, 'conversation_full', 'This conversation is long. Please start a new one.');

  const answer = cannedAnswer(me, text);
  const id = existing?.id ?? mockId('conv');
  const asked = { id: mockId('msg'), role: 'user' as const, text, createdAt: nowIso() };
  const reply = { id: mockId('msg'), role: 'assistant' as const, text: answer.text, createdAt: nowIso() };
  assistDb.conversations.update(list => {
    const c = list.find(x => x.id === id);
    if (c) { c.messages.push(asked, reply); c.turns += 1; } else list.push({ id, userId: me.id, turns: 1, messages: [asked, reply] });
  });
  const lang = mockLocale();
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const suggestions = suggestionKeys(me.role).map(k => aiAssist[k]?.[lang] ?? k).filter(s => norm(s) !== norm(text));
  return { conversationId: id, reply: { id: reply.id, text: reply.text, createdAt: reply.createdAt }, handoff: answer.handoff, suggestions: suggestions.slice(0, 3) };
});

export const getConversation = defineEndpoint<AssistantConversation, { params: { id: string } }>({
  id: 'assistant.conversations.get', service: 'core', method: 'GET', path: '/assistant/conversations/:id',
  roles: ['authenticated'], summary: 'The caller\'s conversation with the help assistant: questions and answers, oldest first',
  response: 'AssistantConversation',
  notes: 'Only the person\'s messages and the assistant\'s answers; tool steps and thinking are never returned. 404 conversation_not_found unless the conversation is the caller\'s.',
}, ({ args, user, fail }) => {
  const c = conversationOf(args.params.id, user!.id, fail);
  return { id: c.id, messages: c.messages };
});

export const deleteConversation = defineEndpoint<void, { params: { id: string } }>({
  id: 'assistant.conversations.delete', service: 'core', method: 'DELETE', path: '/assistant/conversations/:id',
  roles: ['authenticated'], summary: 'Delete one of the caller\'s help assistant conversations', response: 'void (204)',
  notes: '404 conversation_not_found unless the conversation is the caller\'s. Deleting does not reset the hourly question limit.',
}, ({ args, user, fail }) => {
  const c = conversationOf(args.params.id, user!.id, fail);
  assistDb.conversations.update(list => list.filter(x => x.id !== c.id));
});
