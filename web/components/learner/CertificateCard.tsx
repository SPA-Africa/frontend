'use client';

import Image from 'next/image';
import type { Certificate } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { cx, date } from '@/lib/format';
import { QrPlaceholder } from './bits';

/** A certificate laid out like the printed document. `size="full"` is used on the printable page. */
export function CertificateCard({ cert, size = 'card', className }: { cert: Certificate; size?: 'card' | 'full'; className?: string }) {
  const t = useT();
  const full = size === 'full';
  const revoked = cert.status === 'revoked';
  return (
    <div className={cx('relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-bg', full ? 'p-6 sm:p-12' : 'p-5 sm:p-7', className)}>
      <div className={cx('pointer-events-none absolute rounded-2xl border-2 border-gold/60', full ? 'inset-3 sm:inset-5' : 'inset-2.5')} aria-hidden />
      <div className={cx('pointer-events-none absolute rounded-xl border border-gold/30', full ? 'inset-4.5 sm:inset-7' : 'inset-4')} aria-hidden />

      <div className={cx('relative flex flex-col items-center text-center', revoked && 'opacity-60')}>
        <Image src="/logo.png" alt="SHAPE Potential Africa" width={3722} height={1364} className={full ? 'h-12 w-auto sm:h-14' : 'h-8 w-auto'} />
        <div className={cx('mt-4 font-display font-semibold text-muted', full ? 'text-lg' : 'text-sm')}>{t('learner.cert.heading')}</div>
        <p className={cx('text-muted', full ? 'mt-6 text-base' : 'mt-3 text-xs')}>{t('learner.cert.certifies')}</p>
        <div className={cx('font-display font-bold tracking-tight', full ? 'mt-2 text-4xl sm:text-5xl' : 'mt-1 text-2xl')}>{cert.holder}</div>
        <span className={cx('block h-0.5 rounded bg-gold', full ? 'mt-4 w-40' : 'mt-2 w-20')} aria-hidden />
        <p className={cx('text-muted', full ? 'mt-5 text-base' : 'mt-3 text-xs')}>{t('learner.cert.completed')}</p>
        <div className={cx('font-display font-bold text-brand', full ? 'mt-2 text-2xl sm:text-3xl' : 'mt-1 text-base leading-snug')}>{cert.courseTitle}</div>
        <p className={cx('text-muted', full ? 'mt-2' : 'mt-1 text-xs')}>{t('learner.cert.pillar', { pillar: t(`pillar.${cert.pillarId}`) })}</p>

        <div className={cx('flex w-full items-end justify-between gap-4 text-left', full ? 'mt-12' : 'mt-6')}>
          <div className={full ? 'text-sm' : 'text-[11px]'}>
            <div className="text-subtle">{t('learner.cert.issued')}</div>
            <div className="font-semibold">{date(cert.issuedAt)}</div>
            <div className="mt-2 text-subtle">{t('learner.cert.code')}</div>
            <div className="font-mono font-semibold">{cert.code}</div>
          </div>
          {full && (
            <div className="hidden text-center text-sm sm:block">
              <div className="mb-1 font-display text-xl font-semibold">{t('role.executive_admin')}</div>
              <div className="w-44 border-t border-line pt-1 text-subtle">SHAPE Potential Africa</div>
            </div>
          )}
          <div className="flex flex-col items-center gap-1">
            <QrPlaceholder seed={cert.code} size={full ? 96 : 64} label={t('learner.cert.scan')} />
            <span className={cx('text-subtle', full ? 'text-xs' : 'text-[10px]')}>{t('learner.cert.scan')}</span>
          </div>
        </div>
      </div>

      {revoked && (
        <div className="absolute inset-0 grid place-items-center" aria-label={t('learner.cert.revokedLabel')}>
          <span className="-rotate-12 rounded-xl border-2 border-brand bg-bg px-4 py-1 font-display text-2xl font-bold text-brand">{t('status.revoked')}</span>
        </div>
      )}
    </div>
  );
}

/** Copy the public verification link, falling back to showing the path. */
export async function copyVerifyLink(code: string) {
  const url = `${window.location.origin}/verify/${code}`;
  try { await navigator.clipboard.writeText(url); return true; } catch { return false; }
}
