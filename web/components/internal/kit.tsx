'use client';

// Small shared pieces for the staff portals.

import { Compass, Cpu, Eye, GraduationCap, Lock, Rocket, Search, Sprout } from 'lucide-react';
import { Badge, Button, type Tone } from '@/components/ui';
import { Modal } from '@/components/ui/client';
import { pillarById } from '@/lib/mock/data';
import { useSession } from '@/lib/session';
import type { PillarId } from '@/lib/types';
import { cx } from '@/lib/format';

export const pillarIcon: Record<PillarId, React.ComponentType<{ size?: number; className?: string }>> = {
  technology: Cpu,
  education: GraduationCap,
  leadership: Compass,
  young_startups: Rocket,
  agriculture: Sprout,
};

export function PillarChip({ pillarId, className }: { pillarId: PillarId; className?: string }) {
  const Icon = pillarIcon[pillarId];
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-ink', className)}>
      <Icon size={15} className="text-brand" /> {pillarById[pillarId].name} pillar
    </span>
  );
}

export function ReadOnlyBadge() {
  return <Badge tone="info"><Eye size={13} aria-hidden /> Read-only</Badge>;
}

/** Pillar of the signed-in Pillar Representative. */
export function useRepPillar() {
  const { user } = useSession();
  const pillarId: PillarId = user?.pillarId ?? 'technology';
  return { user, pillarId, pillar: pillarById[pillarId] };
}

export function ScopeNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cx('flex items-start gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-muted', className)}>
      <Lock size={16} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function ConfirmModal({ open, title, children, confirmLabel, danger, onConfirm, onClose, disabled }: {
  open: boolean; title: string; children: React.ReactNode; confirmLabel: string; danger?: boolean; disabled?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} disabled={disabled} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
      </>}>
      <div className="text-muted">{children}</div>
    </Modal>
  );
}

export function SearchInput({ value, onChange, label, placeholder, className }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; className?: string }) {
  return (
    <label className={cx('relative block', className)}>
      <span className="sr-only">{label}</span>
      <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" aria-hidden />
      <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? label}
        className="h-11 w-full rounded-full border border-line bg-bg pl-11 pr-4 text-[15px] text-ink placeholder:text-subtle transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />
    </label>
  );
}

/** Compact labelled select for filter bars. */
export function FilterSelect({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <label className={cx('flex items-center gap-2 text-sm', className)}>
      <span className="font-semibold text-muted">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="h-11 min-w-0 flex-1 rounded-full border border-line bg-bg px-4 text-[15px] text-ink focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 sm:flex-none">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Toggle switch with a visible label. */
export function Switch({ checked, onChange, label, description, id, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; id?: string; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div id={id ? `${id}-label` : undefined} className="font-semibold">{label}</div>
        {description && <div className="text-sm text-muted">{description}</div>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id ? `${id}-label` : undefined} aria-label={id ? undefined : label}
        onClick={() => onChange(!checked)} disabled={disabled}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50', checked ? 'bg-ok' : 'bg-surface-2 ring-1 ring-inset ring-line')}>
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
  const csv = rows.map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const roleTone: Record<string, Tone> = {
  beneficiary: 'neutral', org_client: 'info', pillar_rep: 'brand', judge_mentor: 'gold', executive_admin: 'ok', board_auditor: 'info', system: 'neutral',
};

export function HeaderMeta({ children }: { children: React.ReactNode }) {
  return <span className="mt-3 flex flex-wrap items-center gap-2">{children}</span>;
}
