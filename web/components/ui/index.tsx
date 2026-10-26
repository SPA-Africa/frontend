// Shared UI kit. Same visual language as the landing page:
// white surfaces, logo red for actions, gold for small details, soft 20px cards.

import Link from 'next/link';
import Image from 'next/image';
import { cx } from '@/lib/format';
import { OptionalTag } from './client';

/* ---------- Logo ---------- */
export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} aria-label="SHAPE Potential Africa home" className={cx('inline-flex shrink-0', className)}>
      <Image src="/logo.png" alt="SHAPE Potential Africa" width={3722} height={1364} priority className="h-9 w-auto" />
    </Link>
  );
}

/* ---------- Button ---------- */
type ButtonVariant = 'primary' | 'ghost' | 'subtle' | 'danger' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonBase = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark hover:-translate-y-px',
  ghost: 'border border-line text-ink hover:bg-surface',
  subtle: 'bg-surface text-ink hover:bg-surface-2',
  danger: 'bg-transparent border border-brand/30 text-brand hover:bg-brand-light',
  link: 'text-brand hover:text-brand-dark px-0! underline-offset-4 hover:underline',
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13 px-7 text-base',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; href?: undefined };
type LinkButtonProps = { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: React.ReactNode };

export function Button(props: ButtonProps | LinkButtonProps) {
  const { variant = 'primary', size = 'md', className, children } = props;
  if (props.href !== undefined) {
    return <Link href={props.href} className={buttonClass(variant, size, className)}>{children}</Link>;
  }
  const { variant: _v, size: _s, className: _c, ...rest } = props as ButtonProps;
  return <button {...rest} className={buttonClass(variant, size, className)}>{children}</button>;
}

/* ---------- Card ---------- */
export function Card({ className, children, as: As = 'div', ...rest }: React.HTMLAttributes<HTMLElement> & { as?: 'div' | 'article' | 'section' }) {
  return <As {...rest} className={cx('rounded-[var(--radius-card)] border border-line bg-bg p-6', className)}>{children}</As>;
}

export function CardHeader({ title, action, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-bold leading-tight">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */
export type Tone = 'neutral' | 'brand' | 'gold' | 'ok' | 'info';
const toneClass: Record<Tone, string> = {
  neutral: 'bg-surface text-muted',
  brand: 'bg-brand-light text-brand-dark dark:bg-brand/20 dark:text-[#ffb59a]',
  gold: 'bg-gold-light text-[#8a5a0c] dark:bg-gold/20 dark:text-gold',
  ok: 'bg-ok-light text-ok dark:bg-ok/25 dark:text-[#8fd3a9]',
  info: 'bg-info-light text-info dark:bg-info/25 dark:text-[#9cc3e6]',
};
export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', toneClass[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- Page header (inside portals) ---------- */
export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <div className="mb-2 text-sm font-semibold text-brand">{eyebrow}</div>}
        <h1 className="text-3xl font-bold leading-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Section heading (public pages) ---------- */
export function SectionHead({ title, sub, className }: { title: string; sub?: string; className?: string }) {
  return (
    <div className={cx('mb-10 max-w-2xl md:mb-14', className)}>
      <h2 className="text-[clamp(32px,4.2vw,52px)] font-bold leading-[1.1]">{title}</h2>
      {sub && <p className="mt-3 text-lg text-muted">{sub}</p>}
    </div>
  );
}

/* ---------- Form controls ---------- */
const fieldBase = 'w-full rounded-xl border border-line bg-bg px-4 text-[15px] text-ink placeholder:text-subtle transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10';

export function Field({ label, hint, error, children, htmlFor, optional }: { label: string; hint?: string; error?: string; children: React.ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label} {optional && <OptionalTag />}
      </label>
      {children}
      {error ? <p className="text-sm text-brand">{error}</p> : hint ? <p className="text-sm text-subtle">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(fieldBase, 'h-12', className)} />;
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(fieldBase, 'min-h-28 py-3 leading-relaxed', className)} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(fieldBase, 'h-12 appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a7f75' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-3 text-[15px]', className)}>
      <input type="checkbox" {...rest} className="mt-0.5 size-5 shrink-0 accent-brand" />
      <span>{label}</span>
    </label>
  );
}

/* ---------- Progress ---------- */
export function Progress({ value, className, tone = 'brand', size = 'md' }: { value: number; className?: string; tone?: 'brand' | 'gold' | 'ok'; size?: 'sm' | 'md' }) {
  const color = tone === 'gold' ? 'bg-gold' : tone === 'ok' ? 'bg-ok' : 'bg-brand';
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-surface-2', size === 'sm' ? 'h-1.5' : 'h-2.5', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-700', color)} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

/* ---------- Stat ---------- */
export function Stat({ label, value, sub, icon, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-[var(--radius-card)] bg-surface p-5', className)}>
      <div className="flex items-center justify-between text-sm font-semibold text-muted">
        <span>{label}</span>
        {icon && <span className="text-brand">{icon}</span>}
      </div>
      <div className="mt-3 font-display text-3xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
    </div>
  );
}

/* ---------- Table ---------- */
export function Table({ head, children, className }: { head: React.ReactNode[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto rounded-[var(--radius-card)] border border-line', className)}>
      <table className="w-full min-w-[640px] text-left text-[15px]">
        <thead className="bg-surface text-sm text-muted">
          <tr>{head.map((h, i) => <th key={i} className="px-5 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={cx('px-5 py-4 align-middle', className)}>{children}</td>;

/* ---------- Empty state ---------- */
export function EmptyState({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-light text-brand">{icon}</div>}
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-brand-light font-display font-bold text-brand-dark" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

/* ---------- Pillar icon chip ---------- */
export function IconChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cx('grid size-11 shrink-0 place-items-center rounded-xl bg-brand-light text-brand dark:bg-brand/15', className)}>{children}</span>;
}

/* ---------- Divider label ---------- */
export function Divider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-subtle">
      <span className="h-px flex-1 bg-line" />
      {label}
      {label && <span className="h-px flex-1 bg-line" />}
    </div>
  );
}
