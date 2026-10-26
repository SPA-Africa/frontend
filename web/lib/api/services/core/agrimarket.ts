// core-svc / agri-market: produce listings and buyer messages (SRS 1.2.1 scope, 2.2.1 offline listings, FR-B3.1 produce volume KPI)

import { defineEndpoint, paginate, type Page } from '../../define';
import { mockId, nowIso } from '../../mock-db';
import { db } from '../../mock/tables';
import { learnerDb } from '../../mock/learner-tables';
import type { AgriListing } from '../../../types';

export type ListingCategory = AgriListing['category'];

export const CATEGORIES: ListingCategory[] = ['Vegetables', 'Fruits', 'Grains', 'Dairy', 'Poultry', 'Coffee & Tea'];

export interface MarketListing extends AgriListing {
  /** true when the caller posted it */
  mine: boolean;
}

export type ListingQuery = { q?: string; category?: ListingCategory; location?: string; page?: number; pageSize?: number };

export interface NewListing {
  title: string;
  category: ListingCategory;
  quantity: number;
  unit: string;
  pricePerUnit: number; // RWF
  location: string;
  /** set when the listing was created offline and replayed later */
  createdOfflineAt?: string;
}

export interface SellerMessageRequest { name: string; phone?: string; text: string }

const placeholder: Record<ListingCategory, string> = {
  Vegetables: 'from-brand to-gold', Fruits: 'from-ok to-gold', Grains: 'from-gold to-gold-light',
  Dairy: 'from-info to-surface-2', Poultry: 'from-gold-light to-gold', 'Coffee & Tea': 'from-brand-dark to-brand',
};

const withMine = (l: AgriListing, mine: string[]): MarketListing => ({ ...l, mine: mine.includes(l.id) });

export const listListings = defineEndpoint<Page<MarketListing>, { query?: ListingQuery }>({
  id: 'agrimarket.listings.list', service: 'core', method: 'GET', path: '/market/listings',
  roles: ['authenticated'], summary: 'Browse produce listings, newest first', srs: ['SRS-1.2.1', 'NFR-BW.5'],
  response: 'Page<MarketListing>', paginated: true,
  query: ['q?: string (title, place, seller)', 'category?: ListingCategory', 'location?: string', 'page?: number', 'pageSize?: number (default 9)'],
  notes: 'Seller phone numbers and emails are never returned; buyers reach sellers through POST /market/listings/:id/messages.',
}, ({ args }) => {
  const { all, mine } = db.listings.get();
  const q = args.query ?? {};
  const term = q.q?.trim().toLowerCase();
  const items = all
    .filter(l => (!term || `${l.title} ${l.location} ${l.seller}`.toLowerCase().includes(term))
      && (!q.category || l.category === q.category)
      && (!q.location || l.location === q.location))
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt))
    .map(l => withMine(l, mine));
  return paginate(items, q, 9);
});

export const listMine = defineEndpoint<MarketListing[]>({
  id: 'agrimarket.listings.mine', service: 'core', method: 'GET', path: '/market/listings/me',
  roles: ['beneficiary'], summary: "The caller's own listings", srs: ['SRS-1.2.1'], response: 'MarketListing[]',
}, () => {
  const { all, mine } = db.listings.get();
  return all.filter(l => mine.includes(l.id)).map(l => withMine(l, mine));
});

export const createListing = defineEndpoint<MarketListing, { body: NewListing; idempotencyKey?: string }>({
  id: 'agrimarket.listings.create', service: 'core', method: 'POST', path: '/market/listings',
  roles: ['beneficiary'], summary: 'Post produce for sale', srs: ['SRS-1.2.1', 'SRS-2.2.1', 'FR-B3.1'],
  request: 'NewListing', response: 'MarketListing', offline: true, emits: ['listing.created'],
  notes: 'May be queued on the device while offline and replayed with the same Idempotency-Key. 400 "invalid_listing" for empty title, non-positive quantity or price. Volumes feed the agriculture KPI "Produce marketed through the platform".',
}, ({ args, user, fail }) => {
  const b = args.body;
  if (!b.title?.trim() || !(b.quantity > 0) || !(b.pricePerUnit > 0) || !CATEGORIES.includes(b.category)) {
    fail(400, 'invalid_listing', 'Please add a title, a quantity and a price');
  }
  const listing: AgriListing = {
    id: mockId('l'), title: b.title.trim(), category: b.category, quantity: `${b.quantity.toLocaleString('en-US')} ${b.unit}`,
    pricePerUnit: Math.round(b.pricePerUnit), unit: b.unit, location: b.location, seller: user?.name ?? 'You',
    postedAt: nowIso().slice(0, 10), image: placeholder[b.category],
  };
  db.listings.update(d => { d.all.unshift(listing); d.mine.unshift(listing.id); });
  return { ...listing, mine: true };
});

export const deleteListing = defineEndpoint<void, { params: { id: string } }>({
  id: 'agrimarket.listings.delete', service: 'core', method: 'DELETE', path: '/market/listings/:id',
  roles: ['beneficiary'], summary: 'Take one of your listings down', srs: ['SRS-1.2.1'], response: 'void', offline: true,
  emits: ['listing.removed'], notes: 'Owner only (403 "not_owner"). Soft delete so M&E volumes stay intact.',
}, ({ args, fail }) => {
  const { mine } = db.listings.get();
  if (!mine.includes(args.params.id)) fail(403, 'not_owner', 'You can only remove your own listings');
  db.listings.update(d => { d.all = d.all.filter(l => l.id !== args.params.id); d.mine = d.mine.filter(x => x !== args.params.id); });
});

export const contactSeller = defineEndpoint<{ sentAt: string }, { params: { id: string }; body: SellerMessageRequest }>({
  id: 'agrimarket.listings.contact', service: 'core', method: 'POST', path: '/market/listings/:id/messages',
  roles: ['authenticated'], summary: 'Send a message to the seller of a listing', srs: ['SRS-1.2.1'],
  request: 'SellerMessageRequest', response: '{ sentAt: string }', offline: true, emits: ['listing.contacted'],
  notes: 'Relayed to the seller by SMS and email; the buyer never sees seller contact details. Limit 10 messages per hour per buyer. 400 "empty_message".',
}, ({ args, user, fail }) => {
  const listing = db.listings.get().all.find(l => l.id === args.params.id);
  if (!listing) fail(404, 'listing_not_found', 'This listing is no longer available');
  if (!args.body.text?.trim()) fail(400, 'empty_message', 'Please write a message');
  const sentAt = nowIso();
  learnerDb.sellerMessages.update(list => {
    list.push({ id: mockId('msg'), listingId: args.params.id, fromUserId: user?.id ?? '', name: args.body.name, phone: args.body.phone ?? '', text: args.body.text.trim(), sentAt });
  });
  return { sentAt };
});
