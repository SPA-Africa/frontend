'use client';

// Public certificate verification (SRS FR-A2.12). Only holder, course, pillar, date and status are shown.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Search, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { ErrorState, Skeleton } from '@/components/dash';
import { API_MODE } from '@/lib/api/config';
import { useApi } from '@/lib/api/hooks';
import { certificates } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { cx, date } from '@/lib/format';

export function VerifyForm({ initial = '' }: { initial?: string }) {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState(initial);
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) { setError(t('public.verify.empty')); return; }
    router.push(`/verify/${encodeURIComponent(c)}`);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1.5">
      <label htmlFor="cert-code" className="text-sm font-semibold">{t('public.verify.codeLabel')}</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input id="cert-code" value={code} onChange={e => { setCode(e.target.value); setError(''); }}
          placeholder="SPA-LDR-2026-0412" autoComplete="off" spellCheck={false} autoCapitalize="characters"
          aria-invalid={!!error} aria-describedby={error ? 'cert-code-error' : undefined} className="font-mono uppercase tracking-wide" />
        <Button type="submit" size="lg" className="h-12"><Search size={18} aria-hidden="true" /> {t('public.verify.check')}</Button>
      </div>
      {error && <p id="cert-code-error" className="text-sm text-brand">{error}</p>}
    </form>
  );
}

export function VerifyIntro() {
  const t = useT();
  return (
    <>
      <span className="mb-6 grid size-14 place-items-center rounded-2xl bg-brand-light text-brand dark:bg-brand/15"><ShieldCheck size={28} aria-hidden="true" /></span>
      <h1 className="text-[clamp(36px,5vw,56px)] font-bold leading-[1.05]">{t('public.verify.title')}</h1>
      <p className="mt-3 text-lg text-muted">{t('public.verify.intro')}</p>
      <div className="mt-10 rounded-[var(--radius-card)] border border-line bg-bg p-6 md:p-8">
        <VerifyForm />
        {API_MODE === 'mock' && (
          <div className="mt-6 border-t border-line pt-5 text-sm text-muted">
            <p>{t('public.verify.samples')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['SPA-LDR-2026-0412', 'SPA-AGR-2026-0057'].map(c => (
                <Link key={c} href={`/verify/${c}`} className="rounded-full bg-surface px-3 py-1.5 font-mono text-[13px] font-semibold text-ink hover:bg-surface-2">{c}</Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="mt-6 text-sm text-muted">{t('public.verify.privacy')}</p>
    </>
  );
}

export function VerifyResult({ code }: { code: string }) {
  const t = useT();
  const res = useApi(() => certificates.verify({ params: { code } }), [code]);

  const back = (
    <Link href="/verify" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
      <ArrowLeft size={16} aria-hidden="true" /> {t('public.verify.another')}
    </Link>
  );
  if (res.error) return <>{back}<ErrorState error={res.error} onRetry={res.reload} /></>;
  if (!res.data) {
    return <>{back}<div className="rounded-[var(--radius-card)] border border-line p-6 md:p-8" aria-busy="true"><Skeleton className="mb-5 size-14 rounded-2xl" /><Skeleton className="h-9 w-3/4" /><Skeleton className="mt-3 h-5 w-full" /><Skeleton className="mt-8 h-32 w-full" /></div></>;
  }

  const r = res.data;
  const look = {
    valid: { icon: <ShieldCheck size={28} aria-hidden="true" />, chip: 'bg-ok-light text-ok dark:bg-ok/25' },
    revoked: { icon: <ShieldX size={28} aria-hidden="true" />, chip: 'bg-brand-light text-brand dark:bg-brand/20' },
    not_found: { icon: <ShieldAlert size={28} aria-hidden="true" />, chip: 'bg-surface-2 text-muted' },
  }[r.status];

  return (
    <>
      {back}
      <section role="status" className="rounded-[var(--radius-card)] border border-line bg-bg p-6 md:p-8">
        <span className={cx('mb-5 grid size-14 place-items-center rounded-2xl', look.chip)}>{look.icon}</span>
        <h1 className="text-[clamp(28px,4vw,40px)] font-bold leading-tight">{t(`public.verify.${r.status}.title`)}</h1>
        <p className="mt-2 text-muted">{t(`public.verify.${r.status}.text`)}</p>
        {r.status !== 'not_found' ? (
          <dl className="mt-8 grid gap-5 rounded-2xl bg-surface p-5 sm:grid-cols-2">
            <div><dt className="text-sm text-muted">{t('public.verify.holder')}</dt><dd className="mt-0.5 font-semibold">{r.holder}</dd></div>
            <div><dt className="text-sm text-muted">{t('public.verify.course')}</dt><dd className="mt-0.5 font-semibold">{r.courseTitle}</dd></div>
            <div><dt className="text-sm text-muted">{t('public.verify.pillar')}</dt><dd className="mt-0.5 font-semibold">{r.pillarId && t(`pillar.${r.pillarId}`)}</dd></div>
            <div><dt className="text-sm text-muted">{t('public.verify.issued')}</dt><dd className="mt-0.5 font-semibold">{r.issuedAt && date(r.issuedAt)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-sm text-muted">{t('public.verify.code')}</dt><dd className="mt-0.5 break-all font-mono font-semibold">{r.code}</dd></div>
          </dl>
        ) : (
          <p className="mt-6 break-all rounded-2xl bg-surface px-4 py-3 font-mono text-sm">{r.code}</p>
        )}
      </section>
      <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-bg p-6 md:p-8">
        <h2 className="mb-4 text-lg font-bold">{t('public.verify.checkDifferent')}</h2>
        <VerifyForm initial={r.status === 'not_found' ? r.code : ''} />
      </div>
    </>
  );
}
