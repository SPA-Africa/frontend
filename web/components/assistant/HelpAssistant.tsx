'use client';

// Floating help assistant on every portal page (core-svc /assistant). Claude answers questions about
// the platform and the person's own data; when it cannot help, the conversation can be sent to the
// support team as a ticket. The conversation id is kept for the browser session only.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, LifeBuoy, LoaderCircle, MessageCircleQuestion, RotateCcw, Send, Sparkles, SquarePen, X } from 'lucide-react';
import { Button, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api/http';
import { errorMessage } from '@/lib/api/hooks';
import * as assistant from '@/lib/api/services/core/assistant';
import type { AssistantChatMessage } from '@/lib/api/services/core/assistant';
import * as notifications from '@/lib/api/services/core/notifications';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { cx } from '@/lib/format';

/** Support tickets take up to 5000 characters */
const TICKET_MAX = 5000;
/** Error codes with their own message (ai.assistant.error.*) */
const KNOWN_ERRORS = ['ai_unavailable', 'ai_rate_limited', 'conversation_full', 'message_too_long', 'conversation_busy'];

interface Failure { code: string; text: string }
type TicketState = 'idle' | 'sending' | 'sent' | { error: string };

const iconBtn = 'grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-40';
const linkCls = 'font-semibold text-brand underline-offset-2 hover:underline';

/* ---------- answer formatting: paragraphs, lists, **bold** and links to platform pages ---------- */

const INLINE = /(\[[^\]]+\]\(\/[^)\s]*\)|\*\*[^*]+\*\*|(?<![\w/.])\/(?:app|org|console|judge|admin|board|courses|coaching|verify)(?:\/[\w-]+)*)/g;

function inline(text: string, onNavigate: () => void): React.ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const md = part.match(/^\[([^\]]+)\]\((\/[^)\s]*)\)$/);
    if (md) return <Link key={i} href={md[2]} onClick={onNavigate} className={linkCls}>{md[1]}</Link>;
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('/')) return <Link key={i} href={part} onClick={onNavigate} className={linkCls}>{part}</Link>;
    return part;
  });
}

function RichText({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const blocks: { kind: 'p' | 'h' | 'ul' | 'ol'; lines: string[] }[] = [];
  let gap = true;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) { gap = true; continue; }
    const last = blocks[blocks.length - 1];
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const item = line.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (heading) blocks.push({ kind: 'h', lines: [heading[1]] });
    else if (item) {
      const kind = /\d/.test(item[1]) ? 'ol' : 'ul';
      if (last?.kind === kind && !gap) last.lines.push(item[2]); else blocks.push({ kind, lines: [item[2]] });
    } else if (last?.kind === 'p' && !gap) last.lines.push(line);
    else blocks.push({ kind: 'p', lines: [line] });
    gap = false;
  }
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.kind === 'ul' || b.kind === 'ol') {
          const List = b.kind;
          return <List key={i} className={cx('space-y-1 pl-5', b.kind === 'ul' ? 'list-disc' : 'list-decimal')}>{b.lines.map((l, j) => <li key={j}>{inline(l, onNavigate)}</li>)}</List>;
        }
        return <p key={i} className={b.kind === 'h' ? 'font-semibold' : undefined}>{b.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, onNavigate)}</Fragment>)}</p>;
      })}
    </div>
  );
}

/* ---------- the assistant ---------- */

export function HelpAssistant() {
  const { user } = useSession();
  const { t } = useI18n();
  const pathname = usePathname();
  const storageKey = user ? `spa-assistant:${user.id}` : '';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  /** follow-ups from the last answer; null before the first one (role starters are shown) */
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketState>('idle');
  const conversationId = useRef<string | null>(null);
  const historyLoaded = useRef(false);
  const wasOpen = useRef(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const input = () => formRef.current?.querySelector('textarea') ?? null;

  const remember = useCallback((id: string | null) => {
    conversationId.current = id;
    try {
      if (id) sessionStorage.setItem(storageKey, id);
      else sessionStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  // Earlier messages of this browser session's conversation, the first time the panel opens
  useEffect(() => {
    if (!open || historyLoaded.current || !storageKey) return;
    historyLoaded.current = true;
    let stored: string | null = null;
    try { stored = sessionStorage.getItem(storageKey); } catch {}
    if (!stored) return;
    conversationId.current = stored;
    assistant.getConversation({ params: { id: stored } })
      .then(c => setMessages(m => (m.length ? m : c.messages)))
      .catch(e => { if (e instanceof ApiError && e.status === 404) remember(null); });
  }, [open, storageKey, remember]);

  useEffect(() => {
    if (open) { input()?.focus(); wasOpen.current = true; }
    else if (wasOpen.current) launcherRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, failure, handoff, ticket, open]);

  useEffect(() => {
    const el = input();
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [draft, open]);

  if (!user) return null;

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    if (text.length > assistant.MAX_MESSAGE) { setFailure({ code: 'message_too_long', text }); return; }
    const local: AssistantChatMessage = { id: `local-${Date.now()}`, role: 'user', text, createdAt: new Date().toISOString() };
    const before = suggestions;
    setMessages(m => [...m, local]);
    setDraft(''); setBusy(true); setFailure(null); setNotice(null); setHandoff(false); setTicket('idle'); setSuggestions([]);
    const ask = (id?: string) => assistant.sendMessage({ body: { conversationId: id, message: text, page: pathname } });
    try {
      let out;
      try {
        out = await ask(conversationId.current ?? undefined);
      } catch (e) {
        if (!(e instanceof ApiError && e.code === 'conversation_not_found')) throw e;
        // The conversation is gone (deleted elsewhere, or another account): carry on in a new one
        remember(null);
        setMessages([local]);
        setNotice(t('ai.assistant.error.conversation_not_found'));
        out = await ask();
      }
      remember(out.conversationId);
      const { reply } = out;
      setMessages(m => [...m, { id: reply.id, role: 'assistant', text: reply.text, createdAt: reply.createdAt }]);
      setSuggestions(out.suggestions);
      setHandoff(out.handoff);
    } catch (e) {
      // Not kept: the question goes back into the box
      setMessages(m => m.filter(x => x.id !== local.id));
      setDraft(d => d || text);
      setSuggestions(before);
      setFailure({ code: e instanceof ApiError ? e.code : 'network_error', text });
    } finally {
      setBusy(false);
    }
  };

  const newConversation = () => {
    const old = conversationId.current;
    if (old) assistant.deleteConversation({ params: { id: old } }).catch(() => undefined);
    remember(null);
    setMessages([]); setSuggestions(null); setHandoff(false); setFailure(null); setNotice(null); setTicket('idle');
    input()?.focus();
  };

  /** The conversation for the support team, newest messages kept when it is too long for a ticket */
  const transcript = (items: { role: 'user' | 'assistant'; text: string }[]) => {
    const head = t('ai.assistant.ticket.intro', { page: pathname });
    const earlier = t('ai.assistant.ticket.earlier');
    const lines = items.map(m => `${m.role === 'user' ? t('ai.assistant.you') : t('ai.assistant.assistant')}: ${m.text.length > 1500 ? `${m.text.slice(0, 1500)}...` : m.text}`);
    const kept: string[] = [];
    let size = head.length + earlier.length + 4;
    for (let i = lines.length - 1; i >= 0 && size + lines[i].length + 2 <= TICKET_MAX; i--) {
      kept.unshift(lines[i]);
      size += lines[i].length + 2;
    }
    return [head, ...(kept.length < lines.length ? [earlier] : []), ...kept].join('\n\n');
  };

  const sendToSupport = async () => {
    setTicket('sending');
    // A question the assistant could not take is sent along with the conversation
    const items = failure ? [...messages, { role: 'user' as const, text: failure.text }] : messages;
    try {
      await notifications.createSupportTicket({ body: { subject: t('ai.assistant.ticket.subject'), message: transcript(items), page: pathname } });
      setTicket('sent');
      if (failure) setDraft(d => (d.trim() === failure.text ? '' : d));
    } catch (e) {
      setTicket({ error: errorMessage(e) });
    }
  };

  const onNavigate = () => { if (window.matchMedia('(max-width: 639px)').matches) setOpen(false); };
  const failureText = (f: Failure) =>
    f.code === 'message_too_long' ? t('ai.assistant.error.message_too_long', { n: assistant.MAX_MESSAGE })
      : KNOWN_ERRORS.includes(f.code) ? t(`ai.assistant.error.${f.code}`) : t('ai.assistant.error.generic');

  const chips = suggestions ?? assistant.suggestionKeys(user.role).map(k => t(k));
  const showHandoff = (handoff || failure?.code === 'ai_unavailable') && !busy;
  const left = assistant.MAX_MESSAGE - draft.length;

  return (
    <div data-print-hide>
      {!open && (
        <button ref={launcherRef} onClick={() => setOpen(true)} aria-label={t('ai.assistant.open')} title={t('ai.assistant.open')} aria-haspopup="dialog"
          className="fixed bottom-5 right-5 z-[150] grid size-14 place-items-center rounded-full bg-brand text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30">
          <MessageCircleQuestion size={24} aria-hidden />
        </button>
      )}

      {open && (
        <section role="dialog" aria-labelledby="assistant-title" aria-describedby="assistant-sub"
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}
          className="fade-in fixed inset-0 z-[150] flex flex-col bg-bg sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[400px] sm:rounded-3xl sm:border sm:border-line sm:shadow-2xl">
          <header className="flex items-start gap-3 border-b border-line px-4 py-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-brand-light text-brand dark:bg-brand/15"><Sparkles size={17} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <h2 id="assistant-title" className="font-bold">{t('ai.assistant.title')}</h2>
              <p id="assistant-sub" className="text-xs text-muted">{t('ai.assistant.subtitle')}</p>
            </div>
            <button onClick={newConversation} disabled={busy || (!messages.length && !failure)} aria-label={t('ai.assistant.new')} title={t('ai.assistant.new')} className={iconBtn}><SquarePen size={17} /></button>
            <button onClick={() => setOpen(false)} aria-label={t('ui.close')} className={iconBtn}><X size={18} /></button>
          </header>

          <div ref={logRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!messages.length && <div className="rounded-2xl bg-surface p-4 text-[15px] leading-relaxed">{t('ai.assistant.welcome', { name: user.name.split(' ')[0] })}</div>}
            {notice && <p className="text-sm text-muted">{notice}</p>}

            {messages.map(m => {
              const mine = m.role === 'user';
              return (
                <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cx('max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed', mine ? 'whitespace-pre-wrap rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-surface')}>
                    <span className="sr-only">{mine ? t('ai.assistant.you') : t('ai.assistant.assistant')}: </span>
                    {mine ? m.text : <RichText text={m.text} onNavigate={onNavigate} />}
                  </div>
                </div>
              );
            })}

            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-sm text-muted">
                  <LoaderCircle size={16} className="animate-spin" aria-hidden /> {t('ai.assistant.thinking')}
                </div>
              </div>
            )}

            {failure && (
              <div role="alert" className="rounded-2xl border border-brand/20 bg-brand/5 p-3 text-sm">
                <p>{failureText(failure)}</p>
                {failure.code === 'conversation_full' && (
                  <Button size="sm" variant="ghost" className="mt-2 bg-bg" onClick={newConversation}><SquarePen size={15} /> {t('ai.assistant.new')}</Button>
                )}
                {!KNOWN_ERRORS.includes(failure.code) || failure.code === 'conversation_busy' ? (
                  <Button size="sm" variant="ghost" className="mt-2 bg-bg" disabled={busy} onClick={() => send(failure.text)}><RotateCcw size={15} /> {t('ui.retry')}</Button>
                ) : null}
              </div>
            )}

            {showHandoff && (
              <div className="rounded-2xl border border-line p-3 text-sm">
                {ticket === 'sent' ? (
                  <p role="status" className="flex items-center gap-2 font-semibold text-ok"><CheckCircle2 size={16} aria-hidden /> {t('ai.assistant.handoff.sent')}</p>
                ) : (
                  <>
                    <div className="flex items-center gap-2 font-semibold"><LifeBuoy size={16} className="text-brand" aria-hidden /> {t('ai.assistant.handoff.title')}</div>
                    <p className="mt-1 text-muted">{t('ai.assistant.handoff.body')}</p>
                    {typeof ticket === 'object' && <p role="alert" className="mt-2 text-brand">{ticket.error}</p>}
                    <Button size="sm" className="mt-3" onClick={sendToSupport} disabled={ticket === 'sending'}>
                      {ticket === 'sending' ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : <Send size={15} aria-hidden />} {t('ai.assistant.handoff.send')}
                    </Button>
                  </>
                )}
              </div>
            )}

            {!busy && chips.length > 0 && (
              <div>
                {!messages.length && <div className="mb-2 text-xs font-semibold text-subtle">{t('ai.assistant.tryAsking')}</div>}
                <div className="flex flex-wrap gap-2">
                  {chips.map(s => (
                    <button key={s} onClick={() => send(s)} className="rounded-full border border-line px-3 py-1.5 text-left text-sm font-semibold transition hover:bg-surface">{s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form ref={formRef} onSubmit={e => { e.preventDefault(); send(draft); }} className="border-t border-line p-3">
            <label htmlFor="assistant-input" className="sr-only">{t('ai.assistant.inputLabel')}</label>
            <div className="flex items-end gap-2">
              <Textarea id="assistant-input" rows={1} value={draft} maxLength={assistant.MAX_MESSAGE} placeholder={t('ai.assistant.placeholder')}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }}
                className="max-h-36 min-h-11! resize-none py-2.5!" />
              <Button type="submit" disabled={busy || !draft.trim()} aria-label={t('ai.assistant.send')} className="size-11 shrink-0 px-0!"><Send size={17} aria-hidden /></Button>
            </div>
            {left <= 200 && <p className="mt-1 text-right text-xs text-muted">{t('ai.assistant.charsLeft', { n: left })}</p>}
          </form>
        </section>
      )}
    </div>
  );
}
