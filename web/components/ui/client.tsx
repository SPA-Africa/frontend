'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Moon, Sun, X } from 'lucide-react';
import { cx } from '@/lib/format';
import { useT } from '@/lib/i18n';

/* ---------- Theme toggle ---------- */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useT();
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === 'dark'); }, []);
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('spa-theme', next); } catch {}
    setDark(!dark);
    window.dispatchEvent(new Event('spa-theme'));
  };
  return (
    <button type="button" onClick={toggle} aria-label={dark ? t('ui.lightTheme') : t('ui.darkTheme')}
      className={cx('grid size-10 place-items-center rounded-full border border-line transition hover:bg-surface', className)}>
      {dark ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}

/* ---------- Reveal on scroll ---------- */
export function Reveal({ children, className, delay = 0, as: As = 'div' }: { children: React.ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'article' | 'li' }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <As ref={ref as never} className={cx('reveal', className)} style={{ transitionDelay: `${delay}ms` }}>{children}</As>;
}

/* ---------- Count up ---------- */
export function CountUp({ to, suffix = '', duration = 1600 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setV(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        setV(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{Math.round(v).toLocaleString('en-US')}{suffix}</span>;
}

/* ---------- Tabs ---------- */
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: React.ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('inline-flex flex-wrap gap-1 rounded-full bg-surface p-1', className)}>
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx('inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition',
            value === t.id ? 'bg-bg text-ink shadow-sm' : 'text-muted hover:text-ink')}>
          {t.label}
          {t.count !== undefined && <span className={cx('rounded-full px-1.5 text-xs', value === t.id ? 'bg-brand text-white' : 'bg-surface-2')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  const t = useT();
  if (!open) return null;
  // Portaled to <body>: ancestors with transform/filter animations (e.g. the portal
  // shell's fade-in wrapper) would otherwise become the containing block for
  // position:fixed and break viewport centering.
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fade-in absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('fade-in relative max-h-[92vh] w-full overflow-auto rounded-t-3xl bg-bg p-6 shadow-2xl sm:rounded-3xl sm:p-8', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label={t('ui.close')} className="grid size-9 place-items-center rounded-full hover:bg-surface"><X size={18} /></button>
        </div>
        {children}
        {footer && <div className="mt-8 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Toast ---------- */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? createPortal(
    <div role="status" className="fade-in fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-bg shadow-xl">{msg}</div>,
    document.body,
  ) : null;
  return { toast: setMsg, toastNode: node };
}

/* ---------- translated "(optional)" tag used by Field ---------- */
export function OptionalTag() {
  const t = useT();
  return <span className="font-normal text-subtle">({t('ui.optional')})</span>;
}
