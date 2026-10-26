// Course thumbnails and the welcome banner. Both use the Africa silhouette from the logo as the
// only motif, so they read as SPA rather than stock decoration.

import { cx } from '@/lib/format';
import type { PillarId } from '@/lib/types';
import { AfricaMark, pillarColor, pillarIcon } from './primitives';

export function CourseCover({ pillarId, program, level, className, size = 'md' }: {
  pillarId: PillarId; program: string; level?: string; className?: string; size?: 'sm' | 'md';
}) {
  const Icon = pillarIcon[pillarId];
  return (
    <div className={cx('relative isolate overflow-hidden text-white', size === 'sm' ? 'aspect-[4/3] rounded-xl' : 'aspect-[16/9] rounded-2xl', className)}
      style={{ backgroundColor: pillarColor[pillarId] }}>
      <AfricaMark className="absolute -bottom-[18%] -right-[6%] -z-10 h-[125%] w-auto opacity-25" color="#fff" step={3} dot={0.0055} />
      <div className={cx('flex h-full flex-col justify-between', size === 'sm' ? 'p-3' : 'p-4')}>
        <span className={cx('grid place-items-center rounded-xl bg-white/15 backdrop-blur-[2px]', size === 'sm' ? 'size-8' : 'size-10')}>
          <Icon size={size === 'sm' ? 16 : 20} strokeWidth={2.2} />
        </span>
        {size === 'md' && (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-white/85">{program}</div>
            {level && <div className="text-xs text-white/70">{level}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export function WelcomeBanner({ title, text, actions, aside, className }: {
  title: string; text?: React.ReactNode; actions?: React.ReactNode; aside?: React.ReactNode; className?: string;
}) {
  return (
    <section className={cx('relative isolate overflow-hidden rounded-[var(--radius-card)] bg-brand px-6 py-7 text-white md:px-8 md:py-8', className)}>
      <AfricaMark className="absolute -right-6 top-1/2 -z-10 hidden h-[150%] w-auto -translate-y-1/2 opacity-[0.18] sm:block" color="#fff" step={3} dot={0.005} />
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <h1 className="text-[28px] font-bold leading-tight md:text-[32px]">{title}</h1>
          {text && <div className="mt-2 text-white/85">{text}</div>}
          {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
        </div>
        {aside}
      </div>
    </section>
  );
}
