'use client';

// Sell produce. Works offline: the listing is kept on the device and uploaded from the market page.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CloudOff, ImagePlus, Wifi, X } from 'lucide-react';
import { Button, Field, Input, Select } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { PageHead, Panel } from '@/components/dash';
import { CATEGORIES, LOCATIONS, ListingImage, ListingMeta, categoryKey, unitKey, UNITS } from '@/components/learner/market';
import { offlineListings, useOnline } from '@/components/learner/offline';
import { errorMessage } from '@/lib/api/hooks';
import { agrimarket } from '@/lib/api/services';
import type { ListingCategory, NewListing } from '@/lib/api/services/core/agrimarket';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { cx } from '@/lib/format';

export default function NewListingPage() {
  const t = useT();
  const router = useRouter();
  const { user } = useSession();
  const { toast, toastNode } = useToast();
  const [online, setOnline] = useOnline();
  const photoInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: '', category: 'Vegetables' as ListingCategory, quantity: '', unit: 'kg', price: '', location: 'Kigali' });
  const set = (k: keyof typeof f, v: string) => setF(x => ({ ...x, [k]: v }));

  const errors: Record<string, string> = {};
  if (!f.title.trim()) errors.title = t('learner.market.err.title');
  if (!f.quantity || Number(f.quantity) <= 0) errors.quantity = t('learner.market.err.quantity');
  if (!f.price || Number(f.price) <= 0) errors.price = t('learner.market.err.price');
  const e = (k: string) => (tried ? errors[k] : undefined);

  const body: NewListing = { title: f.title.trim(), category: f.category, quantity: Number(f.quantity) || 0, unit: f.unit, pricePerUnit: Number(f.price) || 0, location: f.location };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) return;
    if (!online) {
      offlineListings.add(body);
      toast(t('learner.market.savedOffline'));
      setTimeout(() => router.push('/app/market'), 1200);
      return;
    }
    setBusy(true);
    try {
      await agrimarket.createListing({ body });
      toast(t('learner.market.live'));
      setTimeout(() => router.push('/app/market'), 700);
    } catch (err) {
      toast(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title={t('learner.market.sellTitle')} crumbs={[{ href: '/app/market', label: t('nav.market') }, { label: t('learner.market.sell') }]} />

      <div className={cx('mb-6 flex flex-col gap-3 rounded-[var(--radius-card)] border bg-bg p-4 sm:flex-row sm:items-center sm:justify-between', online ? 'border-line' : 'border-gold/50')} aria-live="polite">
        <div className="flex items-center gap-3 text-[15px]">
          {online ? <Wifi size={18} className="text-ok" /> : <CloudOff size={18} className="text-brand" />}
          {online ? t('learner.market.onlineNote') : t('learner.market.offlineNote')}
        </div>
        <button type="button" onClick={() => setOnline(!online)} className="self-start text-sm font-semibold text-brand hover:underline sm:self-auto">
          {online ? t('learner.market.tryOffline') : t('learner.market.backOnline')}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel>
          <form onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label={t('learner.market.what')} htmlFor="t" error={e('title')}>
                <Input id="t" value={f.title} onChange={x => set('title', x.target.value)} placeholder={t('learner.market.whatPlaceholder')} />
              </Field>
            </div>
            <Field label={t('learner.market.category')} htmlFor="c">
              <Select id="c" value={f.category} onChange={x => set('category', x.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{t(categoryKey(c))}</option>)}
              </Select>
            </Field>
            <Field label={t('learner.market.location')} htmlFor="loc">
              <Select id="loc" value={f.location} onChange={x => set('location', x.target.value)}>
                {LOCATIONS.map(c => <option key={c} value={c}>{c === 'Other' ? t('learner.market.otherPlace') : c}</option>)}
              </Select>
            </Field>
            <Field label={t('learner.market.quantity')} htmlFor="q" error={e('quantity')}>
              <Input id="q" type="number" inputMode="decimal" min={0} value={f.quantity} onChange={x => set('quantity', x.target.value)} />
            </Field>
            <Field label={t('learner.market.unit')} htmlFor="u">
              <Select id="u" value={f.unit} onChange={x => set('unit', x.target.value)}>
                {UNITS.map(c => <option key={c} value={c}>{t(unitKey(c))}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('learner.market.price', { unit: t(unitKey(f.unit)) })} htmlFor="p" error={e('price')}>
                <Input id="p" type="number" inputMode="numeric" min={0} step={50} value={f.price} onChange={x => set('price', x.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold">{t('learner.market.photo')} <span className="font-normal text-subtle">{t('learner.market.optional')}</span></span>
              {photo ? (
                <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
                  <span className="grid size-12 place-items-center rounded-xl bg-surface text-brand"><Camera size={20} /></span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{photo}</span>
                  <button type="button" aria-label={t('learner.market.removePhoto')} onClick={() => setPhoto(null)} className="grid size-9 place-items-center rounded-full hover:bg-surface"><X size={16} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => photoInput.current?.click()}
                  className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-line px-4 py-6 text-center transition hover:bg-surface">
                  <ImagePlus size={24} className="text-brand" />
                  <span className="mt-2 text-[15px] font-semibold">{t('learner.market.addPhoto')}</span>
                  <span className="text-sm text-muted">{t('learner.market.photoHint')}</span>
                </button>
              )}
              <input ref={photoInput} type="file" accept="image/*" capture="environment" className="sr-only" aria-label={t('learner.market.addPhoto')}
                onChange={x => { const file = x.target.files?.[0]; if (file) setPhoto(file.name); }} />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy}>{online ? t('learner.market.publish') : t('learner.market.saveLater')}</Button>
              <Button variant="ghost" href="/app/market">{t('ui.cancel')}</Button>
            </div>
          </form>
        </Panel>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-2 text-sm font-semibold text-muted">{t('learner.market.preview')}</div>
          <article className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-bg">
            <ListingImage category={f.category} className="h-36" />
            <div className="p-5">
              <h2 className="text-lg font-bold">{f.title || t('learner.market.yourProduce')}</h2>
              <div className="mt-2">
                <ListingMeta l={{ pricePerUnit: Number(f.price) || 0, unit: f.unit, location: f.location === 'Other' ? t('learner.market.otherPlace') : f.location, quantity: `${f.quantity || 0} ${t(unitKey(f.unit))}`, seller: user?.name ?? '', postedAt: new Date().toISOString().slice(0, 10) }} />
              </div>
            </div>
          </article>
        </aside>
      </div>
      {toastNode}
    </>
  );
}
