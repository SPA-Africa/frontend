'use client';

import Link from 'next/link';
import { Award, Link2, Printer } from 'lucide-react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { Async, PageHead, Panel, Skeleton, StatusPill } from '@/components/dash';
import { CertificateCard, copyVerifyLink } from '@/components/learner/CertificateCard';
import { useApi } from '@/lib/api/hooks';
import { certificates } from '@/lib/api/services';
import { useT } from '@/lib/i18n';
import { date } from '@/lib/format';

export default function CertificatesPage() {
  const t = useT();
  const certs = useApi(() => certificates.listMine(), []);
  const { toast, toastNode } = useToast();

  const copy = async (code: string) => toast((await copyVerifyLink(code)) ? t('learner.certs.copied') : `/verify/${code}`);

  return (
    <>
      <PageHead title={t('learner.certs.title')} />
      <Async state={certs}
        skeleton={<div className="grid gap-6 md:grid-cols-2">{[0, 1].map(i => <Skeleton key={i} className="h-80 rounded-[var(--radius-card)]" />)}</div>}
        empty={d => d.length === 0}
        emptyView={
          <Panel>
            <div className="flex flex-col items-center py-8 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-gold-light text-[#8a5a0c] dark:bg-gold/20 dark:text-gold"><Award size={22} /></span>
              <p className="mt-3 font-semibold">{t('learner.home.noCertificates')}</p>
              <Button className="mt-4" href="/app/courses">{t('learner.certs.goToCourses')}</Button>
            </div>
          </Panel>
        }>
        {data => (
          <div className="grid gap-6 md:grid-cols-2">
            {data.map(c => (
              <article key={c.code} className="flex flex-col rounded-[var(--radius-card)] border border-line bg-bg p-3">
                <Link href={`/app/certificates/${c.code}`} aria-label={t('learner.certs.open', { title: c.courseTitle })} className="block rounded-[var(--radius-card)] transition hover:opacity-90">
                  <CertificateCard cert={c} className="border-none" />
                </Link>
                <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-2 pt-3">
                  <div className="min-w-0">
                    <h2 className="font-bold">{c.courseTitle}</h2>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted">{date(c.issuedAt)} <StatusPill status={c.status} /></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button href={`/app/certificates/${c.code}`} size="sm"><Printer size={15} /> {t('learner.certs.print')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => copy(c.code)}><Link2 size={15} /> {t('learner.certs.copyLink')}</Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Async>
      {toastNode}
    </>
  );
}
