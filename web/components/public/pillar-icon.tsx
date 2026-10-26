import { Cpu, GraduationCap, Rocket, Sprout, Star, type LucideProps } from 'lucide-react';
import type { PillarId } from '@/lib/types';

const icons = { technology: Cpu, education: GraduationCap, leadership: Star, young_startups: Rocket, agriculture: Sprout } as const;

export function PillarIcon({ id, ...rest }: { id: PillarId } & LucideProps) {
  const Icon = icons[id];
  return <Icon aria-hidden="true" {...rest} />;
}
