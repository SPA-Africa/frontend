'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Avatar, Button, Divider, Field, Input } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { API_MODE } from '@/lib/api/config';
import { errorMessage } from '@/lib/api/hooks';
import { identity } from '@/lib/api/services';
import { homeFor, useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import type { Role } from '@/lib/types';
import { isEmail, isPhone } from './options';

const roles: Role[] = ['beneficiary', 'org_client', 'pillar_rep', 'judge_mentor', 'executive_admin', 'board_auditor'];

// only allow same-site paths as a redirect target
export const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8C3.9 20.5 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.2c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7H2.1C1.4 8.5 1 10.2 1 12s.4 3.5 1.1 5l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 3.9 3.5 2.1 7l3.7 2.8c.9-2.6 3.3-4.4 6.2-4.4z" />
    </svg>
  );
}

export function LoginForm() {
  const t = useT();
  const { signIn, acceptAuth } = useSession();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; form?: string }>({});
  const { toast, toastNode } = useToast();

  const go = (role: Role) => router.push(next ?? homeFor[role]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!identifier.trim()) errs.identifier = t('public.auth.err.identifierRequired');
    else if (!isEmail(identifier) && !isPhone(identifier)) errs.identifier = t('public.auth.err.identifierInvalid');
    if (!password) errs.password = t('public.auth.err.passwordRequired');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const user = acceptAuth(await identity.login({ body: { identifier: identifier.trim(), password } }));
      go(user.role);
    } catch (err) {
      setErrors({ form: errorMessage(err) });
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="text-[clamp(32px,4vw,44px)] font-bold leading-tight">{t('public.auth.signIn')}</h1>
      <p className="mt-2 text-muted">
        {t('public.auth.newHere')} <Link href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="font-semibold text-brand hover:underline">{t('public.auth.createAccount')}</Link>
      </p>

      <Button variant="ghost" size="lg" className="mt-8 w-full" type="button" onClick={() => toast(t('public.auth.googleUnavailable'))}>
        <GoogleMark /> {t('public.auth.google')}
      </Button>

      <div className="my-6"><Divider label={t('public.auth.orEmail')} /></div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {errors.form && <p role="alert" className="rounded-2xl bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark dark:bg-brand/15 dark:text-brand-light">{errors.form}</p>}
        <Field label={t('public.auth.identifier')} htmlFor="login-email" error={errors.identifier}>
          <Input id="login-email" type="text" autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="you@example.com" aria-invalid={!!errors.identifier} />
        </Field>
        <Field label={t('public.auth.password')} htmlFor="login-password" error={errors.password}>
          <div className="relative">
            <Input id="login-password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="pr-12" aria-invalid={!!errors.password} />
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? t('public.auth.hidePassword') : t('public.auth.showPassword')} aria-pressed={show}
              className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? t('public.auth.signingIn') : t('public.auth.signIn')} <ArrowRight size={18} aria-hidden="true" /></Button>
      </form>

      {API_MODE === 'mock' && (
        <section aria-labelledby="demo-accounts" className="mt-12 rounded-[var(--radius-card)] border border-dashed border-line p-5">
          <h2 id="demo-accounts" className="text-lg font-bold">{t('public.auth.demoTitle')}</h2>
          <p className="mt-1 text-sm text-muted">{t('public.auth.demoText')}</p>
          <ul className="mt-5 grid gap-2.5">
            {roles.map(r => (
              <li key={r}>
                <button type="button" onClick={() => { signIn(r); go(r); }}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-bg p-3.5 text-left transition hover:border-brand/35 hover:bg-surface">
                  <Avatar name={identity.demoSignIn(r).user.name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t(`role.${r}`)}</span>
                    <span className="block text-sm text-muted">{t(`public.auth.blurb.${r}`)}</span>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" className="shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-brand" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {toastNode}
    </>
  );
}
