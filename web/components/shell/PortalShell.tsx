'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility, Bell, ChevronDown, CircleHelp, Languages, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  Repeat, Search, Send, X,
} from 'lucide-react';
import { Avatar, Button, Field, Logo, Textarea, Input } from '@/components/ui';
import { Modal, ThemeToggle, useToast } from '@/components/ui/client';
import { homeFor, useSession } from '@/lib/session';
import { useI18n, locales } from '@/lib/i18n';
import { API_MODE } from '@/lib/api/config';
import { useApi } from '@/lib/api/hooks';
import * as notifications from '@/lib/api/services/core/notifications';
import type { Role } from '@/lib/types';
import { cx } from '@/lib/format';
import { portalNav } from './nav';

/* ---------- small popover helper ---------- */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

const popoverCls = 'fade-in absolute right-0 top-12 z-50 rounded-2xl border border-line bg-bg p-2 shadow-xl';
const iconBtn = 'relative grid size-10 shrink-0 place-items-center rounded-full border border-line transition hover:bg-surface';

/* ---------- language ---------- */
function LanguageMenu() {
  const { locale, setLocale, t } = useI18n();
  const p = usePopover();
  return (
    <div className="relative" ref={p.ref}>
      <button onClick={() => p.setOpen(o => !o)} aria-expanded={p.open} aria-label={t('shell.language')}
        className="flex h-10 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold transition hover:bg-surface">
        <Languages size={16} /> {locales.find(l => l.id === locale)?.short}
      </button>
      {p.open && (
        <div className={cx(popoverCls, 'w-44')} role="menu">
          {locales.map(l => (
            <button key={l.id} role="menuitemradio" aria-checked={locale === l.id} onClick={() => { setLocale(l.id); p.setOpen(false); }}
              className={cx('flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface', locale === l.id && 'text-brand')}>
              {l.label} <span className="text-xs text-subtle">{l.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- accessibility (text size, contrast, motion) ---------- */
function A11yMenu() {
  const { t } = useI18n();
  const p = usePopover();
  const [prefs, setPrefs] = useState({ text: 'md', contrast: 'normal', motion: 'normal' });
  useEffect(() => {
    try { const s = localStorage.getItem('spa-a11y'); if (s) setPrefs(JSON.parse(s)); } catch {}
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.text = prefs.text; el.dataset.contrast = prefs.contrast; el.dataset.motion = prefs.motion;
    try { localStorage.setItem('spa-a11y', JSON.stringify(prefs)); } catch {}
  }, [prefs]);
  const seg = (key: 'text' | 'contrast' | 'motion', opts: [string, string][]) => (
    <div className="flex rounded-full bg-surface p-1">
      {opts.map(([v, label]) => (
        <button key={v} onClick={() => setPrefs(p => ({ ...p, [key]: v }))} aria-pressed={prefs[key] === v}
          className={cx('flex-1 rounded-full px-2 py-1.5 text-sm font-semibold transition', prefs[key] === v ? 'bg-bg shadow-sm' : 'text-muted')}>{label}</button>
      ))}
    </div>
  );
  return (
    <div className="relative hidden sm:block" ref={p.ref}>
      <button onClick={() => p.setOpen(o => !o)} aria-expanded={p.open} aria-label={t('shell.accessibility')} className={iconBtn}><Accessibility size={18} /></button>
      {p.open && (
        <div className={cx(popoverCls, 'w-72 space-y-3 p-4')}>
          <div className="font-bold">{t('shell.accessibility')}</div>
          <div><div className="mb-1.5 text-sm text-muted">{t('shell.textSize')}</div>{seg('text', [['md', 'A'], ['lg', 'A+'], ['xl', 'A++']])}</div>
          <div><div className="mb-1.5 text-sm text-muted">{t('shell.highContrast')}</div>{seg('contrast', [['normal', 'Off'], ['high', 'On']])}</div>
          <div><div className="mb-1.5 text-sm text-muted">{t('shell.reduceMotion')}</div>{seg('motion', [['normal', 'Off'], ['reduce', 'On']])}</div>
        </div>
      )}
    </div>
  );
}

/* ---------- notifications ---------- */
function NotificationsMenu() {
  const { t } = useI18n();
  const p = usePopover();
  const state = useApi(() => notifications.list(), []);
  const unread = state.data?.filter(n => !n.read).length ?? 0;
  const markAll = async () => {
    await notifications.markRead({ body: { ids: 'all' } });
    state.setData(d => d?.map(n => ({ ...n, read: true })));
  };
  return (
    <div className="relative" ref={p.ref}>
      <button onClick={() => p.setOpen(o => !o)} aria-expanded={p.open} aria-label={`${t('shell.notifications')}${unread ? ` (${unread})` : ''}`} className={iconBtn}>
        <Bell size={18} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">{unread}</span>}
      </button>
      {p.open && (
        <div className={cx(popoverCls, 'w-[min(360px,calc(100vw-2rem))] p-0')}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-bold">{t('shell.notifications')}</span>
            {unread > 0 && <button onClick={markAll} className="text-sm font-semibold text-brand hover:text-brand-dark">{t('shell.markAllRead')}</button>}
          </div>
          <ul className="max-h-96 overflow-auto p-2">
            {(state.data ?? []).length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{t('shell.noNotifications')}</li>}
            {state.data?.map(n => (
              <li key={n.id}>
                <Link href={n.href ?? '#'} onClick={() => p.setOpen(false)} className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-surface">
                  <span className={cx('mt-2 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand')} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{n.title}</span>
                    <span className="block text-sm text-muted">{n.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- help ---------- */
function HelpMenu() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { toast, toastNode } = useToast();
  const send = async () => {
    setSending(true);
    try {
      await notifications.createSupportTicket({ body: { subject, message, page: pathname } });
      setOpen(false); setSubject(''); setMessage('');
      toast('Message sent. Our team will reply by email.');
    } finally { setSending(false); }
  };
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={t('shell.help')} className={cx(iconBtn, 'hidden sm:grid')}><CircleHelp size={18} /></button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('shell.contactSupport')}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{t('ui.cancel')}</Button>
          <Button onClick={send} disabled={sending || !subject.trim() || message.trim().length < 10}><Send size={16} /> Send</Button>
        </>}>
        <div className="space-y-4">
          <p className="text-muted">Tell us what you were trying to do. We include the page you are on so we can help faster.</p>
          <Field label="Subject" htmlFor="help-subject"><Input id="help-subject" value={subject} onChange={e => setSubject(e.target.value)} /></Field>
          <Field label="Message" htmlFor="help-msg" hint="At least 10 characters"><Textarea id="help-msg" value={message} onChange={e => setMessage(e.target.value)} /></Field>
        </div>
      </Modal>
      {toastNode}
    </>
  );
}

/* ---------- quick search (pages in this portal) ---------- */
function QuickSearch({ role }: { role: Role }) {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useMemo(() => portalNav[role].groups.flatMap(g => g.items).map(i => ({ ...i, text: t(i.label) })), [role, t]);
  const hits = q ? items.filter(i => i.text.toLowerCase().includes(q.toLowerCase())) : items;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="relative hidden w-full max-w-sm md:block">
      <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" />
      <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={e => { if (e.key === 'Enter' && hits[0]) { router.push(hits[0].href); setOpen(false); setQ(''); } }}
        placeholder={t('shell.search')} aria-label={t('shell.search')}
        className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-14 text-[15px] placeholder:text-subtle focus:border-brand focus:bg-bg focus:outline-none focus:ring-4 focus:ring-brand/10" />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-line bg-bg px-1.5 text-[11px] font-semibold text-subtle">⌘K</kbd>
      {open && hits.length > 0 && (
        <ul className="fade-in absolute left-0 right-0 top-12 z-50 rounded-2xl border border-line bg-bg p-2 shadow-xl">
          {hits.slice(0, 8).map(h => {
            const Icon = h.icon;
            return (
              <li key={h.href}>
                <Link href={h.href} onClick={() => { setOpen(false); setQ(''); }} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface">
                  <Icon size={16} className="text-muted" /> {h.text}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- user menu ---------- */
function UserMenu() {
  const { user, signOut } = useSession();
  const { t } = useI18n();
  const router = useRouter();
  const p = usePopover();
  if (!user) return null;
  return (
    <div className="relative" ref={p.ref}>
      <button onClick={() => p.setOpen(o => !o)} aria-expanded={p.open} className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5 transition hover:bg-surface">
        <Avatar name={user.name} size={32} />
        <span className="hidden max-w-36 truncate text-sm font-semibold lg:block">{user.name}</span>
        <ChevronDown size={16} className="text-muted" />
      </button>
      {p.open && (
        <div className={cx(popoverCls, 'w-64')}>
          <div className="px-3 py-2">
            <div className="font-semibold">{user.name}</div>
            <div className="truncate text-sm text-muted">{user.email}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          {API_MODE === 'mock' && (
            <Link href="/login?switch=1" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface"><Repeat size={16} /> {t('shell.switchRole')}</Link>
          )}
          <button onClick={() => { signOut(); router.push('/'); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-brand hover:bg-surface"><LogOut size={16} /> {t('shell.signOut')}</button>
        </div>
      )}
    </div>
  );
}

/* ---------- shell ---------- */
export function PortalShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, ready, signIn } = useSession();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const nav = portalNav[role];

  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => { try { setCollapsed(localStorage.getItem('spa-sidebar') === 'collapsed'); } catch {} }, []);
  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, pathname, router]);

  const toggleCollapsed = () => setCollapsed(c => {
    try { localStorage.setItem('spa-sidebar', c ? 'open' : 'collapsed'); } catch {}
    return !c;
  });

  if (!ready || !user) return <div className="min-h-screen bg-canvas" />;

  if (user.role !== role) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-4">
        <div className="max-w-md rounded-[var(--radius-card)] border border-line bg-bg p-8 text-center">
          <Logo className="mx-auto mb-6" />
          <h1 className="text-2xl font-bold">{t('shell.wrongRole', { role: t(`role.${role}`) })}</h1>
          <p className="mt-2 text-muted">{t('shell.signedInAs', { role: t(`role.${user.role}`) })}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {API_MODE === 'mock' && <Button onClick={() => signIn(role)}>{t('shell.continueAs', { role: t(`role.${role}`) })}</Button>}
            <Button variant="ghost" href={homeFor[user.role]}>{t('shell.backToMine')}</Button>
          </div>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => (href === nav.base ? pathname === href : pathname === href || pathname.startsWith(href + '/'));
  const scope = role === 'pillar_rep' && user.pillarId ? t(`pillar.${user.pillarId}`) : null;

  const navList = (mini: boolean) => (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4" aria-label={t(nav.title)}>
      {nav.groups.map((g, i) => (
        <div key={i}>
          {g.label && !mini && <div className="mb-1.5 px-3 text-xs font-semibold text-subtle">{t(g.label)}</div>}
          {g.label && mini && <div className="mx-3 mb-2 h-px bg-line" />}
          <ul className="flex flex-col gap-0.5">
            {g.items.map(item => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={active ? 'page' : undefined} title={mini ? t(item.label) : undefined}
                    className={cx('relative flex items-center gap-3 rounded-xl py-2.5 text-[15px] font-semibold transition',
                      mini ? 'justify-center px-0' : 'px-3',
                      active ? 'bg-brand-light text-brand-dark dark:bg-brand/15 dark:text-[#ffb59a]' : 'text-muted hover:bg-surface hover:text-ink')}>
                    {active && !mini && <span className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-brand" aria-hidden="true" />}
                    <Icon size={19} className={active ? 'text-brand' : ''} />
                    {!mini && <span className="truncate">{t(item.label)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const sidebarFooter = (mini: boolean) => (
    <div className="border-t border-line p-3">
      {!mini && (
        <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-1.5">
          <Avatar name={user.name} size={34} />
          <div className="min-w-0 text-sm">
            <div className="truncate font-semibold">{t(`role.${role}`)}</div>
            <div className="truncate text-muted">{scope ?? user.email}</div>
          </div>
        </div>
      )}
      <button onClick={toggleCollapsed} aria-label={mini ? t('shell.expand') : t('shell.collapse')}
        className={cx('hidden w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted transition hover:bg-surface hover:text-ink lg:flex', mini && 'justify-center px-0')}>
        {mini ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /> {t('shell.collapse')}</>}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* desktop sidebar */}
      <aside data-print-hide className={cx('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-bg transition-[width] duration-300 lg:flex', collapsed ? 'w-[76px]' : 'w-64')}>
        <div className={cx('flex h-16 items-center border-b border-line', collapsed ? 'justify-center' : 'px-5')}>
          {collapsed ? <Link href="/" aria-label="Home"><span className="font-display text-xl font-extrabold text-brand">S</span></Link> : <Logo href="/" />}
        </div>
        {navList(collapsed)}
        {sidebarFooter(collapsed)}
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="fade-in absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="fade-in absolute inset-y-0 left-0 flex w-72 flex-col bg-bg shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo href="/" />
              <button onClick={() => setDrawer(false)} aria-label={t('shell.closeMenu')} className="grid size-10 place-items-center rounded-full hover:bg-surface"><X size={18} /></button>
            </div>
            {navList(false)}
            {sidebarFooter(false)}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header data-print-hide className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-line bg-nav px-4 backdrop-blur-md md:gap-3 md:px-6">
          <button className={cx(iconBtn, 'lg:hidden')} onClick={() => setDrawer(true)} aria-label={t('shell.openMenu')}><Menu size={18} /></button>
          <span className="truncate font-display text-[15px] font-bold lg:hidden">{t(nav.title)}</span>
          <QuickSearch role={role} />
          <div className="ml-auto flex items-center gap-2">
            {API_MODE === 'mock' && <span className="hidden rounded-full bg-gold-light px-2.5 py-1 text-xs font-semibold text-[#8a5a0c] xl:inline dark:bg-gold/20 dark:text-gold">{t('shell.demoMode')}</span>}
            <LanguageMenu />
            <A11yMenu />
            <ThemeToggle className="hidden sm:grid" />
            <HelpMenu />
            <NotificationsMenu />
            <UserMenu />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="fade-in mx-auto max-w-[1240px]" key={pathname}>{children}</div>
        </main>
      </div>
    </div>
  );
}
