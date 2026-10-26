'use client';

// Agri-market: browse produce, contact sellers, manage your listings and upload ones saved offline.

import { useState } from 'react';
import { CloudUpload, MessageCircle, Plus, Search, Store, Trash2 } from 'lucide-react';
import { Badge, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { Modal, Tabs, useToast } from '@/components/ui/client';
import { Async, PageHead, Panel, Skeleton } from '@/components/dash';
import { CATEGORIES, LOCATIONS, ListingImage, ListingMeta, categoryIcon, categoryKey } from '@/components/learner/market';
import { offlineListings, useOfflineStore, useOnline } from '@/components/learner/offline';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { agrimarket } from '@/lib/api/services';
import type { ListingCategory, MarketListing } from '@/lib/api/services/core/agrimarket';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { cx } from '@/lib/format';

type Tab = 'all' | 'mine';
const PAGE = 9;

export default function MarketPage() {
  const t = useT();
  const { user } = useSession();
  const { toast, toastNode } = useToast();
  const [online] = useOnline();
  const queued = useOfflineStore(offlineListings.all) ?? [];
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ListingCategory | ''>('');
  const [location, setLocation] = useState('');
  const [pages, setPages] = useState(1);
  const all = useApi(() => agrimarket.listListings({ query: { q: q || undefined, category: cat || undefined, location: location || undefined, pageSize: PAGE * pages } }), [q, cat, location, pages]);
  const mine = useApi(() => agrimarket.listMine(), []);
  const [contact, setContact] = useState<MarketListing | null>(null);
  const [msg, setMsg] = useState({ name: '', phone: '', text: '' });
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => { all.reload(); mine.reload(); };
  const resetPage = () => setPages(1);

  const flush = async () => {
    setBusy('flush');
    let sent = 0;
    for (const l of queued) {
      try {
        const { queueId, ...body } = l;
        await agrimarket.createListing({ body, idempotencyKey: queueId });
        offlineListings.remove(queueId);
        sent++;
      } catch (e) { toast(errorMessage(e)); break; }
    }
    setBusy(null);
    if (sent) { toast(t('learner.market.uploaded', { n: sent })); refresh(); }
  };

  const openContact = (l: MarketListing) => {
    setContact(l);
    setMsg({ name: user?.name ?? '', phone: '', text: t('learner.market.defaultMessage', { title: l.title.toLowerCase() }) });
  };
  const send = async () => {
    if (!contact || !msg.text.trim()) return;
    setBusy('send');
    try {
      await agrimarket.contactSeller({ params: { id: contact.id }, body: { name: msg.name, phone: msg.phone || undefined, text: msg.text } });
      toast(t('learner.market.sent', { seller: contact.seller }));
      setContact(null);
    } catch (e) { toast(errorMessage(e)); } finally { setBusy(null); }
  };
  const remove = async (l: MarketListing) => {
    setBusy(l.id);
    try { await agrimarket.deleteListing({ params: { id: l.id } }); toast(t('learner.market.removed')); refresh(); }
    catch (e) { toast(errorMessage(e)); } finally { setBusy(null); }
  };

  const card = (l: MarketListing) => (
    <article key={l.id} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-bg">
      <div className="relative">
        <ListingImage category={l.category} className="h-36" />
        <Badge className="absolute left-3 top-3 bg-bg! text-ink!">{t(categoryKey(l.category))}</Badge>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-bold">{l.title}</h2>
        <div className="mt-2"><ListingMeta l={l} /></div>
        <div className="mt-auto flex items-center gap-2 pt-5">
          {l.mine ? (
            <>
              <Badge tone="ok" dot>{t('learner.market.yours')}</Badge>
              <Button size="sm" variant="danger" className="ml-auto" onClick={() => remove(l)} disabled={busy === l.id}><Trash2 size={15} /> {t('learner.market.remove')}</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => openContact(l)}><MessageCircle size={16} /> {t('learner.market.contact')}</Button>
          )}
        </div>
      </div>
    </article>
  );
  const gridSkeleton = <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-80 rounded-[var(--radius-card)]" />)}</div>;

  return (
    <>
      <PageHead title={t('nav.market')} actions={<Button href="/app/market/new"><Plus size={18} /> {t('learner.market.sell')}</Button>} />

      {queued.length > 0 && (
        <Panel className="mb-6 border-gold/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px]">{t('learner.market.queued', { n: queued.length })}</p>
            <Button size="sm" disabled={!online || busy === 'flush'} onClick={flush}><CloudUpload size={16} /> {t('learner.market.uploadNow')}</Button>
          </div>
        </Panel>
      )}

      <div className="mb-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<Tab> value={tab} onChange={setTab} tabs={[
            { id: 'all', label: t('learner.market.all'), count: all.data?.total },
            { id: 'mine', label: t('learner.market.mine'), count: mine.data?.length },
          ]} />
          {tab === 'all' && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative w-full sm:w-72">
                <span className="sr-only">{t('learner.market.search')}</span>
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" />
                <Input type="search" placeholder={t('learner.market.search')} value={q} onChange={e => { setQ(e.target.value); resetPage(); }} className="pl-11" />
              </label>
              <label className="sm:w-48">
                <span className="sr-only">{t('learner.market.location')}</span>
                <Select value={location} onChange={e => { setLocation(e.target.value); resetPage(); }}>
                  <option value="">{t('learner.market.anywhere')}</option>
                  {LOCATIONS.filter(l => l !== 'Other').map(l => <option key={l}>{l}</option>)}
                </Select>
              </label>
            </div>
          )}
        </div>
        {tab === 'all' && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t('learner.market.filterCategory')}>
            {(['', ...CATEGORIES] as const).map(c => {
              const Icon = c ? categoryIcon[c] : Store;
              return (
                <button key={c || 'all'} type="button" onClick={() => { setCat(c); resetPage(); }} aria-pressed={cat === c}
                  className={cx('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition',
                    cat === c ? 'border-brand bg-brand text-white' : 'border-line bg-bg text-muted hover:text-ink')}>
                  <Icon size={15} /> {c ? t(categoryKey(c)) : t('ui.all')}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {tab === 'all' ? (
        <Async state={all} skeleton={gridSkeleton} empty={d => d.total === 0}
          emptyView={<Panel><p className="py-6 text-center text-muted">{t('learner.market.noMatch')}</p></Panel>}>
          {page => (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{page.items.map(card)}</div>
              {page.items.length < page.total && (
                <div className="mt-6 flex justify-center"><Button variant="ghost" onClick={() => setPages(n => n + 1)} disabled={all.loading}>{t('learner.courses.loadMore')}</Button></div>
              )}
            </>
          )}
        </Async>
      ) : (
        <Async state={mine} skeleton={gridSkeleton} empty={d => d.length === 0}
          emptyView={<Panel><div className="flex flex-col items-center py-6 text-center"><p className="text-muted">{t('learner.market.noneMine')}</p><Button className="mt-4" href="/app/market/new">{t('learner.market.sell')}</Button></div></Panel>}>
          {list => <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{list.map(card)}</div>}
        </Async>
      )}

      <Modal open={!!contact} onClose={() => setContact(null)} title={t('learner.market.contactTitle', { seller: contact?.seller ?? '' })}
        footer={<><Button variant="ghost" onClick={() => setContact(null)}>{t('ui.cancel')}</Button><Button onClick={send} disabled={busy === 'send' || !msg.text.trim()}>{busy === 'send' ? t('learner.market.sending') : t('learner.market.send')}</Button></>}>
        {contact && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
              <ListingImage category={contact.category} className="size-14 shrink-0 rounded-xl [&>span]:size-9 [&>span]:rounded-lg" />
              <div><div className="font-semibold">{contact.title}</div><div className="text-sm text-muted">{contact.location}</div></div>
            </div>
            <Field label={t('learner.market.yourName')} htmlFor="m-name"><Input id="m-name" autoComplete="name" value={msg.name} onChange={e => setMsg(m => ({ ...m, name: e.target.value }))} /></Field>
            <Field label={t('learner.market.phone')} htmlFor="m-phone" optional hint={t('learner.market.phoneHint')}>
              <Input id="m-phone" type="tel" inputMode="tel" autoComplete="tel" value={msg.phone} onChange={e => setMsg(m => ({ ...m, phone: e.target.value }))} />
            </Field>
            <Field label={t('learner.market.message')} htmlFor="m-text"><Textarea id="m-text" value={msg.text} onChange={e => setMsg(m => ({ ...m, text: e.target.value }))} /></Field>
          </div>
        )}
      </Modal>
      {toastNode}
    </>
  );
}
