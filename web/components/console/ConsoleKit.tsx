'use client';

// Small helpers shared by the Pillar Representative console and the grading terminal.

import { Lock } from 'lucide-react';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/client';
import { PillarTag } from '@/components/dash';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import type { PillarId } from '@/lib/types';

/** Pillar of the signed-in Pillar Representative. */
export function useRepPillar(): PillarId {
  const { user } = useSession();
  return user?.pillarId ?? 'technology';
}

/** PageHead meta: which pillar the data is scoped to. */
export function PillarScope({ pillarId }: { pillarId: PillarId }) {
  const t = useT();
  return (
    <>
      <PillarTag id={pillarId} label={t(`pillar.${pillarId}`)} />
      <span className="inline-flex items-center gap-1 text-muted"><Lock size={13} aria-hidden /> {t('console.scope.only')}</span>
    </>
  );
}

/** `2026-Q4` to `Q4 2026` */
export const quarterLabel = (q: string) => {
  const [y, n] = q.split('-');
  return `${n} ${y}`;
};

export const CURRENT_QUARTER = '2026-Q4';

export function ConfirmDialog({ open, title, children, confirmLabel, danger, busy, onConfirm, onClose }: {
  open: boolean; title: string; children: React.ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t('ui.cancel')}</Button>
        <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      <div className="text-muted">{children}</div>
    </Modal>
  );
}

/** Inline error under a form or inside a modal. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl bg-brand-light px-3 py-2 text-sm font-semibold text-brand-dark dark:bg-brand/20 dark:text-[#ffb59a]">{message}</p>;
}
