'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Languages } from 'lucide-react';
import { Button, Logo } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/client';
import { homeFor, useSession } from '@/lib/session';
import { cx } from '@/lib/format';
import { locales, useI18n, useT } from '@/lib/i18n';

const links = [
  { href: '/#about', label: 'site.nav.about' },
  { href: '/#pillars', label: 'site.nav.whatWeDo' },
  { href: '/courses', label: 'site.nav.courses' },
  { href: '/coaching', label: 'site.nav.organisations' },
  { href: '/verify', label: 'site.nav.verify' },
];

/* EN / FR / RW switcher for the public header and the sign-in pages (same look as the portal one) */
export function LanguageMenu({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
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
  return (
    <div className={cx('relative', className)} ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={t('shell.language')}
        className="flex h-10 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-semibold transition hover:bg-surface">
        <Languages size={16} /> {locales.find(l => l.id === locale)?.short}
      </button>
      {open && (
        <div className="fade-in absolute right-0 top-12 z-50 w-44 rounded-2xl border border-line bg-bg p-2 shadow-xl" role="menu">
          {locales.map(l => (
            <button key={l.id} type="button" role="menuitemradio" aria-checked={locale === l.id} onClick={() => { setLocale(l.id); setOpen(false); }}
              className={cx('flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold hover:bg-surface', locale === l.id && 'text-brand')}>
              {l.label} <span className="text-xs text-subtle">{l.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SiteHeader() {
  const { locale, setLocale, t } = useI18n();
  const { user } = useSession();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 10);
      setHidden(y > last && y > 400);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; }, [open]);

  return (
    <>
      <header className={cx('fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-6 border-b bg-nav px-4 py-3.5 backdrop-blur-md transition duration-300 md:px-12',
        scrolled ? 'border-line' : 'border-transparent', hidden && !open && '-translate-y-full')}>
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex" aria-label={t('site.nav.main')}>
          {links.map(l => (
            <Link key={l.href} href={l.href} className={cx('text-[15px] font-semibold transition hover:text-ink', pathname === l.href ? 'text-ink' : 'text-muted')}>{t(l.label)}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <LanguageMenu className="hidden sm:block" />
          <ThemeToggle />
          {user ? (
            <Button href={homeFor[user.role]} size="sm" className="hidden sm:inline-flex">{t('site.nav.myAccount')}</Button>
          ) : (
            <>
              <Link href="/login" className="hidden px-2 text-[15px] font-semibold text-muted hover:text-ink sm:block">{t('site.nav.signIn')}</Link>
              <Button href="/register" size="sm" className="hidden sm:inline-flex">{t('site.nav.join')}</Button>
            </>
          )}
          <button onClick={() => setOpen(o => !o)} aria-label={open ? t('site.nav.closeMenu') : t('site.nav.openMenu')} aria-expanded={open}
            className="relative grid size-10 place-items-center rounded-full border border-line lg:hidden">
            <span className={cx('absolute h-0.5 w-4 bg-ink transition', open ? 'rotate-45' : '-translate-y-1')} />
            <span className={cx('absolute h-0.5 w-4 bg-ink transition', open ? '-rotate-45' : 'translate-y-1')} />
          </button>
        </div>
      </header>

      <div className={cx('fixed inset-0 z-40 bg-bg px-4 pb-10 pt-24 transition duration-300 lg:hidden', open ? 'visible opacity-100' : 'invisible opacity-0')}>
        <nav className="flex flex-col">
          {links.map(l => <Link key={l.href} href={l.href} className="border-b border-line py-4 font-display text-3xl font-bold">{t(l.label)}</Link>)}
        </nav>
        <div className="mt-8 flex gap-3">
          {user ? <Button href={homeFor[user.role]}>{t('site.nav.myAccount')}</Button> : <><Button href="/register">{t('site.nav.join')}</Button><Button href="/login" variant="ghost">{t('site.nav.signIn')}</Button></>}
        </div>
        <div className="mt-8 flex gap-2" role="group" aria-label={t('shell.language')}>
          {locales.map(l => (
            <button key={l.id} type="button" onClick={() => setLocale(l.id)} aria-pressed={locale === l.id} title={l.label}
              className={cx('h-10 rounded-full border px-4 text-sm font-semibold transition', locale === l.id ? 'border-brand text-brand' : 'border-line hover:bg-surface')}>
              {l.short}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="mt-auto border-t border-line pt-14">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-10 px-4 pb-10 md:px-12">
        <div>
          <Logo />
          <p className="mt-3 text-muted">{t('site.footer.tagline')}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-14 gap-y-2 text-[15px] font-semibold text-muted sm:grid-cols-3">
          <Link href="/#about" className="hover:text-ink">{t('site.nav.about')}</Link>
          <Link href="/courses" className="hover:text-ink">{t('site.nav.courses')}</Link>
          <Link href="/coaching" className="hover:text-ink">{t('site.nav.organisations')}</Link>
          <Link href="/#pillars" className="hover:text-ink">{t('site.nav.whatWeDo')}</Link>
          <Link href="/verify" className="hover:text-ink">{t('site.nav.verify')}</Link>
          <Link href="/register" className="hover:text-ink">{t('site.nav.join')}</Link>
        </div>
      </div>
      <div className="overflow-hidden leading-[0.8]" aria-hidden="true">
        <div className="select-none text-center font-display text-[26vw] font-extrabold tracking-[-0.06em] text-brand opacity-10">SHAPE</div>
      </div>
      <div className="mx-auto max-w-6xl px-4 md:px-12">
        <div className="flex items-center justify-between border-t border-line py-5 text-sm text-muted">
          <span>© {new Date().getFullYear()} SHAPE Potential Africa CBC</span>
          <a href="#top" aria-label={t('site.footer.backToTop')} className="grid size-10 place-items-center rounded-full border border-line hover:bg-surface"><ArrowUp size={18} /></a>
        </div>
      </div>
    </footer>
  );
}

export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div id="top" className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 pt-20">{children}</main>
      <SiteFooter />
    </div>
  );
}
