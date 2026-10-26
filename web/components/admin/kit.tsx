'use client';

// Small pieces shared by the Executive Office and Board pages. Kept here instead of the shared
// dash kit so other portals are unaffected.

import { Eye } from 'lucide-react';
import { Badge, Button, type Tone } from '@/components/ui';
import { Modal } from '@/components/ui/client';
import { useT } from '@/lib/i18n';
import { cx, dateLocale, fmtDate } from '@/lib/format';

/** "2026-Q3" -> "Q3 2026" */
export const quarterLabel = (q: string) => {
  const [y, n] = q.split('-');
  return `${n} ${y}`;
};

export const dateTime = (iso: string) =>
  fmtDate(new Date(iso), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const roleTone: Record<string, Tone> = {
  beneficiary: 'neutral', org_client: 'info', pillar_rep: 'brand', judge_mentor: 'gold', executive_admin: 'ok', board_auditor: 'info', system: 'neutral',
};

export function ReadOnlyPill() {
  const t = useT();
  return <Badge tone="info"><Eye size={13} aria-hidden /> {t('ui.readOnly')}</Badge>;
}

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

/** Toggle switch with a visible label. */
export function Toggle({ checked, onChange, label, description, id, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; id: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div id={`${id}-label`} className="font-semibold">{label}</div>
        {description && <div id={`${id}-desc`} className="text-sm text-muted">{description}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-label`} aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => onChange(!checked)} disabled={disabled}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:opacity-50',
          checked ? 'bg-ok' : 'bg-surface-2 ring-1 ring-inset ring-line')}>
        <span className={cx('absolute top-1 size-5 rounded-full bg-white shadow transition-[left]', checked ? 'left-6' : 'left-1')} />
      </button>
    </div>
  );
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(['﻿' + rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Compact stat used inside panels (not a KPI tile). */
export function MiniStat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'ok' | 'brand' }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface px-4 py-3">
      <div className="text-sm text-muted">{label}</div>
      <div className={cx('mt-0.5 font-display text-xl font-bold tabular-nums', tone === 'ok' && 'text-ok', tone === 'brand' && 'text-brand')}>{value}</div>
    </div>
  );
}
