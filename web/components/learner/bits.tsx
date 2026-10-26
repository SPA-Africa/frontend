// Small shared pieces for the learner portal. ProgressRing, BackLink and PrintStyles are also used by the org portal.

import Link from 'next/link';
import { BookOpenText, ChevronLeft, FileText, HelpCircle, PlayCircle } from 'lucide-react';
import type { LessonType } from '@/lib/types';
import { cx, dateLocale, fmtDate } from '@/lib/format';

export const lessonIcon: Record<LessonType, React.ComponentType<{ size?: number; className?: string }>> = {
  video: PlayCircle, reading: BookOpenText, pdf: FileText, quiz: HelpCircle,
};

/* ---------- progress ring ---------- */
export function ProgressRing({ value, size = 64, stroke = 6, label, className }: { value: number; size?: number; stroke?: number; label?: React.ReactNode; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cx('relative grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}
      role="img" aria-label={`${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-2" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className={cx('transition-[stroke-dashoffset] duration-700', v >= 1 ? 'stroke-ok' : 'stroke-brand')}
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
      </svg>
      <span className="absolute font-display text-sm font-bold">{label ?? `${Math.round(v * 100)}%`}</span>
    </div>
  );
}

/* ---------- print styles (hide portal chrome) ---------- */
export function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { margin: 14mm; }
        body { background: #fff !important; }
        header.sticky, aside.sticky, .no-print { display: none !important; }
        main { padding: 0 !important; }
        .print-sheet { border: none !important; box-shadow: none !important; margin: 0 !important; max-width: none !important; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `}</style>
  );
}

/* ---------- QR-like placeholder ---------- */
export function QrPlaceholder({ seed, size = 84, label }: { seed: string; size?: number; label?: string }) {
  const n = 11;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) { h = (h * 1103515245 + 12345) >>> 0; cells.push(((h >> 16) & 1) === 1); }
  const finder = (x: number, y: number) => (x < 3 && y < 3) || (x > n - 4 && y < 3) || (x < 3 && y > n - 4);
  return (
    <div className="grid rounded-md bg-bg p-1.5 ring-1 ring-line" style={{ width: size, height: size, gridTemplateColumns: `repeat(${n}, 1fr)` }} aria-label={label} role="img">
      {cells.map((on, i) => {
        const x = i % n, y = Math.floor(i / n);
        return <span key={i} className={finder(x, y) || on ? 'bg-ink' : ''} />;
      })}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="no-print mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
      <ChevronLeft size={16} aria-hidden="true" /> {children}
    </Link>
  );
}

/* ---------- switch ---------- */
export function Switch({ checked, onChange, label, description, id, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; id: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <label htmlFor={id} className={cx('font-semibold', disabled ? 'text-muted' : 'cursor-pointer')}>{label}</label>
        {description && <p id={`${id}-d`} className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled} onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50', checked ? 'bg-brand' : 'bg-surface-2 ring-1 ring-line')}>
        <span className={cx('absolute top-1 size-5 rounded-full bg-bg shadow transition-all', checked ? 'left-6' : 'left-1')} />
      </button>
    </div>
  );
}

/** Local time like 18:00 */
export const timeOf = (iso: string) => fmtDate(new Date(iso), { hour: '2-digit', minute: '2-digit' });
