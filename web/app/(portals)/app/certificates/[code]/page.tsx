'use client';

import { useParams } from 'next/navigation';
import { Link2, Printer } from 'lucide-react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { ErrorState, PageHead, Panel, Skeleton } from '@/components/dash';
import { PrintStyles } from '@/components/learner/bits';
import { CertificateCard, copyVerifyLink } from '@/components/learner/CertificateCard';
import { ApiError } from '@/lib/api/http';
import { useApi } from '@/lib/api/hooks';
import { certificates } from '@/lib/api/services';
import { useT } from '@/lib/i18n';

export default function CertificatePrint() {
  const t = useT();
  const { code } = useParams<{ code: string }>();
  const cert = useApi(() => certificates.getMine({ params: { code } }), [code]);
  const { toast, toastNode } = useToast();
  const crumbs = [{ href: '/app/certificates', label: t('learner.certs.title') }];

  if (cert.error) {
    const missing = cert.error instanceof ApiError && cert.error.status === 404;
    return (
      <>
        <PageHead title={t('learner.certs.notFound')} crumbs={crumbs} />
        {missing
          ? <Panel><div className="py-8 text-center"><Button href="/app/certificates">{t('learner.certs.back')}</Button></div></Panel>
          : <ErrorState error={cert.error} onRetry={cert.reload} />}
      </>
    );
  }
  if (!cert.data) return <><Skeleton className="mb-8 h-9 w-1/2" /><Skeleton className="mx-auto aspect-[1.414] max-w-4xl rounded-[var(--radius-card)]" /></>;

  const c = cert.data;
  const copy = async () => toast((await copyVerifyLink(c.code)) ? t('learner.certs.copied') : `/verify/${c.code}`);

  return (
    <>
      <PrintStyles />
      <style>{`@media print { @page { size: A4 landscape; } }`}</style>
      <div className="no-print">
        <PageHead title={c.courseTitle} crumbs={[...crumbs, { label: c.code }]}
          actions={<>
            <Button onClick={() => window.print()}><Printer size={18} /> {t('learner.certs.printPdf')}</Button>
            <Button variant="ghost" onClick={copy}><Link2 size={18} /> {t('learner.certs.copyLink')}</Button>
          </>} />
      </div>
      <CertificateCard cert={c} size="full" className="print-sheet mx-auto max-w-4xl" />
      <p className="no-print mt-4 text-center text-sm text-muted">{t('learner.certs.verifyAt', { path: `/verify/${c.code}` })}</p>
      {toastNode}
    </>
  );
}
