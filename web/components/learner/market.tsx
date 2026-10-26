'use client';

import { Apple, Carrot, Coffee, Egg, MapPin, Milk, Wheat } from 'lucide-react';
import type { ListingCategory, MarketListing } from '@/lib/api/services/core/agrimarket';
import { useT } from '@/lib/i18n';
import { cx, date, rwf } from '@/lib/format';

export const CATEGORIES: ListingCategory[] = ['Vegetables', 'Fruits', 'Grains', 'Dairy', 'Poultry', 'Coffee & Tea'];
export const UNITS = ['kg', 'tonne', 'piece', 'bunch', 'litre', 'tray', 'bag'];
export const LOCATIONS = ['Kigali', 'Bugesera', 'Rwamagana', 'Nyagatare', 'Gicumbi', 'Huye', 'Musanze', 'Rubavu', 'Kicukiro', 'Other'];

export const categoryKey = (c: ListingCategory) => `learner.market.cat.${c.toLowerCase().replace(/[^a-z]+/g, '_')}`;
export const unitKey = (u: string) => `learner.market.unit.${u}`;

export const categoryIcon: Record<ListingCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  Vegetables: Carrot, Fruits: Apple, Grains: Wheat, Dairy: Milk, Poultry: Egg, 'Coffee & Tea': Coffee,
};
const categoryTone: Record<ListingCategory, string> = {
  Vegetables: 'bg-brand', Fruits: 'bg-ok', Grains: 'bg-gold', Dairy: 'bg-info', Poultry: 'bg-gold', 'Coffee & Tea': 'bg-brand-dark',
};

/** Placeholder until listing photos are stored: a solid pillar-style block with the category icon. */
export function ListingImage({ category, className }: { category: ListingCategory; className?: string }) {
  const Icon = categoryIcon[category];
  return (
    <div className={cx('grid place-items-center text-white', categoryTone[category], className)} aria-hidden>
      <span className="grid size-14 place-items-center rounded-2xl bg-white/15"><Icon size={28} /></span>
    </div>
  );
}

export function ListingMeta({ l }: { l: Pick<MarketListing, 'pricePerUnit' | 'unit' | 'location' | 'quantity' | 'seller' | 'postedAt'> }) {
  const t = useT();
  return (
    <>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-xl font-bold">{rwf(l.pricePerUnit)}</span>
        <span className="text-sm text-muted">{t('learner.market.per', { unit: t(unitKey(l.unit)) })}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1"><MapPin size={14} className="text-brand" />{l.location}</span>
        <span>{t('learner.market.available', { qty: l.quantity })}</span>
      </div>
      <div className="mt-1 text-sm text-subtle">{l.seller} · {date(l.postedAt)}</div>
    </>
  );
}
