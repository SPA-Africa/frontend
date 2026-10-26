'use client';

// Building blocks for the sign-in and registration pages.

import { useEffect, useRef, useState } from 'react';
import { Check, CloudOff } from 'lucide-react';
import { Logo } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/client';
import { cx } from '@/lib/format';
import { useT } from '@/lib/i18n';
import AfricaDots from '@/components/landing/AfricaDots';
import { LanguageMenu } from '@/components/shell/SiteChrome';

/* split layout: form on the left, a calm brand panel on the right */
export function AuthShell({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-4 py-4 md:px-10">
          <Logo />
          <div className="flex items-center gap-2.5">
            <LanguageMenu />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 md:items-center md:px-10">
          <div className="w-full max-w-[480px]">{children}</div>
        </main>
      </div>
      <aside className="sticky top-0 hidden h-screen w-[42%] max-w-[620px] flex-col justify-end self-start overflow-hidden bg-surface p-12 lg:flex">
        <AfricaDots className="absolute inset-0 h-full w-full" />
        <div className="relative">{aside ?? <DefaultAside />}</div>
      </aside>
    </div>
  );
}

function DefaultAside() {
  const t = useT();
  return (
    <>
      <p className="font-display text-[clamp(26px,2.4vw,34px)] font-bold leading-tight tracking-tight">{t('public.auth.aside')}</p>
      <ul className="mt-8 flex flex-wrap gap-2">
        {(['technology', 'education', 'leadership', 'young_startups', 'agriculture'] as const).map(p => (
          <li key={p} className="rounded-full border border-line bg-bg px-4 py-2 text-sm font-semibold">{t(`pillar.${p}`)}</li>
        ))}
      </ul>
    </>
  );
}

/* step indicator */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  const t = useT();
  return (
    <nav aria-label={t('public.auth.progress')} className="mb-8">
      <p className="mb-3 text-sm font-semibold text-muted">{t('public.auth.step', { n: current + 1, total: steps.length })} <span className="text-ink">{steps[current]}</span></p>
      <ol className="flex gap-1.5">
        {steps.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i === current ? 'step' : undefined}>
            <span className={cx('block h-1.5 rounded-full transition-colors duration-500', i <= current ? 'bg-brand' : 'bg-surface-2')} />
            <span className="sr-only">{s}{i < current ? ` (${t('public.auth.done')})` : ''}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* six single-digit boxes for the verification code */
export function CodeInput({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const t = useT();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  const set = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join('').slice(0, 6));
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label={t('public.auth.codeGroup')}>
      {digits.map((d, i) => (
        <input key={i} ref={el => { refs.current[i] = el; }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={t('public.auth.digit', { n: i + 1 })} aria-invalid={invalid} maxLength={1}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '');
            if (v.length > 1) { // pasted or autofilled
              onChange(v.slice(0, 6));
              refs.current[Math.min(5, v.length)]?.focus();
              return;
            }
            set(i, v);
            if (v && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={e => {
            const v = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (v) { e.preventDefault(); onChange(v); refs.current[Math.min(5, v.length)]?.focus(); }
          }}
          className={cx('h-14 w-full min-w-0 rounded-xl border bg-bg text-center font-display text-2xl font-bold transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10',
            invalid ? 'border-brand' : 'border-line')} />
      ))}
    </div>
  );
}

/* offline notice (SRS FR-A1.4) */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);
  return online;
}

export function OfflineNotice() {
  const t = useT();
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl bg-gold-light p-4 text-sm font-medium text-ink dark:bg-gold/15">
      <CloudOff size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
      {t('public.auth.offline')}
    </div>
  );
}

/* selectable card (used for pillars) */
export function ChoiceCard({ checked, onChange, title, text, icon }: { checked: boolean; onChange: () => void; title: string; text?: string; icon?: React.ReactNode }) {
  return (
    <label className={cx('relative flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand/20',
      checked ? 'border-brand bg-brand-light/50 dark:bg-brand/10' : 'border-line hover:bg-surface')}>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      {icon && <span className={cx('mt-0.5', checked ? 'text-brand' : 'text-muted')}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {text && <span className="mt-0.5 block text-sm text-muted">{text}</span>}
      </span>
      <span aria-hidden="true" className={cx('grid size-5 shrink-0 place-items-center rounded-full border transition', checked ? 'border-brand bg-brand text-white' : 'border-line')}>
        {checked && <Check size={13} />}
      </span>
    </label>
  );
}
