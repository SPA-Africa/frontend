// One mapping from every backend status value to a pill colour and a readable label.
// Labels go through i18n keys `status.<value>`; unknown values fall back to Title case.

'use client';

import { Badge, type Tone } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { messages } from '@/lib/i18n/messages';

const tone: Record<string, Tone> = {
  // generic
  active: 'ok', inactive: 'neutral', draft: 'neutral', published: 'ok', retired: 'neutral', archived: 'neutral',
  pending: 'gold', pending_approval: 'gold', approved: 'ok', declined: 'brand', suspended: 'brand',
  // learning
  enrolled: 'info', in_progress: 'info', completed: 'ok', dropped: 'neutral', valid: 'ok', revoked: 'brand',
  // pitch
  submitted: 'info', under_review: 'gold', scored: 'info', finalist: 'gold', winner: 'ok', not_selected: 'neutral',
  // cycles
  upcoming: 'neutral', open: 'ok', judging: 'gold',
  // bookings and invoices
  confirmed: 'ok', rescheduled: 'gold', cancelled: 'neutral', issued: 'info', partially_paid: 'gold', paid: 'ok', overdue: 'brand', written_off: 'neutral',
  // KPIs and reports
  on_track: 'ok', behind: 'brand', at_risk: 'gold', in_review: 'gold',
};

const fallback = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const { t } = useI18n();
  const key = `status.${status}`;
  return <Badge tone={tone[status] ?? 'neutral'} dot className={className}>{messages[key] ? t(key) : fallback(status)}</Badge>;
}
